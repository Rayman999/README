import { z } from "zod";
import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, conflict, notFound, unauthorized } from "@/lib/api/problem";
import { documentContext, documentSchema } from "@/lib/documents/schema";
import { readJson } from "@/lib/api/read-json";
import {
  getPageBySlug,
  getProjectBySlug,
  getSectionBySlug,
  softDeletePage,
  updatePage,
} from "@/lib/projects";

const patchSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(300).optional(),
  body: z.string().max(200000).optional(), // legacy Markdown
  document: documentSchema.optional(),
  expectedVersion: z.number().int().min(1).optional(),
  section: z.string().trim().min(1).max(96).nullish(),
  status: z.enum(["draft", "stable", "deprecated"]).optional(),
  tags: z.array(z.string().max(80)).max(20).optional(),
}).refine((data) => !(data.body !== undefined && data.document !== undefined), { message: "Supply body or document, not both." });

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
  req: Request,
  { params }: { params: Promise<{ project: string; page: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to view this page.");

  const { project: projectSlug, page: pageSlug } = await params;
  const resolved = await resolve(projectSlug, pageSlug);
  if ("error" in resolved) return resolved.error;

  if (new URL(req.url).searchParams.get("view") === "context") {
    const page = resolved.page;
    return Response.json({ page: { slug: page.slug, title: page.title, description: page.description, version: page.version, updatedAt: page.updatedAt, context: page.document ? documentContext(page.document) : null } }, { headers: { "Cache-Control": "private, no-store" } });
  }
  return Response.json({ page: resolved.page }, { headers: { "Cache-Control": "private, no-store" } });
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

  let json: unknown;
  try { json = await readJson(req); } catch { return badRequest("Invalid JSON or request exceeds 320 KiB."); }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("The request body did not match the expected shape.", {
      errors: parsed.error.issues,
    });
  }
  const data = parsed.data;
  if (page.document && data.body !== undefined) return badRequest("This is a structured page. Update document instead of body.");
  if ((page.document || data.document) && data.expectedVersion === undefined) return badRequest("Structured updates require expectedVersion from the latest page response.");

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
      document: data.document,
      status: data.status,
      tags: data.tags,
      sectionId,
    },
    "human",
    data.expectedVersion,
  );

  if (!updated) return conflict("Page changed since it was read. Fetch the latest version before editing.");

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
