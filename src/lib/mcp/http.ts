import { readText } from "@/lib/api/read-json";
import { authenticateClient, OAuthError } from "./oauth";
import { allowPublicRequest, issuer, jsonResponse } from "./security";

export async function tokenRequest(req: Request) {
  if (!allowPublicRequest("oauth-token", 120)) throw new OAuthError("temporarily_unavailable", 429);
  const origin = req.headers.get("origin");
  if (origin && origin !== issuer()) throw new OAuthError("access_denied", 403);
  if (!req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new OAuthError("invalid_request");
  const params = new URLSearchParams(await readText(req, 16 * 1024));
  if ([...params.keys()].some((k) => params.getAll(k).length !== 1)) throw new OAuthError("invalid_request");
  const form = Object.fromEntries(params);
  let id = form.client_id ?? "";
  // Undefined means "no credential was presented", which is distinct from an
  // empty one. Public clients rely on that distinction; confidential clients
  // are rejected by either.
  let password: string | undefined = form.client_secret;
  const header = req.headers.get("authorization");
  if (header) {
    if (!header.startsWith("Basic ") || form.client_secret) throw new OAuthError("invalid_client", 401);
    const pair = Buffer.from(header.slice(6), "base64").toString("utf8");
    const colon = pair.indexOf(":");
    if (colon === -1) throw new OAuthError("invalid_client", 401);
    id = decodeURIComponent(pair.slice(0, colon));
    password = decodeURIComponent(pair.slice(colon + 1));
    if (form.client_id && form.client_id !== id) throw new OAuthError("invalid_client", 401);
  }
  const client = await authenticateClient(id, password);
  return { client, form };
}

export function oauthFailure(error: unknown) {
  if (error instanceof OAuthError) return jsonResponse({ error: error.code }, error.status, error.status === 401 ? { "WWW-Authenticate": "Basic realm=\"README OAuth\"" } : {});
  // No database details, query parameters or credentials in public responses.
  return jsonResponse({ error: "invalid_request" }, 400);
}
