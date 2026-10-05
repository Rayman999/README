import { z } from "zod";
import { requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { findReadablePage, saveProgress } from "@/lib/reading/server";

const putSchema = z.object({
  progress: z.number().min(0).max(1),
  y: z.number().int().min(0).max(10_000_000),
  done: z.boolean(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const session = await requireSession();
  if (!session?.user.id) return unauthorized("Sign in to save reading progress.");
  const { pageId } = await params;
  if (!z.uuid().safeParse(pageId).success) return notFound("No such page.");

  const parsed = putSchema.safeParse(await readJson(req, 4 * 1024).catch(() => null));
  if (!parsed.success) return badRequest("Progress did not match the expected shape.", { errors: parsed.error.issues });

  const workspace = await requireWorkspace();
  if (!workspace || !(await findReadablePage(workspace.id, pageId))) return notFound("No such page.");

  await saveProgress(session.user.id, pageId, parsed.data);
  return new Response(null, { status: 204 });
}
