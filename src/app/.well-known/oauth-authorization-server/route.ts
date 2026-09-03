import { issuer, jsonResponse, SCOPES } from "@/lib/mcp/security";

export async function GET() {
  const base = issuer();
  return jsonResponse({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // "none" advertises that pre-registered public clients (Codex and other
    // native apps) may authenticate with PKCE alone. Client ID metadata
    // documents are deliberately not advertised and dynamic registration is
    // not offered, so a client must still be registered by an owner by hand.
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    revocation_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: SCOPES,
    authorization_response_iss_parameter_supported: true,
  });
}
