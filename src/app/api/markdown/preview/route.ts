import { z } from "zod";
import { requireSession } from "@/lib/api/context";
import { badRequest, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { renderMarkdown } from "@/lib/markdown/render";

const schema = z.strictObject({ markdown: z.string().max(200000) });

export async function POST(request: Request) {
  if (!(await requireSession())) return unauthorized("Sign in to preview Markdown.");
  let input: unknown;
  try { input = await readJson(request); } catch { return badRequest("Invalid preview request."); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return badRequest("Markdown is too large to preview.");
  const { html } = await renderMarkdown(parsed.data.markdown);
  return Response.json({ html }, { headers: { "Cache-Control": "private, no-store" } });
}
