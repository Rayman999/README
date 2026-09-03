import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { starterDocument } from "../src/lib/documents/schema";

test("PostgreSQL: migrate, round-trip documents, revision atomics and stale-edit protection", { skip: !process.env.DOCUMENT_TEST_DATABASE_URL }, async () => {
  const url = process.env.DOCUMENT_TEST_DATABASE_URL!;
  // Refuse to run mutation tests on a developer's real application database.
  assert.equal(new URL(url).pathname, "/readme_documents_test");
  process.env.DATABASE_URL = url;
  const migrationPool = new pg.Pool({ connectionString: url });
  await migrate(drizzle(migrationPool), { migrationsFolder: "./drizzle" });
  await migrationPool.end();
  const { db, pool } = await import("../src/db/index");
  const { workspaces, projects } = await import("../src/db/schema");
  const { createPage, getPageBySlug, updatePage, listPageRevisions, getProjectTree } = await import("../src/lib/projects");
  const { eq, sql } = await import("drizzle-orm");
  const workspaceId = randomUUID();
  try {
    await db.insert(workspaces).values({ id: workspaceId, slug: `test-${workspaceId}`, name: "Document test" });
    const [project] = await db.insert(projects).values({ workspaceId, slug: "test", name: "Test", summary: "Test" }).returning();
    const input = { projectId: project.id, sectionId: null, title: "Example", description: "Document test", body: "", authorType: "human" as const };
    const page = await createPage({ ...input, slug: "structured", document: starterDocument });
    assert.deepEqual((await getPageBySlug(project.id, page.slug))?.document, starterDocument);
    assert.equal(page.version, 1);
    assert.match(page.body, /Guides: 7/);
    const legacy = await createPage({ ...input, slug: "legacy", body: "## Still Markdown" });
    assert.equal(legacy.document, null);
    assert.equal(legacy.body, "## Still Markdown");
    const results = await Promise.all([
      updatePage(page.id, { document: { ...starterDocument, summary: "First update" } }, "agent", 1),
      updatePage(page.id, { document: { ...starterDocument, summary: "Second update" } }, "agent", 1),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const saved = await getPageBySlug(project.id, page.slug);
    assert.equal(saved?.version, 2);
    assert.equal(saved?.authorType, "agent");
    const revisions = await listPageRevisions(page.id);
    assert.equal(revisions.length, 2);
    assert.deepEqual(revisions[0].document, saved?.document);
    const tree = await getProjectTree(project.id);
    assert.equal("body" in tree.loosePages[0], false);
    assert.equal("document" in tree.loosePages[0], false);
    const hits = await db.execute(sql`select id from pages where project_id = ${project.id} and search_vector @@ websearch_to_tsquery('english', 'Guides')`);
    assert.equal(hits.rows.length, 1);
  } finally {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await pool.end();
  }
});
