import { z } from "zod";
import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import { createLearningPath, getProjectBySlug, listLearningPaths, listPageMetadata } from "@/lib/projects";
import { readJson } from "@/lib/api/read-json";

const inputSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(300),
  pageSlugs: z.array(z.string().min(1).max(96)).min(1).max(30),
});

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  if (!(await requireSession())) return unauthorized("Sign in to view learning paths.");
  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");
  const project = await getProjectBySlug(workspace.id, (await params).project);
  if (!project) return notFound("Project not found.");
  return Response.json({ paths: await listLearningPaths(project.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ project: string }> }) {
  const session = await requireSession();
  if (!session || !canWrite(session.user.role)) return unauthorized("You need editor access to create learning paths.");
  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");
  const project = await getProjectBySlug(workspace.id, (await params).project);
  if (!project) return notFound("Project not found.");
  let json: unknown;
  try { json = await readJson(request); } catch { return badRequest("Invalid request."); }
  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) return badRequest("Add a title, description, and at least one page.");
  const known = new Set((await listPageMetadata(project.id)).map(page => page.slug));
  const pageSlugs = [...new Set(parsed.data.pageSlugs)];
  if (pageSlugs.some(slug => !known.has(slug))) return badRequest("One or more selected pages no longer exist.");
  const path = await createLearningPath({ projectId: project.id, ...parsed.data, pageSlugs, createdBy: session.user.id });
  return Response.json({ path }, { status: 201 });
}
