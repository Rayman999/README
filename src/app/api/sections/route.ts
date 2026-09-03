import { z } from "zod";
import { canWrite, requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, conflict, notFound, unauthorized } from "@/lib/api/problem";
import {
  createSection,
  getProjectBySlug,
  getSectionBySlug,
  listSections,
} from "@/lib/projects";
import { slugify } from "@/lib/slug";

const createSchema = z.object({
  project: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(96).optional(),
});

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to view sections.");

  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");

  const projectSlug = new URL(req.url).searchParams.get("project");
  if (!projectSlug) return badRequest("Pass ?project=<slug>.");

  const project = await getProjectBySlug(workspace.id, projectSlug);
  if (!project) return notFound(`No project with slug "${projectSlug}".`);

  const sections = await listSections(project.id);
  return Response.json({ sections });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to create sections.");
  if (!canWrite(session.user.role)) {
    return unauthorized("You need editor access to create sections.");
  }

  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("The request body did not match the expected shape.", {
      errors: parsed.error.issues,
    });
  }
  const data = parsed.data;

  const project = await getProjectBySlug(workspace.id, data.project);
  if (!project) return notFound(`No project with slug "${data.project}".`);

  const slug = slugify(data.slug ?? data.title);
  if (!slug) return badRequest("The title or slug produced an empty slug.");

  if (await getSectionBySlug(project.id, slug)) {
    return conflict(`A section with the slug "${slug}" already exists in this project.`);
  }

  const section = await createSection({ projectId: project.id, slug, title: data.title });
  return Response.json({ section }, { status: 201 });
}
