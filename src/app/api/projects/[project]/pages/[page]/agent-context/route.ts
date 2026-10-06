import { requireSession, requireWorkspace } from "@/lib/api/context";
import { notFound, unauthorized } from "@/lib/api/problem";
import { buildPageExport } from "@/lib/agent-export";

/** The page as Markdown with AI-ready framing, for "Copy for AI". */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ project: string; page: string }> },
) {
  if (!(await requireSession())) return unauthorized("Sign in to copy documentation.");
  const workspace = await requireWorkspace();
  if (!workspace) return notFound("No workspace exists yet.");
  const { project, page } = await params;
  const text = await buildPageExport(workspace.id, project, page);
  if (!text) return notFound("No such page.");
  return new Response(text, {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
  });
}
