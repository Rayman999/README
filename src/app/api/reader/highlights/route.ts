import { z } from "zod";
import { requireSession, requireWorkspace } from "@/lib/api/context";
import { badRequest, notFound, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { createHighlight, findReadablePage } from "@/lib/reading/server";

const postSchema = z.object({
  pageId: z.uuid(),
  quote: z.string().min(1).max(4000),
  prefix: z.string().max(64),
  suffix: z.string().max(64),
  note: z.string().trim().max(4000).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session?.user.id) return unauthorized("Sign in to highlight.");
  const parsed = postSchema.safeParse(await readJson(req, 16 * 1024).catch(() => null));
  if (!parsed.success) return badRequest("The highlight did not match the expected shape.", { errors: parsed.error.issues });

  const workspace = await requireWorkspace();
  if (!workspace || !(await findReadablePage(workspace.id, parsed.data.pageId))) return notFound("No such page.");

  const { pageId, ...input } = parsed.data;
  const highlight = await createHighlight(session.user.id, pageId, input);
  return Response.json({ highlight }, { status: 201 });
}
