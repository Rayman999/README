import { z } from "zod";
import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import {
  getPageBySlug,
  getProjectBySlug,
  getSectionBySlug,
  softDeletePage,
  updatePage,
} from "@/lib/projects";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(300).optional(),
  body: z.string().optional(), // raw markdown, no transformation on write
  section: z.string().trim().min(1).max(96).nullish(),
  status: z.enum(["draft", "stable", "deprecated"]).optional(),
  tags: z.array(z.string()).optional(),
});

async function resolve(projectSlug: string, pageSlug: string) {
  const workspace = await requireWorkspace();
  if (!workspace) return { error: notFound("No workspace exists yet.") };

  const project = await getProjectBySlug(workspace.id, projectSlug);
  if (!project) {
    return { error: notFound(`No project with slug "${projectSlug}".`) };
  }

  const page = await getPageBySlug(project.id, pageSlug);
  if (!page) {
    return { error: notFound(`No page with slug "${pageSlug}" in "${projectSlug}".`) };
  }

  return { project, page };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ project: string; page: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to view this page.");

  const { project: projectSlug, page: pageSlug } = await params;
  const resolved = await resolve(projectSlug, pageSlug);
  if ("error" in resolved) return resolved.error;

  return Response.json({ page: resolved.page });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ project: string; page: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to edit pages.");
  if (!canWrite(session.user.role)) {
    return unauthorized("You need editor access to edit pages.");
  }

  const { project: projectSlug, page: pageSlug } = await params;
  const resolved = await resolve(projectSlug, pageSlug);
  if ("error" in resolved) return resolved.error;
  const { project, page } = resolved;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("The request body did not match the expected shape.", {
      errors: parsed.error.issues,
    });
  }
  const data = parsed.data;

  let sectionId: string | null | undefined = undefined;
  if (data.section !== undefined) {
    if (data.section === null) {
      sectionId = null;
    } else {
      const section = await getSectionBySlug(project.id, data.section);
      if (!section) {
        return badRequest(`No section with slug "${data.section}" on this project.`);
      }
      sectionId = section.id;
    }
  }

  const updated = await updatePage(
    page.id,
    {
      title: data.title,
      description: data.description,
      body: data.body,
      status: data.status,
      tags: data.tags,
      sectionId,
    },
    "human",
  );

  return Response.json({ page: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ project: string; page: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to delete pages.");
  if (!canWrite(session.user.role)) {
    return unauthorized("You need editor access to delete pages.");
  }

  const { project: projectSlug, page: pageSlug } = await params;
  const resolved = await resolve(projectSlug, pageSlug);
  if ("error" in resolved) return resolved.error;

  // Soft delete (BUILD.md §6) — the row and its revisions stay, `deletedAt`
  // just excludes it from listings and rendering.
  await softDeletePage(resolved.page.id);
  return new Response(null, { status: 204 });
}
