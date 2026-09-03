import { z } from "zod";
import { canWrite, requireSession } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import { updateSection } from "@/lib/projects";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  position: z.number().int().min(0).optional(),
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

  const section = await updateSection(id, parsed.data);
  if (!section) return notFound(`No section with id "${id}".`);

  return Response.json({ section });
}
