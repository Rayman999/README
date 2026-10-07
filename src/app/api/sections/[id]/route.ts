import { z } from "zod";
import { canWrite, requireSession } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import { getSectionById, moveSection, updateSection } from "@/lib/projects";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(300).optional(),
  position: z.number().int().min(0).optional(),
  /** Move the folder under another folder, or null for the top level. */
  parentId: z.uuid().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorized("Sign in to rename or reorder sections.");
  if (!canWrite(session.user.role)) {
    return unauthorized("You need editor access to edit sections.");
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("The request body did not match the expected shape.", {
      errors: parsed.error.issues,
    });
  }

  const { parentId, ...rest } = parsed.data;
  if (parentId !== undefined) {
    const existing = await getSectionById(id);
    if (!existing) return notFound(`No section with id "${id}".`);
    const moved = await moveSection(existing.projectId, id, parentId);
    if ("error" in moved) return badRequest(moved.error);
    if (Object.keys(rest).length === 0) return Response.json({ section: moved.section });
  }

  const section = await updateSection(id, rest);
  if (!section) return notFound(`No section with id "${id}".`);

  return Response.json({ section });
}
