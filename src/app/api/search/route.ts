import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { learningPaths, pages, projects, sections } from "@/db/schema";
import { requireSession, requireWorkspace } from "@/lib/api/context";
import { unauthorized } from "@/lib/api/problem";

export async function GET(request: Request) {
  if (!(await requireSession())) return unauthorized("Sign in to search documentation.");
  const workspace = await requireWorkspace();
  if (!workspace) return Response.json({ results: [] });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (query.length < 2) return Response.json({ results: [] });

  const tsQuery = sql`websearch_to_tsquery('english', ${query})`;
  const [rows, pathRows] = await Promise.all([db.select({
    slug: pages.slug,
    title: pages.title,
    description: pages.description,
    status: pages.status,
    project: projects.name,
    projectSlug: projects.slug,
    sectionSlug: sections.slug,
  }).from(pages)
    .innerJoin(projects, eq(pages.projectId, projects.id))
    .leftJoin(sections, eq(pages.sectionId, sections.id))
    .where(and(eq(projects.workspaceId, workspace.id), isNull(pages.deletedAt), sql`${pages.searchVector} @@ ${tsQuery}`))
    .orderBy(desc(sql`ts_rank(${pages.searchVector}, ${tsQuery})`), desc(pages.updatedAt))
    .limit(10),
  db.select({
    id: learningPaths.id,
    title: learningPaths.title,
    description: learningPaths.description,
    project: projects.name,
    projectSlug: projects.slug,
  }).from(learningPaths)
    .innerJoin(projects, eq(learningPaths.projectId, projects.id))
    .where(and(eq(projects.workspaceId, workspace.id), or(
      ilike(learningPaths.title, `%${query}%`),
      ilike(learningPaths.description, `%${query}%`),
    )))
    .orderBy(desc(learningPaths.createdAt))
    .limit(4)]);

  const pageResults = rows.map(({ sectionSlug, ...row }) => ({
    ...row,
    kind: "page" as const,
    href: sectionSlug ? `/p/${row.projectSlug}/${sectionSlug}/${row.slug}` : `/p/${row.projectSlug}/${row.slug}`,
  }));
  const pathResults = pathRows.map(row => ({
    ...row, slug: row.id, status: "Learning path", kind: "path" as const,
    href: `/p/${row.projectSlug}#learning-path-${row.id}`,
  }));
  return Response.json({ results: [...pathResults, ...pageResults].slice(0, 12) }, { headers: { "Cache-Control": "private, no-store" } });
}
