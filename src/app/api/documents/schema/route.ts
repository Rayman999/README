import { z } from "zod";
import { requireSession } from "@/lib/api/context";
import { unauthorized } from "@/lib/api/problem";
import { documentSchema, starterDocument, MAX_DOCUMENT_BYTES } from "@/lib/documents/schema";

export async function GET() {
  if (!(await requireSession())) return unauthorized("Sign in to discover the document schema.");
  return Response.json({
    schemaVersion: 1,
    theme: "README — appearance is enforced by the renderer; do not supply HTML, CSS, scripts, or colours.",
    limits: { documentBytes: MAX_DOCUMENT_BYTES, requestBytes: 320 * 1024, blocks: 80, chartPoints: 40 },
    instructions: [
      "Read project context before writing. Fetch only relevant page context, then full content if needed.",
      "Supply a concise summary, verified key facts, relevant code paths, related page slugs, and unresolved questions.",
      "Save the summary and blocks together. Use draft status until reviewed. Label illustrative chart data explicitly.",
      "Chart values must be finite and non-negative; rows in a table must match its column count.",
      "PATCH requires expectedVersion for structured pages. On 409, reread and reconcile; do not blindly retry.",
      "Strings are plain text. Use the supported block types for layout. Nested blocks and arbitrary links are not supported in v1.",
    ],
    schema: z.toJSONSchema(documentSchema),
    example: starterDocument,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
