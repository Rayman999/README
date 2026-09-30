import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

test("project deletion is scoped, removes content, and preserves sub-projects", {
  skip: !process.env.DOCUMENT_TEST_DATABASE_URL,
}, async () => {
  const url = process.env.DOCUMENT_TEST_DATABASE_URL!;
  assert.equal(new URL(url).pathname, "/readme_documents_test");
  process.env.DATABASE_URL = url;
  const migrationPool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(migrationPool), { migrationsFolder: "./drizzle" });
  } finally {
    await migrationPool.end();
  }
  const { db, pool } = await import("../src/db/index");
  const s = await import("../src/db/schema");
  const { deleteProject, createPage } = await import("../src/lib/projects");
  const { eq, inArray } = await import("drizzle-orm");
  const workspaceId = randomUUID();
  const otherWorkspaceId = randomUUID();
  try {
    await db.insert(s.workspaces).values([
      { id: workspaceId, slug: workspaceId, name: "Deletion test" },
      { id: otherWorkspaceId, slug: otherWorkspaceId, name: "Other workspace" },
    ]);
    const [parent, unrelated] = await db.insert(s.projects).values([
      { workspaceId, slug: "parent", name: "Parent", summary: "fixture" },
      { workspaceId: otherWorkspaceId, slug: "parent", name: "Unrelated", summary: "fixture" },
    ]).returning();
    const [child] = await db.insert(s.projects).values({
      workspaceId, parentId: parent.id, slug: "child", name: "Child", summary: "fixture",
    }).returning();
    const [section] = await db.insert(s.sections).values({ projectId: parent.id, slug: "guides", title: "Guides", position: 0 }).returning();
    const page = await createPage({ projectId: parent.id, sectionId: section.id, slug: "setup", title: "Setup", description: "fixture", body: "Parent content", authorType: "human" });
    const childPage = await createPage({ projectId: child.id, sectionId: null, slug: "child-page", title: "Child page", description: "fixture", body: "Keep this", authorType: "human" });
    const [path] = await db.insert(s.learningPaths).values({ projectId: parent.id, title: "Getting started", description: "fixture", pageSlugs: [page.slug] }).returning();
    await db.insert(s.projectLinks).values({ projectId: child.id, linkedProjectId: parent.id });

    assert.equal(await deleteProject(otherWorkspaceId, parent.slug, parent.id), undefined);
    assert.equal(await deleteProject(workspaceId, "wrong-slug", parent.id), undefined);
    assert.equal(await deleteProject(workspaceId, parent.slug, randomUUID()), undefined);
    assert.ok(await db.query.projects.findFirst({ where: eq(s.projects.id, parent.id) }));

    assert.deepEqual(await deleteProject(workspaceId, parent.slug, parent.id), { id: parent.id });
    assert.equal(await db.query.projects.findFirst({ where: eq(s.projects.id, parent.id) }), undefined);
    assert.equal(await db.query.sections.findFirst({ where: eq(s.sections.id, section.id) }), undefined);
    assert.equal(await db.query.pages.findFirst({ where: eq(s.pages.id, page.id) }), undefined);
    assert.equal(await db.query.pageRevisions.findFirst({ where: eq(s.pageRevisions.pageId, page.id) }), undefined);
    assert.equal(await db.query.learningPaths.findFirst({ where: eq(s.learningPaths.id, path.id) }), undefined);
    assert.equal(await db.query.projectLinks.findFirst({ where: eq(s.projectLinks.linkedProjectId, parent.id) }), undefined);
    assert.equal((await db.query.projects.findFirst({ where: eq(s.projects.id, child.id) }))?.parentId, null);
    assert.ok(await db.query.pages.findFirst({ where: eq(s.pages.id, childPage.id) }));
    assert.ok(await db.query.projects.findFirst({ where: eq(s.projects.id, unrelated.id) }));
    assert.equal(await deleteProject(workspaceId, parent.slug, parent.id), undefined);

    const [replacement] = await db.insert(s.projects).values({ workspaceId, slug: parent.slug, name: "Replacement", summary: "fixture" }).returning();
    assert.equal(await deleteProject(workspaceId, parent.slug, parent.id), undefined);
    assert.ok(await db.query.projects.findFirst({ where: eq(s.projects.id, replacement.id) }));
  } finally {
    await db.delete(s.workspaces).where(inArray(s.workspaces.id, [workspaceId, otherWorkspaceId]));
    await pool.end();
  }
});
