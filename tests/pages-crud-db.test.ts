import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * The data operations behind the manual page controls: status changes, section
 * assignment and reordering, and soft deletion. These are the paths the UI
 * drives through the REST API, tested a layer below the route handlers so the
 * assertions are about what happens to the data rather than about auth.
 */
test("manual page and section CRUD: status, sections, ordering, stale writes and soft delete", { skip: !process.env.DOCUMENT_TEST_DATABASE_URL }, async () => {
  const url = process.env.DOCUMENT_TEST_DATABASE_URL!;
  assert.equal(new URL(url).pathname, "/readme_documents_test");
  process.env.DATABASE_URL = url;
  const migrationPool = new pg.Pool({ connectionString: url });
  await migrate(drizzle(migrationPool), { migrationsFolder: "./drizzle" });
  await migrationPool.end();

  const { db, pool } = await import("../src/db/index");
  const s = await import("../src/db/schema");
  const projects = await import("../src/lib/projects");
  const { starterDocument } = await import("../src/lib/documents/schema");
  const { eq } = await import("drizzle-orm");

  const workspaceId = randomUUID();
  try {
    await db.insert(s.workspaces).values({ id: workspaceId, slug: workspaceId, name: "CRUD test" });
    const [project] = await db.insert(s.projects).values({ workspaceId, slug: "crud", name: "CRUD", summary: "fixture" }).returning();

    // --- sections ---------------------------------------------------------
    // The API route slugifies the title before calling this; do the same here.
    const { slugify } = await import("../src/lib/slug");
    const guides = await projects.createSection({ projectId: project.id, slug: slugify("Guides"), title: "Guides" });
    const reference = await projects.createSection({ projectId: project.id, slug: slugify("Reference"), title: "Reference" });
    assert.equal(guides.slug, "guides");
    assert.ok(reference.position > guides.position, "a new section goes after the existing ones");

    const renamed = await projects.updateSection(guides.id, { title: "How-to guides" });
    assert.equal(renamed?.title, "How-to guides");
    assert.equal(renamed?.slug, "guides", "renaming must not move the URL out from under existing links");

    // Reordering swaps positions with the neighbour, which is what the UI does.
    await projects.updateSection(guides.id, { position: reference.position });
    await projects.updateSection(reference.id, { position: guides.position });
    const ordered = await projects.listSections(project.id);
    assert.deepEqual(ordered.map((entry) => entry.slug), ["reference", "guides"]);

    // --- a page, and its status ------------------------------------------
    const page = await projects.createPage({
      projectId: project.id, sectionId: guides.id, slug: "setup",
      title: "Setup", description: "How to set it up", body: "", document: starterDocument, authorType: "human",
    });
    assert.equal(page.status, "draft");

    const published = await projects.updatePage(page.id, { status: "stable" }, "human", page.version);
    assert.equal(published?.status, "stable");
    assert.ok(published?.document, "a status-only change must not clear the document");
    assert.equal(published?.title, "Setup");

    // Optimistic concurrency: a second edit against the version we already
    // spent is refused rather than silently overwriting the first.
    assert.equal(await projects.updatePage(page.id, { status: "deprecated" }, "human", page.version), undefined);
    const current = await projects.getPageBySlug(project.id, "setup");
    assert.equal(current?.status, "stable");

    // --- moving a page between sections -----------------------------------
    const moved = await projects.updatePage(page.id, { sectionId: reference.id }, "human", current!.version);
    assert.equal(moved?.sectionId, reference.id);
    const loose = await projects.updatePage(page.id, { sectionId: null }, "human", moved!.version);
    assert.equal(loose?.sectionId, null, "a page can be returned to the top level");

    // --- soft delete ------------------------------------------------------
    const before = await projects.getProjectTree(project.id);
    assert.equal(before.loosePages.length, 1);
    await projects.softDeletePage(page.id);
    assert.equal(await projects.getPageBySlug(project.id, "setup"), undefined);
    const after = await projects.getProjectTree(project.id);
    assert.equal(after.loosePages.length, 0);
    assert.equal(after.sections.reduce((n, entry) => n + entry.pages.length, 0), 0);

    // The row and its history survive: deletion hides a page, it does not
    // destroy what was written.
    const [row] = await db.select().from(s.pages).where(eq(s.pages.id, page.id));
    assert.ok(row.deletedAt, "the page is marked deleted rather than removed");
    assert.ok((await projects.listPageRevisions(page.id)).length >= 1);

    // A freed slug can be reused, so deleting is not a one-way door.
    const replacement = await projects.createPage({
      projectId: project.id, sectionId: null, slug: "setup",
      title: "Setup, again", description: "Rewritten", body: "", document: starterDocument, authorType: "human",
    });
    assert.equal(replacement.slug, "setup");
  } finally {
    await db.delete(s.workspaces).where(eq(s.workspaces.id, workspaceId));
    await pool.end();
  }
});
