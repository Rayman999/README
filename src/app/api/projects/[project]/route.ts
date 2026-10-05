import { z } from "zod";
import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { deleteProject, updateProjectDetails } from "@/lib/projects";

const deleteSchema = z.strictObject({ id: z.string().uuid() });

const line = z.string().trim().min(1).max(300);
const patchSchema = z.strictObject({
  summary: z.string().trim().min(1).max(1000).optional(),
  stack: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  repositoryUrl: z.url({ protocol: /^https?$/ }).max(500).nullable().optional(),
  entrypoints: z.array(line).max(40).optional(),
  conventions: z.array(line).max(60).optional(),
  openQuestions: z.array(line).max(60).optional(),
  glossary: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(500))
    .refine((value) => Object.keys(value).length <= 200, "Up to 200 glossary terms.")
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to edit projects.");
  if (!canWrite(session.user.role)) return forbidden("You need editor access to edit projects.");

  const parsed = patchSchema.safeParse(await readJson(req, 128 * 1024).catch(() => null));
  if (!parsed.success) {
    return badRequest("The project details did not match the expected shape.", { errors: parsed.error.issues });
  }
  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");
  const { project: slug } = await params;
  if (!(await updateProjectDetails(workspace.id, slug, parsed.data))) return notFound("This project no longer exists.");
  return new Response(null, { status: 204 });
}

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
