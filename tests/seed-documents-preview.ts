// Optional browser-test fixture. Refuses every database except the disposable
// integration-test database. Never run this against a deployed application.
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

async function seed() {
  const url = process.env.DOCUMENT_TEST_DATABASE_URL;
  assert.ok(url, "Set DOCUMENT_TEST_DATABASE_URL to the disposable test database.");
  assert.equal(new URL(url).pathname, "/readme_documents_test");
  process.env.DATABASE_URL = url;
  const { db, pool } = await import("../src/db/index");
  const { users, workspaces, workspaceMembers, projects } = await import("../src/db/schema");
  try {
    const [user] = await db.insert(users).values({ email: "documents@example.test", name: "Document Tester", passwordHash: await bcrypt.hash("DocumentTestOnly123!", 10) }).returning();
    const [workspace] = await db.insert(workspaces).values({ slug: "document-preview", name: "Document preview" }).returning();
    await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
    await db.insert(projects).values({ workspaceId: workspace.id, slug: "document-preview", name: "Document preview", summary: "Isolated browser-test fixtures." });
    console.log("Disposable browser-test fixtures ready.");
  } finally { await pool.end(); }
}

seed().catch((error) => { console.error(error); process.exitCode = 1; });
