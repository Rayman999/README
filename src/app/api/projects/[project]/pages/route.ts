import { z } from "zod";
import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, conflict, notFound, unauthorized } from "@/lib/api/problem";
import {
  createPage,
  getPageBySlug,
  getProjectBySlug,
  getSectionBySlug,
  listPageMetadata,
} from "@/lib/projects";
import { slugify } from "@/lib/slug";
import { documentSchema } from "@/lib/documents/schema";
import { readJson } from "@/lib/api/read-json";

const createSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(300),
  body: z.string().max(200000).optional(), // legacy Markdown
  document: documentSchema.optional(),
  slug: z.string().trim().min(1).max(96).optional(),
  section: z.string().trim().min(1).max(96).nullish(),
  status: z.enum(["draft", "stable", "deprecated"]).optional(),
  tags: z.array(z.string().max(80)).max(20).optional(),
}).refine((data) => (data.body !== undefined) !== (data.document !== undefined), { message: "Supply exactly one of body (legacy Markdown) or document (structured content)." });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to view this project's pages.");

  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");

  const { project: projectSlug } = await params;
  const project = await getProjectBySlug(workspace.id, projectSlug);
  if (!project) return notFound(`No project with slug "${projectSlug}".`);

  const pages = await listPageMetadata(project.id);
  return Response.json({ pages });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to create pages.");
  if (!canWrite(session.user.role)) {
    return unauthorized("You need editor access to create pages.");
  }

  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");

  const { project: projectSlug } = await params;
  const project = await getProjectBySlug(workspace.id, projectSlug);
  if (!project) return notFound(`No project with slug "${projectSlug}".`);

  let json: unknown;
  try { json = await readJson(req); } catch { return badRequest("Invalid JSON or request exceeds 320 KiB."); }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("The request body did not match the expected shape.", {
      errors: parsed.error.issues,
    });
  }
  const data = parsed.data;

  let sectionId: string | null = null;
  if (data.section) {
    const section = await getSectionBySlug(project.id, data.section);
    if (!section) {
      return badRequest(`No section with slug "${data.section}" on this project.`);
    }
    sectionId = section.id;
  }

  const slug = slugify(data.slug ?? data.title);
  if (!slug) {
    return badRequest("The title or slug produced an empty slug.");
  }
  if (await getPageBySlug(project.id, slug)) {
    return conflict(`A page with the slug "${slug}" already exists in this project.`);
  }

  const page = await createPage({
    projectId: project.id,
    sectionId,
    slug,
    title: data.title,
    description: data.description,
    body: data.body ?? "",
    document: data.document,
    status: data.status,
    tags: data.tags,
    authorType: "human",
  });

  return Response.json({ page }, { status: 201 });
}
