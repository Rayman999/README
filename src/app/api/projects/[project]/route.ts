import { z } from "zod";
import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { deleteProject } from "@/lib/projects";

const deleteSchema = z.strictObject({ id: z.string().uuid() });

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to delete projects.");
  if (!canWrite(session.user.role)) return forbidden("You need editor access to delete projects.");

  let body: unknown;
  try {
    body = await readJson(req, 1024);
  } catch {
    return badRequest("Send a valid JSON body containing the project ID.");
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("A valid project ID is required.");

  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");
  const { project: slug } = await params;
  // Check the immutable ID too: a stale card must not delete a replacement
  // project that later reused the same slug.
  const deleted = await deleteProject(workspace.id, slug, parsed.data.id);
  if (!deleted) return notFound("This project no longer exists. Refresh your library.");
  return new Response(null, { status: 204 });
}
