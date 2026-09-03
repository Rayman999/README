import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { pageRevisions, pages, projects, sections } from "@/db/schema";

export { slugify } from "./slug";

export async function listProjects(workspaceId: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.name));
}

/** Top-level projects only — the valid parents, since nesting is one deep. */
export async function listTopLevelProjects(workspaceId: string) {
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.parentId)))
    .orderBy(asc(projects.name));
}

export async function getProjectBySlug(workspaceId: string, slug: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.workspaceId, workspaceId), eq(projects.slug, slug)),
  });
}

/** Sections with their pages, ordered — the shape the sidebar needs. */
export async function getProjectTree(projectId: string) {
  const [sectionRows, pageRows] = await Promise.all([
    db
      .select()
      .from(sections)
      .where(eq(sections.projectId, projectId))
      .orderBy(asc(sections.position)),
    db
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt)))
      .orderBy(asc(pages.position)),
  ]);

  return {
    sections: sectionRows.map((section) => ({
      ...section,
      pages: pageRows.filter((p) => p.sectionId === section.id),
    })),
    loosePages: pageRows.filter((p) => p.sectionId === null),
  };
}

/**
 * BUILD.md §4: parent_id is one level deep. Reject a project whose chosen
 * parent already has a parent, rather than silently flattening it.
 * Returns an error message, or null when the parent is valid.
 */
export async function validateParent(parentId: string) {
  const parent = await db.query.projects.findFirst({
    where: eq(projects.id, parentId),
  });
  if (!parent) return "That parent project does not exist.";
  if (parent.parentId) {
    return "Projects can only nest one level deep. Choose a top-level parent.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function listSections(projectId: string) {
  return db
    .select()
    .from(sections)
    .where(eq(sections.projectId, projectId))
    .orderBy(asc(sections.position));
}

export async function getSectionBySlug(projectId: string, slug: string) {
  return db.query.sections.findFirst({
    where: and(eq(sections.projectId, projectId), eq(sections.slug, slug)),
  });
}

export async function getSectionById(id: string) {
  return db.query.sections.findFirst({ where: eq(sections.id, id) });
}

export async function createSection(input: {
  projectId: string;
  slug: string;
  title: string;
}) {
  const [{ value: count }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(sections)
    .where(eq(sections.projectId, input.projectId));

  const [row] = await db
    .insert(sections)
    .values({
      projectId: input.projectId,
      slug: input.slug,
      title: input.title,
      position: count,
    })
    .returning();
  return row;
}

export async function updateSection(
  id: string,
  patch: Partial<{ title: string; position: number }>,
) {
  const [row] = await db
    .update(sections)
    .set(patch)
    .where(eq(sections.id, id))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** Metadata only — no `body`. Used for list views and nav. */
export async function listPageMetadata(projectId: string) {
  return db
    .select({
      id: pages.id,
      slug: pages.slug,
      title: pages.title,
      description: pages.description,
      status: pages.status,
      sectionId: pages.sectionId,
      position: pages.position,
      tags: pages.tags,
      authorType: pages.authorType,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt)))
    .orderBy(asc(pages.position));
}

/** A page is addressed by (project, slug) alone — slugs are unique per
 * project regardless of section (schema §4). The section segment in the
 * `/p/:project/:section/:page` route is for a readable URL and is checked
 * against the page's actual section, not used to look it up. */
export async function getPageBySlug(projectId: string, slug: string) {
  return db.query.pages.findFirst({
    where: and(
      eq(pages.projectId, projectId),
      eq(pages.slug, slug),
      isNull(pages.deletedAt),
    ),
  });
}

/**
 * Previous/next within the same reading order as the sidebar: sections in
 * position order, each section's pages in position order, then loose
 * (top-level) pages last. Not specified in BUILD.md — chosen to match what
 * the reader just saw in the nav rather than a separate ordering.
 */
export async function getPageNeighbours(projectId: string, pageId: string) {
  const tree = await getProjectTree(projectId);
  const flat = [
    ...tree.sections.flatMap((s) => s.pages),
    ...tree.loosePages,
  ];
  const index = flat.findIndex((p) => p.id === pageId);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: index > 0 ? flat[index - 1] : null,
    next: index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export async function createPage(input: {
  projectId: string;
  sectionId: string | null;
  slug: string;
  title: string;
  description: string;
  body: string;
  status?: "draft" | "stable" | "deprecated";
  tags?: string[];
  extendsPageId?: string | null;
  authorType: "human" | "agent";
}) {
  const [{ value: count }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(pages)
    .where(eq(pages.projectId, input.projectId));

  const [row] = await db
    .insert(pages)
    .values({
      projectId: input.projectId,
      sectionId: input.sectionId,
      slug: input.slug,
      title: input.title,
      description: input.description,
      body: input.body,
      status: input.status ?? "draft",
      position: count,
      tags: input.tags ?? [],
      extendsPageId: input.extendsPageId ?? null,
      authorType: input.authorType,
    })
    .returning();

  // Revisions are append-only (BUILD.md §4) — write one on every write,
  // including creation, so a page's full history is always in one table.
  await db.insert(pageRevisions).values({
    pageId: row.id,
    title: row.title,
    body: row.body,
    authorType: input.authorType,
  });

  return row;
}

export async function updatePage(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    body: string;
    status: "draft" | "stable" | "deprecated";
    sectionId: string | null;
    position: number;
    tags: string[];
    extendsPageId: string | null;
  }>,
  authorType: "human" | "agent",
) {
  const [row] = await db
    .update(pages)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();

  if (row && (patch.body !== undefined || patch.title !== undefined)) {
    await db.insert(pageRevisions).values({
      pageId: row.id,
      title: row.title,
      body: row.body,
      authorType,
    });
  }

  return row;
}

export async function softDeletePage(id: string) {
  const [row] = await db
    .update(pages)
    .set({ deletedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  return row;
}

export async function listPageRevisions(pageId: string) {
  return db
    .select()
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(sql`${pageRevisions.createdAt} desc`);
}
