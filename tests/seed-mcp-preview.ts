// Disposable UI fixture, never an application bootstrap or production seed.
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { challengeFor, secret } from "../src/lib/mcp/security";

async function main() {
  const url = process.env.MCP_TEST_DATABASE_URL!;
  assert.equal(new URL(url).pathname, "/readme_mcp_test");
  process.env.DATABASE_URL = url;
  const { db, pool } = await import("../src/db/index");
  const { users, workspaceMembers, workspaces } = await import("../src/db/schema");
  const { registerClient } = await import("../src/lib/mcp/oauth");
  try {
    assert.equal((await db.select().from(workspaces)).length, 0, "Preview DB must be empty.");
    const [workspace] = await db.insert(workspaces).values({ slug: "preview", name: "Documentation studio" }).returning();
    const [user] = await db.insert(users).values({ email: "mcp-preview@example.test", name: "Preview owner", passwordHash: await bcrypt.hash("McpPreviewOnly123!", 10) }).returning();
    await db.insert(workspaceMembers).values({ userId: user.id, workspaceId: workspace.id, role: "owner" });
    const client = await registerClient(workspace.id, { name: "ChatGPT preview", redirectUris: ["https://chatgpt.com/connector/oauth/callback"], scopes: ["docs:read", "docs:write"] });
    const params = new URLSearchParams({ client_id: client.clientId, response_type: "code", redirect_uri: "https://chatgpt.com/connector/oauth/callback", code_challenge: challengeFor(secret()), code_challenge_method: "S256", state: "preview-only", scope: "docs:read docs:write", resource: "http://localhost:3112/api/mcp" });
    console.log(`http://localhost:3112/oauth/authorize?${params}`);
    // No secret is logged, and this client is useful only in the disposable DB.
    assert.equal((await db.select().from(users).where(eq(users.id, user.id))).length, 1);
  } finally { await pool.end(); }
}
void main();
