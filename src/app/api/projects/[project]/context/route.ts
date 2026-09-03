import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import { getProjectBySlug } from "@/lib/projects";

export async function GET(req: Request, { params }: { params: Promise<{ project: string }> }) {
  if (!(await requireSession())) return unauthorized("Sign in to read project context.");
  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists.");
  const project = await getProjectBySlug(workspace.id, (await params).project);
  if (!project) return notFound("Project not found.");
  const query = new URL(req.url).searchParams;
  const offset = Number(query.get("offset") ?? 0);
  const q = query.get("q")?.trim() ?? "";
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || q.length > 200) return badRequest("offset must be 0–10000 and q at most 200 characters.");
  const results = await db.select({
    slug: pages.slug, title: pages.title, description: pages.description, status: pages.status,
    version: pages.version, updatedAt: pages.updatedAt,
    summary: sql<string | null>`${pages.document}->>'summary'`,
  }).from(pages).where(and(eq(pages.projectId, project.id), isNull(pages.deletedAt), q ? sql`${pages.searchVector} @@ websearch_to_tsquery('english', ${q})` : undefined))
    .orderBy(asc(pages.slug)).limit(51).offset(offset);
  return Response.json({
    project: { slug: project.slug, name: project.name, summary: project.summary, stack: project.stack, entrypoints: project.entrypoints, conventions: project.conventions, openQuestions: project.openQuestions },
    pages: results.slice(0, 50), nextOffset: results.length > 50 ? offset + 50 : null,
    readPage: `/api/projects/${project.slug}/pages/{slug}?view=context`,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
