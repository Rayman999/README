import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { getProjectBySlug, deleteLearningPath } from "@/lib/projects";
import { notFound, unauthorized } from "@/lib/api/problem";

export async function DELETE(_request: Request, { params }: { params: Promise<{ project: string; id: string }> }) {
  const session = await requireSession();
  if (!session || !canWrite(session.user.role)) return unauthorized("You need editor access to delete learning paths.");
  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");
  const { project: slug, id } = await params;
  const project = await getProjectBySlug(workspace.id, slug);
  if (!project) return notFound("Project not found.");
  if (!(await deleteLearningPath(id, project.id))) return notFound("Learning path not found.");
  return new Response(null, { status: 204 });
}
