import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { starterDocument } from "../src/lib/documents/schema";
import { challengeFor, digest, resource, secret } from "../src/lib/mcp/security";

test("OAuth + actual MCP transport: isolation, permissions, revisions, replay and revocation", { skip: !process.env.MCP_TEST_DATABASE_URL }, async () => {
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
  const { callTool } = await import("../src/lib/mcp/tools");
  const routes = await import("../src/app/api/mcp/route");
  const tokenRoute = await import("../src/app/oauth/token/route");
  const metadataRoute = await import("../src/app/.well-known/oauth-authorization-server/route");
  const { eq, and, inArray } = await import("drizzle-orm");
  const workspaceId = randomUUID(), otherWorkspaceId = randomUUID(), userId = randomUUID();
  const callback = "https://chatgpt.com/connector/oauth/callback";
  let client: Client | undefined;
  try {
    await db.insert(s.users).values({ id: userId, email: `${userId}@test.invalid` });
    await db.insert(s.workspaces).values([{ id: workspaceId, slug: workspaceId, name: "MCP test" }, { id: otherWorkspaceId, slug: otherWorkspaceId, name: "Hidden workspace" }]);
    await db.insert(s.workspaceMembers).values({ userId, workspaceId, role: "owner" });
    await db.insert(s.projects).values([{ workspaceId, slug: "test", name: "Test", summary: "MCP example" }, { workspaceId: otherWorkspaceId, slug: "hidden", name: "Hidden", summary: "Must not leak" }]);
    const registered = await oauth.registerClient(workspaceId, { name: "ChatGPT test", redirectUris: [callback], scopes: ["docs:read", "docs:write"] });
    const stored = await db.query.oauthClients.findFirst({ where: eq(s.oauthClients.id, registered.clientId) });
    assert.notEqual(stored?.secretHash, registered.clientSecret);
    await assert.rejects(oauth.authenticateClient(registered.clientId, "wrong"));
    await oauth.authenticateClient(registered.clientId, registered.clientSecret!);
    const verifier = secret();
    const authorization = { client_id: registered.clientId, response_type: "code", redirect_uri: callback, code_challenge: challengeFor(verifier), code_challenge_method: "S256", state: "test-state", scope: "docs:read docs:write", resource: resource() };
    for (const bad of [{ redirect_uri: callback + "/evil" }, { code_challenge_method: "plain" }, { resource: "https://evil.test" }, { scope: "admin" }]) await assert.rejects(oauth.validateAuthorization({ ...authorization, ...bad }));
    await assert.rejects(oauth.authorize(authorization, randomUUID(), true));
    const approved = await oauth.authorize(authorization, userId, true);
    const exchange = { grant_type: "authorization_code", code: approved.code, redirect_uri: callback, code_verifier: verifier, resource: resource() };
    await assert.rejects(oauth.exchangeToken(registered.clientId, { ...exchange, code_verifier: secret() }));
    await assert.rejects(oauth.exchangeToken(registered.clientId, { ...exchange, redirect_uri: callback + "/evil" }));
    const tokenResponse = await tokenRoute.POST(new Request("http://localhost:3112/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${registered.clientId}:${registered.clientSecret}`).toString("base64")}` }, body: new URLSearchParams(exchange) }));
    assert.equal(tokenResponse.status, 200);
    const tokens = await tokenResponse.json();
    const ctx = await oauth.authenticateBearer(`Bearer ${tokens.access_token}`);
    assert.deepEqual(ctx.scopes, ["docs:read", "docs:write"]);
    const storedToken = await db.query.oauthTokens.findFirst({ where: eq(s.oauthTokens.hash, digest(tokens.access_token)) });
    assert.equal(storedToken?.kind, "access");
    const meta = await (await metadataRoute.GET()).json();
    assert.deepEqual(meta.code_challenge_methods_supported, ["S256"]);

    assert.equal((await routes.POST(new Request(resource(), { method: "POST", body: "{}" }))).status, 401);
    assert.equal((await routes.POST(new Request(resource(), { method: "POST", headers: { Origin: "https://evil.test" }, body: "{}" }))).status, 403);
    const unauthorized = await routes.GET(new Request(resource()));
    assert.match(unauthorized.headers.get("www-authenticate")!, /oauth-protected-resource/);
    const oversized = await routes.POST(new Request(resource(), { method: "POST", headers: { Authorization: `Bearer ${tokens.access_token}` }, body: "x".repeat(330 * 1024) }));
    assert.equal(oversized.status, 400);

    // Exercise the SDK client against the real route/transport, not only the
    // service functions. No external agent or live server is needed.
    client = new Client({ name: "integration-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(resource()), {
      requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      fetch: async (input, init) => {
        const req = new Request(input, init);
        return req.method === "POST" ? routes.POST(req) : routes.GET(req);
      },
    });
    await client.connect(transport);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 7);
    assert.equal(listed.tools.find((t) => t.name === "create_document")?.annotations?.readOnlyHint, false);
    const projectsResult = await client.callTool({ name: "list_projects", arguments: {} });
    assert.equal((projectsResult.structuredContent as { projects: unknown[] }).projects.length, 1);
    assert.equal((await callTool(ctx, "get_project_context", { project: "hidden" })).isError, true);
    const args = { project: "test", slug: "agent-draft", title: "Agent draft", description: "MCP example", document: starterDocument };
    assert.equal((await client.callTool({ name: "create_document", arguments: { ...args, unauthorizedField: true } })).isError, true);
    const created = await client.callTool({ name: "create_document", arguments: args });
    assert.notEqual(created.isError, true);
    assert.equal((created.structuredContent as { status: string }).status, "draft");
    assert.equal((await callTool(ctx, "create_document", args)).isError, true);
    const full = await callTool(ctx, "read_document", { project: "test", page: "agent-draft", view: "full" });
    assert.equal(full.structuredContent?.version, 1);
    const compact = await callTool(ctx, "read_document", { project: "test", page: "agent-draft" });
    assert.equal("document" in compact.structuredContent!, false);
    assert.equal((await callTool(ctx, "search_docs", { query: "Guides" })).isError, undefined);
    const updates = await Promise.all([1, 2].map((n) => callTool(ctx, "update_document", { project: "test", page: "agent-draft", title: `Update ${n}`, description: "Updated", document: starterDocument, expectedVersion: 1 })));
    assert.equal(updates.filter((r) => !r.isError).length, 1);
    const revisions = await db.select().from(s.pageRevisions).where(eq(s.pageRevisions.agentConnectionId, ctx.grantId));
    assert.equal(revisions.length, 2);
    assert.equal(revisions[0].authorId, userId);
    await db.update(s.pages).set({ status: "stable" }).where(eq(s.pages.id, revisions[0].pageId));
    assert.equal((await callTool(ctx, "update_document", { project: "test", page: "agent-draft", title: "No", description: "No", document: starterDocument, expectedVersion: 2 })).isError, true);

    await db.update(s.workspaceMembers).set({ role: "viewer" }).where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
    const readOnly = await oauth.authenticateBearer(`Bearer ${tokens.access_token}`);
    assert.deepEqual(readOnly.scopes, ["docs:read"]);
    assert.equal((await callTool(readOnly, "create_document", { ...args, slug: "forbidden" })).isError, true);
    assert.equal((await client.listTools()).tools.length, 5);
    await db.update(s.workspaceMembers).set({ role: "owner" }).where(eq(s.workspaceMembers.userId, userId));
    const refreshed = await oauth.exchangeToken(registered.clientId, { grant_type: "refresh_token", refresh_token: tokens.refresh_token, resource: resource() });
    await oauth.authenticateBearer(`Bearer ${refreshed.access_token}`);
    await assert.rejects(oauth.exchangeToken(registered.clientId, { grant_type: "refresh_token", refresh_token: tokens.refresh_token, resource: resource() }));
    await assert.rejects(oauth.authenticateBearer(`Bearer ${refreshed.access_token}`));

    const newApproval = await oauth.authorize(authorization, userId, false);
    const readTokens = await oauth.exchangeToken(registered.clientId, { ...exchange, code: newApproval.code });
    assert.equal(readTokens.scope, "docs:read");
    await oauth.revokeToken(registered.clientId, readTokens.access_token);
    await assert.rejects(oauth.authenticateBearer(`Bearer ${readTokens.access_token}`));
    const parallelApproval = await oauth.authorize(authorization, userId, true);
    const parallel = await Promise.allSettled([1, 2].map(() => oauth.exchangeToken(registered.clientId, { ...exchange, code: parallelApproval.code })));
    assert.equal(parallel.filter((r) => r.status === "fulfilled").length, 1);

    const finalApproval = await oauth.authorize(authorization, userId, true);
    const finalTokens = await oauth.exchangeToken(registered.clientId, { ...exchange, code: finalApproval.code });
    const finalCtx = await oauth.authenticateBearer(`Bearer ${finalTokens.access_token}`);
    await db.update(s.oauthGrants).set({ writeCount: 10, rateWindow: new Date() }).where(eq(s.oauthGrants.id, finalCtx.grantId));
    await assert.rejects(oauth.consumeRate(finalCtx, true));
    await db.update(s.oauthClients).set({ revokedAt: new Date() }).where(eq(s.oauthClients.id, registered.clientId));
    await assert.rejects(oauth.authenticateBearer(`Bearer ${finalTokens.access_token}`));
  } finally {
    await client?.close();
    await db.delete(s.workspaces).where(inArray(s.workspaces.id, [workspaceId, otherWorkspaceId]));
    await db.delete(s.users).where(eq(s.users.id, userId));
    await pool.end();
  }
});
