import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { isWithin, orderFolders } from "@/lib/folders";
import { learningPaths, pageRevisions, pages, projects, sections } from "@/db/schema";
import { documentSchema, documentText, type ReadmeDocument } from "./documents/schema";

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

/** Foreign keys remove project content and keep sub-projects as top-level projects. */
export async function deleteProject(workspaceId: string, slug: string, id: string) {
  const [row] = await db.delete(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.slug, slug), eq(projects.id, id)))
    .returning({ id: projects.id });
  return row;
}

export type ProjectDetails = {
  summary?: string;
  stack?: string[];
  repositoryUrl?: string | null;
  entrypoints?: string[];
  conventions?: string[];
  openQuestions?: string[];
  glossary?: Record<string, string>;
};

/** The descriptive fields shown on the overview; slug and name never change here. */
export async function updateProjectDetails(workspaceId: string, slug: string, details: ProjectDetails) {
  const [row] = await db
    .update(projects)
    .set({ ...details, updatedAt: new Date() })
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.slug, slug)))
    .returning({ id: projects.id });
  return row ?? null;
}

/**
 * Folders with their pages, flattened in reading order (depth-first) with
 * each folder's depth and path — the shape the sidebar, overview and
 * "up next" all walk.
 */
export async function getProjectTree(projectId: string) {
  const [sectionRows, pageRows] = await Promise.all([
    db
      .select()
      .from(sections)
      .where(eq(sections.projectId, projectId))
      .orderBy(asc(sections.position)),
    listPageMetadata(projectId),
  ]);

  return {
    sections: orderFolders(sectionRows).map((section) => ({
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
  description?: string;
  parentId?: string | null;
}) {
  const parentId = input.parentId ?? null;
  const [{ value: count }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(sections)
    .where(and(eq(sections.projectId, input.projectId), parentId ? eq(sections.parentId, parentId) : isNull(sections.parentId)));

  const [row] = await db
    .insert(sections)
    .values({
      projectId: input.projectId,
      slug: input.slug,
      title: input.title,
      description: input.description ?? "",
      parentId,
      position: count,
    })
    .returning();
  return row;
}

export async function updateSection(
  id: string,
  patch: Partial<{ title: string; description: string; position: number }>,
) {
  const [row] = await db
    .update(sections)
    .set(patch)
    .where(eq(sections.id, id))
    .returning();
  return row;
}

/**
 * Moves a folder under another folder (or to the top level), last among its
 * new siblings. Refuses to put a folder inside itself or its own sub-folders.
 * Returns an error message, or the updated row.
 */
export async function moveSection(projectId: string, sectionId: string, parentId: string | null) {
  const rows = await db
    .select({ id: sections.id, parentId: sections.parentId, position: sections.position, title: sections.title, slug: sections.slug })
    .from(sections)
    .where(eq(sections.projectId, projectId));
  if (!rows.some((row) => row.id === sectionId)) return { error: "That folder is not in this project." } as const;
  if (parentId && !rows.some((row) => row.id === parentId)) return { error: "The destination folder is not in this project." } as const;
  if (parentId && isWithin(rows, parentId, sectionId)) return { error: "A folder can't be moved inside itself or one of its own sub-folders." } as const;
  const position = rows.filter((row) => row.parentId === parentId && row.id !== sectionId).length;
  const [row] = await db.update(sections).set({ parentId, position }).where(eq(sections.id, sectionId)).returning();
  return { section: row } as const;
}

/**
 * Moves a page into a section (or to the top level) at the end of it. Only
 * the grouping changes: pages are addressed by slug, so old links redirect.
 */
export async function movePageToSection(projectId: string, pageId: string, sectionId: string | null) {
  const [{ value: position }] = await db
    .select({ value: sql<number>`coalesce(max(${pages.position}) + 1, 0)::int` })
    .from(pages)
    .where(and(eq(pages.projectId, projectId), sectionId ? eq(pages.sectionId, sectionId) : isNull(pages.sectionId), isNull(pages.deletedAt)));
  const [row] = await db
    .update(pages)
    .set({ sectionId, position, updatedAt: new Date() })
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
    .returning({ id: pages.id, slug: pages.slug, sectionId: pages.sectionId });
  return row ?? null;
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
      version: pages.version,
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
export async function createPage(input: {
  projectId: string;
  sectionId: string | null;
  slug: string;
  title: string;
  description: string;
  body: string;
  document?: ReadmeDocument;
  status?: "draft" | "stable" | "deprecated";
  tags?: string[];
  extendsPageId?: string | null;
  authorType: "human" | "agent";
  authorId?: string;
  agentConnectionId?: string;
}) {
  const [{ value: count }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(pages)
    .where(eq(pages.projectId, input.projectId));

  const document = input.document ? documentSchema.parse(input.document) : null;
  return db.transaction(async (tx) => {
  const [row] = await tx
    .insert(pages)
    .values({
      projectId: input.projectId,
      sectionId: input.sectionId,
      slug: input.slug,
      title: input.title,
      description: input.description,
      body: document ? documentText(document) : input.body,
      document,
      status: input.status ?? "draft",
      position: count,
      tags: input.tags ?? [],
      extendsPageId: input.extendsPageId ?? null,
      authorType: input.authorType,
    })
    .returning();

  // Revisions are append-only (BUILD.md §4) — write one on every write,
  // including creation, so a page's full history is always in one table.
  await tx.insert(pageRevisions).values({
    pageId: row.id,
    title: row.title,
    body: row.body,
    document: row.document,
    authorType: input.authorType,
    authorId: input.authorId,
    agentConnectionId: input.agentConnectionId,
  });

  return row;
  });
}

export async function updatePage(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    body: string;
    document: ReadmeDocument | null;
    status: "draft" | "stable" | "deprecated";
    sectionId: string | null;
    position: number;
    tags: string[];
    extendsPageId: string | null;
  }>,
  authorType: "human" | "agent",
  expectedVersion?: number,
  audit?: { authorId: string; agentConnectionId: string; draftOnly?: boolean },
) {
  const hasDocument = patch.document !== undefined;
  const document = patch.document ? documentSchema.parse(patch.document) : patch.document;
  return db.transaction(async (tx) => {
  const [row] = await tx
    .update(pages)
    .set({
      ...patch,
      ...(hasDocument ? { document, ...(document ? { body: documentText(document) } : {}) } : {}),
      ...(patch.body !== undefined ? { body: patch.body, document: null } : {}),
      authorType,
      version: sql`${pages.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(pages.id, id), isNull(pages.deletedAt), expectedVersion === undefined ? undefined : eq(pages.version, expectedVersion), audit?.draftOnly ? eq(pages.status, "draft") : undefined))
    .returning();

  if (row && (patch.body !== undefined || patch.title !== undefined || document)) {
    await tx.insert(pageRevisions).values({
      pageId: row.id,
      title: row.title,
      body: row.body,
      document: row.document,
      authorType,
      authorId: audit?.authorId,
      agentConnectionId: audit?.agentConnectionId,
    });
  }

  return row;
  });
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

export async function listLearningPaths(projectId: string) {
  return db.select().from(learningPaths).where(eq(learningPaths.projectId, projectId)).orderBy(asc(learningPaths.createdAt));
}

export async function createLearningPath(input: {
  projectId: string; title: string; description: string; pageSlugs: string[]; createdBy: string;
}) {
  const [row] = await db.insert(learningPaths).values(input).returning();
  return row;
}

export async function deleteLearningPath(id: string, projectId: string) {
  const [row] = await db.delete(learningPaths)
    .where(and(eq(learningPaths.id, id), eq(learningPaths.projectId, projectId))).returning();
  return row;
}
