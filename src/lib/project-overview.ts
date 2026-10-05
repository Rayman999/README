import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { pageRevisions, pages, projectLinks, projects } from "@/db/schema";

export const WORDS_PER_MINUTE = 230;

/** Everything the project overview shows beyond the page tree itself. */
export async function getProjectOverviewData(project: { id: string; parentId: string | null }) {
  const [wordRows, contributorRows, children, parent, linkRows] = await Promise.all([
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
    db
      .select({ id: projects.id, slug: projects.slug, name: projects.name, summary: projects.summary })
      .from(projects)
      .where(eq(projects.parentId, project.id))
      .orderBy(projects.name),
    project.parentId
      ? db.query.projects.findFirst({
          where: eq(projects.id, project.parentId),
          columns: { slug: true, name: true, summary: true },
        })
      : Promise.resolve(undefined),
    db
      .select({ projectId: projectLinks.projectId, linkedProjectId: projectLinks.linkedProjectId })
      .from(projectLinks)
      .where(or(eq(projectLinks.projectId, project.id), eq(projectLinks.linkedProjectId, project.id))),
  ]);

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
    children,
    parent: parent ?? null,
    related,
  };
}
