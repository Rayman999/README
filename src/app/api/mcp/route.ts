import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { readJson } from "@/lib/api/read-json";
import { authenticateBearer, consumeRate, OAuthError } from "@/lib/mcp/oauth";
import { allowPublicRequest, issuer, jsonResponse } from "@/lib/mcp/security";
import { createMcpServer } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== issuer()) return jsonResponse({ error: "Invalid origin" }, 403);
  if (!allowPublicRequest("mcp", 600)) return jsonResponse({ error: "Rate limit reached" }, 429, { "Retry-After": "60" });
  try {
    const ctx = await authenticateBearer(req.headers.get("authorization"));
    await consumeRate(ctx);
    if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
    let parsedBody: unknown;
    try { parsedBody = await readJson(req); }
    catch { return jsonResponse({ error: "Invalid or oversized JSON body (maximum 320 KiB)." }, 400); }
    // No JSON-RPC batches: one operation per request keeps rate limits honest.
    if (Array.isArray(parsedBody)) return jsonResponse({ error: "Batch requests are not supported." }, 400);
    const server = createMcpServer(ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(req, { parsedBody });
      response.headers.set("Cache-Control", "no-store");
      return response;
    } finally { await server.close(); }
  } catch (error) {
    if (error instanceof OAuthError && error.status === 401) return jsonResponse({ error: "Unauthorized" }, 401, { "WWW-Authenticate": `Bearer resource_metadata="${issuer()}/.well-known/oauth-protected-resource/api/mcp", error="invalid_token"` });
    if (error instanceof OAuthError && error.status === 429) return jsonResponse({ error: "Rate limit reached" }, 429, { "Retry-After": "60" });
    return jsonResponse({ error: "MCP temporarily unavailable" }, 503);
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
