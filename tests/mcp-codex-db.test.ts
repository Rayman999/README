import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { challengeFor, resource, secret } from "../src/lib/mcp/security";

/**
 * The public-client half of the OAuth surface: the shape Codex uses.
 *
 * Runs in its own file rather than beside the ChatGPT test because both share
 * the process-wide database pool and each closes it when finished.
 */
test("public client: PKCE-only OAuth, loopback callbacks and confidential-client isolation", { skip: !process.env.MCP_TEST_DATABASE_URL }, async () => {
  const url = process.env.MCP_TEST_DATABASE_URL!;
  assert.equal(new URL(url).pathname, "/readme_mcp_test");
  process.env.DATABASE_URL = url;
  process.env.AUTH_URL = "http://localhost:3112";
  const migrationPool = new pg.Pool({ connectionString: url });
  await migrate(drizzle(migrationPool), { migrationsFolder: "./drizzle" });
  await migrationPool.end();

  const { db, pool } = await import("../src/db/index");
  const s = await import("../src/db/schema");
  const oauth = await import("../src/lib/mcp/oauth");
  const routes = await import("../src/app/api/mcp/route");
  const tokenRoute = await import("../src/app/oauth/token/route");
  const metadataRoute = await import("../src/app/.well-known/oauth-authorization-server/route");
  const { eq, and, inArray } = await import("drizzle-orm");

  const workspaceId = randomUUID(), otherWorkspaceId = randomUUID(), userId = randomUUID();
  // Registered without a port, exactly as an owner would copy it from Codex.
  const registeredCallback = "http://127.0.0.1/callback/readme";
  // What Codex actually sends once the OS has handed it a port.
  const liveCallback = "http://127.0.0.1:52341/callback/readme";
  const chatgptCallback = "https://chatgpt.com/connector/oauth/callback";

  const post = (form: Record<string, string>, headers: Record<string, string> = {}) =>
    tokenRoute.POST(new Request("http://localhost:3112/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
      body: new URLSearchParams(form),
    }));

  let client: Client | undefined;
  try {
    await db.insert(s.users).values({ id: userId, email: `${userId}@test.invalid` });
    await db.insert(s.workspaces).values([{ id: workspaceId, slug: workspaceId, name: "Codex test" }, { id: otherWorkspaceId, slug: otherWorkspaceId, name: "Hidden" }]);
    await db.insert(s.workspaceMembers).values({ userId, workspaceId, role: "owner" });
    await db.insert(s.projects).values([{ workspaceId, slug: "test", name: "Test", summary: "Codex example" }, { workspaceId: otherWorkspaceId, slug: "hidden", name: "Hidden", summary: "Must not leak" }]);

    // --- registration ----------------------------------------------------
    const codex = await oauth.registerClient(workspaceId, { name: "Codex", clientType: "public", redirectUris: [registeredCallback], scopes: ["docs:read", "docs:write"] });
    assert.equal(codex.clientSecret, null);
    assert.equal(codex.clientType, "public");
    const storedCodex = await db.query.oauthClients.findFirst({ where: eq(s.oauthClients.id, codex.clientId) });
    assert.equal(storedCodex?.secretHash, null);
    assert.equal(storedCodex?.clientType, "public");

    const chatgpt = await oauth.registerClient(workspaceId, { name: "ChatGPT", redirectUris: [chatgptCallback], scopes: ["docs:read", "docs:write"] });
    assert.equal(chatgpt.clientType, "confidential");
    assert.equal(typeof chatgpt.clientSecret, "string");

    // A public client registering a callback it may not have is refused.
    for (const bad of ["http://localhost/callback", "http://evil.test/callback", "http://127.0.0.1.evil.test/callback"]) {
      await assert.rejects(oauth.registerClient(workspaceId, { name: "Bad", clientType: "public", redirectUris: [bad], scopes: ["docs:read"] }));
    }

    // --- client authentication -------------------------------------------
    await oauth.authenticateClient(codex.clientId);                       // PKCE-only: no credential
    await assert.rejects(oauth.authenticateClient(codex.clientId, ""));   // an empty secret is still a secret
    await assert.rejects(oauth.authenticateClient(codex.clientId, "anything"));
    // The confidential client cannot be downgraded into the secret-less path.
    await assert.rejects(oauth.authenticateClient(chatgpt.clientId));
    await assert.rejects(oauth.authenticateClient(chatgpt.clientId, "wrong"));
    await oauth.authenticateClient(chatgpt.clientId, chatgpt.clientSecret!);

    const meta = await (await metadataRoute.GET()).json();
    assert.equal(meta.token_endpoint_auth_methods_supported.includes("none"), true);
    assert.deepEqual(meta.code_challenge_methods_supported, ["S256"]);
    assert.equal("registration_endpoint" in meta, false);            // no dynamic registration
    assert.equal(meta.client_id_metadata_document_supported, undefined);

    // --- authorization ----------------------------------------------------
    const verifier = secret();
    const authorization = { client_id: codex.clientId, response_type: "code", redirect_uri: liveCallback, code_challenge: challengeFor(verifier), code_challenge_method: "S256", state: "codex-state", scope: "docs:read docs:write" };

    // The ephemeral port is accepted against the portless registration, and the
    // resource indicator may be absent (Codex only sends it when configured).
    const validated = await oauth.validateAuthorization(authorization);
    assert.equal(validated.client.id, codex.clientId);
    await oauth.validateAuthorization({ ...authorization, resource: resource() });
    for (const bad of [
      { redirect_uri: "http://127.0.0.1:52341/callback/other" },
      { redirect_uri: "http://localhost:52341/callback/readme" },
      { redirect_uri: "http://127.0.0.1.evil.test:52341/callback/readme" },
      { redirect_uri: "http://evil.test/callback/readme" },
      { redirect_uri: "https://127.0.0.1/callback/readme" },
      { code_challenge_method: "plain" },
      { resource: "https://evil.test/api/mcp" },
      { scope: "admin" },
    ]) await assert.rejects(oauth.validateAuthorization({ ...authorization, ...bad }), JSON.stringify(bad));

    // The confidential client still must send a resource indicator.
    await assert.rejects(oauth.validateAuthorization({ ...authorization, client_id: chatgpt.clientId, redirect_uri: chatgptCallback }));
    await oauth.validateAuthorization({ ...authorization, client_id: chatgpt.clientId, redirect_uri: chatgptCallback, resource: resource() });
    // ...and gets no loopback flexibility of its own.
    await assert.rejects(oauth.validateAuthorization({ ...authorization, client_id: chatgpt.clientId, resource: resource() }));

    // The consent page re-serialises the request across the login round-trip.
    // An absent resource indicator must survive that as an absence, not as the
    // string "undefined", which would match nothing on the way back.
    const forwarded = Object.fromEntries(Object.entries(validated.params).filter(([, value]) => value !== undefined)) as Record<string, string>;
    assert.equal("resource" in forwarded, false);
    await oauth.validateAuthorization(Object.fromEntries(new URLSearchParams(forwarded)));

    await assert.rejects(oauth.authorize(authorization, randomUUID(), true));   // not a member
    const approved = await oauth.authorize(authorization, userId, true);

    // --- token exchange, with no client secret anywhere -------------------
    const base = { grant_type: "authorization_code", client_id: codex.clientId, redirect_uri: liveCallback, code_verifier: verifier };

    assert.equal((await post({ ...base, code: approved.code, code_verifier: "" })).status, 400);        // no PKCE proof
    assert.equal((await post({ ...base, code: approved.code, code_verifier: secret() })).status, 400);  // wrong verifier
    assert.equal((await post({ ...base, code: approved.code, redirect_uri: "http://127.0.0.1:9999/callback/readme" })).status, 400); // port pinned once chosen
    assert.equal((await post({ ...base, code: approved.code, client_secret: "invented" })).status, 401); // secret offered to a public client
    // Another client cannot spend this code, with or without its own secret.
    assert.equal((await post({ ...base, code: approved.code, client_id: chatgpt.clientId, client_secret: chatgpt.clientSecret! })).status, 400);

    const granted = await post({ ...base, code: approved.code });
    assert.equal(granted.status, 200);
    const tokens = await granted.json();
    assert.equal(tokens.token_type, "Bearer");
    assert.equal(tokens.scope, "docs:read docs:write");

    // Replay of a spent code fails and takes the grant down with it.
    assert.equal((await post({ ...base, code: approved.code })).status, 400);
    await assert.rejects(oauth.authenticateBearer(`Bearer ${tokens.access_token}`));

    // --- a working connection, end to end ---------------------------------
    const second = await oauth.authorize(authorization, userId, true);
    const live = await (await post({ ...base, code: second.code })).json();
    const ctx = await oauth.authenticateBearer(`Bearer ${live.access_token}`);
    assert.deepEqual(ctx.scopes, ["docs:read", "docs:write"]);

    client = new Client({ name: "codex-integration-test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(resource()), {
      requestInit: { headers: { Authorization: `Bearer ${live.access_token}` } },
      fetch: async (input, init) => {
        const req = new Request(input, init);
        return req.method === "POST" ? routes.POST(req) : routes.GET(req);
      },
    }));
    const projects = await client.callTool({ name: "list_projects", arguments: {} });
    const listed = (projects.structuredContent as { projects: { slug: string }[] }).projects;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].slug, "test");   // the other workspace stays invisible

    // --- refresh, rotation and revocation, still secret-free --------------
    const refreshed = await (await post({ grant_type: "refresh_token", client_id: codex.clientId, refresh_token: live.refresh_token })).json();
    await oauth.authenticateBearer(`Bearer ${refreshed.access_token}`);
    assert.equal((await post({ grant_type: "refresh_token", client_id: codex.clientId, refresh_token: live.refresh_token })).status, 400);
    await assert.rejects(oauth.authenticateBearer(`Bearer ${refreshed.access_token}`));

    // --- read-only consent -------------------------------------------------
    const readOnlyApproval = await oauth.authorize(authorization, userId, false);
    const readOnly = await (await post({ ...base, code: readOnlyApproval.code })).json();
    assert.equal(readOnly.scope, "docs:read");
    const readCtx = await oauth.authenticateBearer(`Bearer ${readOnly.access_token}`);
    const { callTool } = await import("../src/lib/mcp/tools");
    assert.equal((await callTool(readCtx, "create_document", { project: "test", slug: "nope", title: "No", description: "No", document: (await import("../src/lib/documents/schema")).starterDocument })).isError, true);

    await oauth.revokeToken(codex.clientId, readOnly.access_token);
    await assert.rejects(oauth.authenticateBearer(`Bearer ${readOnly.access_token}`));

    // A viewer loses write even on a grant that was issued carrying it. This
    // needs its own grant: the replay above deliberately revoked the last one.
    const viewerApproval = await oauth.authorize(authorization, userId, true);
    const viewerTokens = await (await post({ ...base, code: viewerApproval.code })).json();
    assert.deepEqual((await oauth.authenticateBearer(`Bearer ${viewerTokens.access_token}`)).scopes, ["docs:read", "docs:write"]);
    await db.update(s.workspaceMembers).set({ role: "viewer" }).where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
    assert.deepEqual((await oauth.authenticateBearer(`Bearer ${viewerTokens.access_token}`)).scopes, ["docs:read"]);
    await db.update(s.workspaceMembers).set({ role: "owner" }).where(eq(s.workspaceMembers.userId, userId));

    // Disabling the app cuts off a live connection, not merely a spent one.
    await db.update(s.oauthClients).set({ revokedAt: new Date() }).where(eq(s.oauthClients.id, codex.clientId));
    await assert.rejects(oauth.authenticateBearer(`Bearer ${viewerTokens.access_token}`));
    assert.equal((await post({ grant_type: "refresh_token", client_id: codex.clientId, refresh_token: viewerTokens.refresh_token })).status, 401);
  } finally {
    await client?.close();
    await db.delete(s.workspaces).where(inArray(s.workspaces.id, [workspaceId, otherWorkspaceId]));
    await db.delete(s.users).where(eq(s.users.id, userId));
    await pool.end();
  }
});
