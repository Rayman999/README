import { issuer, jsonResponse, resource, SCOPES } from "@/lib/mcp/security";

export async function GET() {
  return jsonResponse({ resource: resource(), authorization_servers: [issuer()], scopes_supported: SCOPES, bearer_methods_supported: ["header"], resource_name: "README documentation" });
}
