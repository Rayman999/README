import { z } from "zod";
import { requireSession } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { deleteHighlight, updateHighlightNote } from "@/lib/reading/server";

const patchSchema = z.object({ note: z.string().trim().max(4000).nullable() });

async function context(params: Promise<{ id: string }>) {
  const session = await requireSession();
  const { id } = await params;
  return { userId: session?.user.id, id, validId: z.uuid().safeParse(id).success };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, id, validId } = await context(params);
  if (!userId) return unauthorized("Sign in to edit notes.");
  if (!validId) return notFound("No such highlight.");
  const parsed = patchSchema.safeParse(await readJson(req, 16 * 1024).catch(() => null));
  if (!parsed.success) return badRequest("The note did not match the expected shape.", { errors: parsed.error.issues });
  if (!(await updateHighlightNote(userId, id, parsed.data.note))) return notFound("No such highlight.");
  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, id, validId } = await context(params);
  if (!userId) return unauthorized("Sign in to remove highlights.");
  if (!validId || !(await deleteHighlight(userId, id))) return notFound("No such highlight.");
  return new Response(null, { status: 204 });
}
