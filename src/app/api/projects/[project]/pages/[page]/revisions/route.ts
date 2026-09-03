import { requireSession, requireWorkspace } from "@/lib/api/context";
import { notFound, unauthorized } from "@/lib/api/problem";
import { getPageBySlug, getProjectBySlug, listPageRevisions } from "@/lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ project: string; page: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to view page history.");

  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");

  const { project: projectSlug, page: pageSlug } = await params;
  const project = await getProjectBySlug(workspace.id, projectSlug);
  if (!project) return notFound(`No project with slug "${projectSlug}".`);

  const page = await getPageBySlug(project.id, pageSlug);
  if (!page) return notFound(`No page with slug "${pageSlug}" in "${projectSlug}".`);

  const revisions = await listPageRevisions(page.id);
  return Response.json({ revisions });
}
