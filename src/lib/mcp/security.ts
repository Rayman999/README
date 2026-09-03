import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const SCOPES = ["docs:read", "docs:write"] as const;
export const secret = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const challengeFor = (value: string) => createHash("sha256").update(value).digest("base64url");
export function matchesSecret(value: string, hash: string) {
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(digest(value), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function issuer() {
  const url = new URL(process.env.AUTH_URL ?? "http://localhost:3100");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("AUTH_URL must use HTTPS in production.");
  return url.origin;
}
export const resource = () => `${issuer()}/api/mcp`;

export const CLIENT_TYPES = ["confidential", "public"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

// Literal loopback addresses only. "localhost" is deliberately excluded: it is
// a name, and what it resolves to is outside this server's control (hosts file,
// DNS search domains, IPv4/IPv6 preference), so it cannot be trusted to mean
// "this machine" the way an IP literal can. RFC 8252 section 7.3 recommends the
// literals for exactly this reason.
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);

/**
 * Parses a callback URL and rejects the shapes that make redirect matching
 * unsafe regardless of scheme. WHATWG parsing also normalises the host, so
 * obfuscations such as `http://2130706433/` or `http://[0:0:0:0:0:0:0:1]/`
 * collapse to their literal form before comparison, and a deceptive host like
 * `http://127.0.0.1.evil.test/` keeps its real hostname and fails the check.
 */
function parseRedirect(value: string): URL | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.username || url.password || url.hash) return null;
  return url;
}

export function isLoopbackRedirect(url: URL) {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

export const redirectUriSchema = z.string().max(2048).url().refine((value) => {
  const url = parseRedirect(value);
  return url !== null && url.protocol === "https:";
}, "Use the exact HTTPS callback URL shown by your agent app (no fragment or credentials).");

// Native and CLI agents receive their callback on the loopback interface, which
// cannot hold a TLS certificate. HTTP is therefore permitted here and nowhere
// else. A registered loopback URI carries no query of its own: the callback
// only ever receives the code, state and iss parameters this server appends.
export const loopbackRedirectUriSchema = z.string().max(2048).url().refine((value) => {
  const url = parseRedirect(value);
  return url !== null && isLoopbackRedirect(url) && url.search === "";
}, "Loopback callbacks must be http://127.0.0.1/... or http://[::1]/... with no query, fragment or credentials.");

/** Either form. Which one a given client may actually use is decided by
 *  redirectUriMatches against what that client registered. */
export const anyRedirectUriSchema = z.union([redirectUriSchema, loopbackRedirectUriSchema]);

/**
 * Redirect matching.
 *
 * Confidential clients keep exact string matching, unchanged: the ChatGPT
 * connection resolves entirely through the first line here.
 *
 * Public clients additionally get the loopback rule from RFC 8252 section 7.3 —
 * scheme, host and path must match exactly and only the port may vary. Codex
 * binds an ephemeral port chosen by the operating system at login time, so the
 * port genuinely cannot be known at registration. Nothing else is relaxed: a
 * non-loopback HTTP URI, a different host, or a different path all fail.
 */
export function redirectUriMatches(
  registered: readonly string[],
  candidate: string,
  clientType: ClientType,
) {
  if (registered.includes(candidate)) return true;
  if (clientType !== "public") return false;

  const target = parseRedirect(candidate);
  if (!target || !isLoopbackRedirect(target) || target.search !== "") return false;

  return registered.some((entry) => {
    const allowed = parseRedirect(entry);
    return (
      allowed !== null &&
      isLoopbackRedirect(allowed) &&
      allowed.search === "" &&
      allowed.hostname === target.hostname &&
      allowed.pathname === target.pathname
    );
  });
}

export const clientInput = z.object({
  name: z.string().trim().min(1).max(80),
  clientType: z.enum(CLIENT_TYPES).default("confidential"),
  redirectUris: z.array(z.string().max(2048)).min(1).max(5),
  scopes: z.array(z.enum(SCOPES)).min(1).max(2).refine((s) => s.includes("docs:read")),
}).strict().superRefine((value, ctx) => {
  const schema = value.clientType === "public" ? anyRedirectUriSchema : redirectUriSchema;
  value.redirectUris.forEach((uri, index) => {
    const result = schema.safeParse(uri);
    if (!result.success) {
      ctx.addIssue({ code: "custom", path: ["redirectUris", index], message: result.error.issues[0].message });
    }
  });
});

export const authorizationInput = z.object({
  response_type: z.literal("code"),
  client_id: z.string().uuid(),
  redirect_uri: anyRedirectUriSchema,
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  scope: z.string().max(100).default("docs:read"),
  state: z.string().min(1).max(2048),
  // RFC 8707. Codex only sends this when oauth_resource is configured, so it is
  // optional at the schema level; requireResource below still demands it from
  // confidential clients, leaving the ChatGPT flow exactly as strict as before.
  resource: z.string().max(2048).optional(),
});

/**
 * There is exactly one protected resource in this deployment, so an omitted
 * resource indicator is unambiguous rather than a licence to redirect a token
 * elsewhere. It is accepted only from public clients; a supplied value must
 * always match, whoever sent it.
 */
export function resourceAccepted(value: string | undefined, clientType: ClientType) {
  if (value === undefined) return clientType === "public";
  return value === resource();
}

export function parseScopes(value: string) {
  const scopes = [...new Set(value.split(" ").filter(Boolean))];
  if (!scopes.includes("docs:read") || scopes.some((s) => !SCOPES.includes(s as typeof SCOPES[number]))) throw new Error("Invalid scopes.");
  return scopes;
}

// Only these local destinations can survive a login round-trip.
export function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || value.length > 8192) return "/";
  if (value === "/connections" || value.startsWith("/oauth/authorize?")) return value;
  return "/";
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache", ...headers } });
}

// Supplemental per-process ceiling for unauthenticated endpoints. Authenticated
// MCP limits live in PostgreSQL so multiple replicas cannot bypass them.
const bursts = new Map<string, { until: number; count: number }>();
export function allowPublicRequest(bucket: string, limit = 120) {
  const now = Date.now();
  const entry = bursts.get(bucket);
  if (!entry || entry.until <= now) { bursts.set(bucket, { until: now + 60_000, count: 1 }); return true; }
  return ++entry.count <= limit;
}
