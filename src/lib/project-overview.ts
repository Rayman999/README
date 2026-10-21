import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { pageRevisions, pages, projectLinks, projects } from "@/db/schema";
import { listProjectTree } from "@/lib/projects";

export const WORDS_PER_MINUTE = 230;

/** Everything the project overview shows beyond the page tree itself. */
export async function getProjectOverviewData(project: { id: string; workspaceId: string }) {
  const [wordRows, contributorRows, tree, linkRows] = await Promise.all([
    // `body` holds Markdown, or the derived search text for structured
    // documents, so it is a fair basis for reading time either way.
    db
      .select({
        id: pages.id,
        createdAt: pages.createdAt,
        words: sql<number>`coalesce(array_length(regexp_split_to_array(trim(${pages.body}), '\\s+'), 1), 0)::int`,
      })
      .from(pages)
      .where(and(eq(pages.projectId, project.id), isNull(pages.deletedAt))),
    db
      .select({
        people: sql<number>`count(distinct ${pageRevisions.authorId})::int`,
        agentEdits: sql<number>`count(*) filter (where ${pageRevisions.authorType} = 'agent')::int`,
        edits: sql<number>`count(*)::int`,
      })
      .from(pageRevisions)
      .innerJoin(pages, eq(pageRevisions.pageId, pages.id))
      .where(eq(pages.projectId, project.id)),
    listProjectTree(project.workspaceId),
    db
      .select({ projectId: projectLinks.projectId, linkedProjectId: projectLinks.linkedProjectId })
      .from(projectLinks)
      .where(or(eq(projectLinks.projectId, project.id), eq(projectLinks.linkedProjectId, project.id))),
  ]);

  // Where this project sits, and the projects directly inside it, each with
  // how much it holds so the cards can say so.
  const place = tree.find((row) => row.id === project.id);
  const childIds = (place?.children ?? []).map((child) => child.id);
  const pageCounts = childIds.length
    ? await db.select({ projectId: pages.projectId, value: sql<number>`count(*)::int` })
        .from(pages).where(and(inArray(pages.projectId, childIds), isNull(pages.deletedAt))).groupBy(pages.projectId)
    : [];
  const pagesIn = new Map(pageCounts.map((row) => [row.projectId, row.value]));
  const children = (place?.children ?? []).map((child) => ({
    slug: child.slug,
    name: child.name,
    summary: child.summary,
    status: child.status,
    pages: pagesIn.get(child.id) ?? 0,
    projects: tree.find((row) => row.id === child.id)?.children.length ?? 0,
  }));
  // Valid destinations for "Move": anything not inside this project.
  const moveTargets = tree
    .filter((row) => row.id !== project.id && !row.ancestors.some((a) => a.id === project.id))
    .map((row) => ({ id: row.id, label: row.path.join(" / ") }));

  // Links are stored one way; show them from either side.
  const relatedIds = [...new Set(linkRows.map((row) => (row.projectId === project.id ? row.linkedProjectId : row.projectId)))];
  const related = relatedIds.length
    ? await db
        .select({ slug: projects.slug, name: projects.name, summary: projects.summary })
        .from(projects)
        .where(inArray(projects.id, relatedIds))
        .orderBy(projects.name)
    : [];

  return {
    pageStats: Object.fromEntries(
      wordRows.map((row) => [row.id, { words: row.words, minutes: Math.max(1, Math.round(row.words / WORDS_PER_MINUTE)), createdAt: row.createdAt }]),
    ),
    contributors: contributorRows[0] ?? { people: 0, agentEdits: 0, edits: 0 },
    ancestors: (place?.ancestors ?? []).map((a) => ({ slug: a.slug, name: a.name })),
    parentId: place?.ancestors.at(-1)?.id ?? null,
    children,
    moveTargets,
    related,
  };
}
