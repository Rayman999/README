import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { oauthClients, oauthCodes, oauthGrants, oauthTokens, workspaceMembers } from "@/db/schema";
import { authorizationInput, challengeFor, clientInput, digest, matchesSecret, parseScopes, resource, secret } from "./security";

export class OAuthError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export async function registerClient(workspaceId: string, input: unknown) {
  const data = clientInput.parse(input);
  const clientSecret = secret();
  const [row] = await db.insert(oauthClients).values({ ...data, workspaceId, secretHash: digest(clientSecret) }).returning();
  return { clientId: row.id, clientSecret };
}

export async function validateAuthorization(input: unknown) {
  const parsed = authorizationInput.safeParse(input);
  if (!parsed.success) throw new OAuthError("invalid_request");
  const params = parsed.data;
  const client = await db.query.oauthClients.findFirst({ where: and(eq(oauthClients.id, params.client_id), isNull(oauthClients.revokedAt)) });
  // Never redirect errors to an unvalidated callback.
  if (!client || !client.redirectUris.includes(params.redirect_uri)) throw new OAuthError("invalid_client");
  if (params.resource !== resource()) throw new OAuthError("invalid_target");
  let scopes: string[];
  try { scopes = parseScopes(params.scope); } catch { throw new OAuthError("invalid_scope"); }
  if (scopes.some((s) => !client.scopes.includes(s))) throw new OAuthError("invalid_scope");
  return { params, client, scopes };
}

export async function authorize(input: unknown, userId: string, allowWrite: boolean) {
  const { params, client, scopes } = await validateAuthorization(input);
  const member = await db.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.workspaceId, client.workspaceId), eq(workspaceMembers.userId, userId)) });
  if (!member) throw new OAuthError("access_denied", 403);
  const granted = scopes.filter((s) => s !== "docs:write" || (allowWrite && member.role !== "viewer"));
  const code = secret();
  await db.transaction(async (tx) => {
    // Serialize consent creation per membership, and cap active grants so a
    // repeated consent submission cannot grow the database without bound.
    await tx.select().from(workspaceMembers).where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, client.workspaceId))).for("update");
    // Expired grants cascade to codes/tokens. Bound long-term storage without
    // a scheduler; refresh replay records remain until their grant expires.
    await tx.delete(oauthGrants).where(lt(oauthGrants.expiresAt, new Date()));
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(oauthGrants).where(and(eq(oauthGrants.userId, userId), eq(oauthGrants.workspaceId, client.workspaceId), isNull(oauthGrants.revokedAt)));
    if (count >= 20) throw new OAuthError("connection_limit_reached", 429);
    const [grant] = await tx.insert(oauthGrants).values({ clientId: client.id, userId, workspaceId: client.workspaceId, scopes: granted, expiresAt: new Date(Date.now() + 30 * 86400_000) }).returning();
    await tx.insert(oauthCodes).values({ hash: digest(code), grantId: grant.id, redirectUri: params.redirect_uri, challenge: params.code_challenge, expiresAt: new Date(Date.now() + 5 * 60_000) });
  });
  return { code, params };
}

export async function authenticateClient(clientId: string, clientSecret: string) {
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || clientSecret.length > 256) throw new OAuthError("invalid_client", 401);
  const client = await db.query.oauthClients.findFirst({ where: and(eq(oauthClients.id, clientId), isNull(oauthClients.revokedAt)) });
  if (!client || !matchesSecret(clientSecret, client.secretHash)) throw new OAuthError("invalid_client", 401);
  return client;
}

export async function exchangeToken(clientId: string, form: Record<string, string>) {
  if (form.resource !== resource()) throw new OAuthError("invalid_target");
  const refreshing = form.grant_type === "refresh_token";
  if (!refreshing && form.grant_type !== "authorization_code") throw new OAuthError("unsupported_grant_type");
  const raw = refreshing ? form.refresh_token : form.code;
  if (!raw || raw.length > 256) throw new OAuthError("invalid_grant");
  const result = await db.transaction(async (tx) => {
    const table = refreshing ? oauthTokens : oauthCodes;
    // Lock the code/token before checking use: concurrent exchanges cannot win.
    const [record] = await tx.select().from(table).where(eq(table.hash, digest(raw))).for("update");
    if (!record) return null;
    const [grant] = await tx.select().from(oauthGrants).where(eq(oauthGrants.id, record.grantId)).for("update");
    if (!grant || grant.clientId !== clientId || grant.revokedAt || grant.expiresAt <= new Date()) return null;
    const [member] = await tx.select().from(workspaceMembers).where(and(eq(workspaceMembers.userId, grant.userId), eq(workspaceMembers.workspaceId, grant.workspaceId)));
    if (!member) return null;
    if (refreshing) {
      if (!("kind" in record) || record.kind !== "refresh") return null;
    } else {
      if (!("challenge" in record) || form.redirect_uri !== record.redirectUri || !/^[A-Za-z0-9._~-]{43,128}$/.test(form.code_verifier ?? "") || challengeFor(form.code_verifier) !== record.challenge) return null;
    }
    if (record.usedAt) {
      // Commit revocation (do not throw inside this transaction).
      await tx.update(oauthGrants).set({ revokedAt: new Date() }).where(eq(oauthGrants.id, grant.id));
      return null;
    }
    if (record.expiresAt <= new Date()) return null;
    // Normally ~720 refreshes cover a 30-day grant. Bound replay history even
    // for a misbehaving client that refreshes far more often than necessary.
    const [{ tokenCount }] = await tx.select({ tokenCount: sql<number>`count(*)::int` }).from(oauthTokens).where(eq(oauthTokens.grantId, grant.id));
    if (tokenCount >= 1600) {
      await tx.update(oauthGrants).set({ revokedAt: new Date() }).where(eq(oauthGrants.id, grant.id));
      return null;
    }
    let scopes = grant.scopes.filter((s) => s !== "docs:write" || member.role !== "viewer");
    if (form.scope) {
      let requested: string[];
      try { requested = parseScopes(form.scope); } catch { return null; }
      if (requested.some((s) => !scopes.includes(s))) return null;
      scopes = requested;
    }
    await tx.update(table).set({ usedAt: new Date() }).where(eq(table.hash, digest(raw)));
    await tx.update(oauthGrants).set({ scopes }).where(eq(oauthGrants.id, grant.id));
    await tx.delete(oauthTokens).where(and(eq(oauthTokens.grantId, grant.id), eq(oauthTokens.kind, "access"), lt(oauthTokens.expiresAt, new Date())));
    const accessToken = secret();
    const refreshToken = secret();
    await tx.insert(oauthTokens).values([
      { hash: digest(accessToken), grantId: grant.id, kind: "access", expiresAt: new Date(Date.now() + 3600_000) },
      { hash: digest(refreshToken), grantId: grant.id, kind: "refresh", expiresAt: grant.expiresAt },
    ]);
    return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, refresh_token: refreshToken, scope: scopes.join(" ") };
  });
  if (!result) throw new OAuthError("invalid_grant");
  return result;
}

export type AgentContext = { grantId: string; userId: string; workspaceId: string; scopes: string[] };

export async function authenticateBearer(header: string | null): Promise<AgentContext> {
  if (!header || !/^Bearer [A-Za-z0-9_-]{43}$/i.test(header)) throw new OAuthError("invalid_token", 401);
  const [row] = await db.select({ grant: oauthGrants, role: workspaceMembers.role })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, oauthGrants.userId), eq(workspaceMembers.workspaceId, oauthGrants.workspaceId)))
    .where(and(eq(oauthTokens.hash, digest(header.slice(7))), eq(oauthTokens.kind, "access"), gt(oauthTokens.expiresAt, new Date()), gt(oauthGrants.expiresAt, new Date()), isNull(oauthGrants.revokedAt), isNull(oauthClients.revokedAt)));
  if (!row) throw new OAuthError("invalid_token", 401);
  return { grantId: row.grant.id, userId: row.grant.userId, workspaceId: row.grant.workspaceId, scopes: row.grant.scopes.filter((s) => s !== "docs:write" || row.role !== "viewer") };
}

export async function consumeRate(ctx: AgentContext, write = false) {
  const cutoff = new Date(Date.now() - 60_000);
  const fresh = sql`${oauthGrants.rateWindow} <= ${cutoff}`;
  const [row] = await db.update(oauthGrants).set({
    rateWindow: sql`case when ${fresh} then now() else ${oauthGrants.rateWindow} end`,
    requestCount: sql`case when ${fresh} then 1 else ${oauthGrants.requestCount} + 1 end`,
    writeCount: sql`case when ${fresh} then ${write ? 1 : 0} else ${oauthGrants.writeCount} + ${write ? 1 : 0} end`,
    lastUsedAt: new Date(),
  }).where(and(eq(oauthGrants.id, ctx.grantId), isNull(oauthGrants.revokedAt), sql`(${fresh} or (${oauthGrants.requestCount} < 120 and (${!write} or ${oauthGrants.writeCount} < 10)))`)).returning({ id: oauthGrants.id });
  if (!row) throw new OAuthError("rate_limit_exceeded", 429);
}

export async function revokeToken(clientId: string, raw: string) {
  if (raw.length > 256) return;
  const token = await db.query.oauthTokens.findFirst({ where: eq(oauthTokens.hash, digest(raw)) });
  if (token) await db.update(oauthGrants).set({ revokedAt: new Date() }).where(and(eq(oauthGrants.id, token.grantId), eq(oauthGrants.clientId, clientId)));
}
