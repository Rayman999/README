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

export const redirectUriSchema = z.string().max(2048).url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.hash;
}, "Use the exact HTTPS callback URL shown by your agent app (no fragment or credentials).");

export const clientInput = z.object({
  name: z.string().trim().min(1).max(80),
  redirectUris: z.array(redirectUriSchema).min(1).max(5),
  scopes: z.array(z.enum(SCOPES)).min(1).max(2).refine((s) => s.includes("docs:read")),
}).strict();

export const authorizationInput = z.object({
  response_type: z.literal("code"),
  client_id: z.string().uuid(),
  redirect_uri: redirectUriSchema,
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  scope: z.string().max(100).default("docs:read"),
  state: z.string().min(1).max(2048),
  resource: z.string().max(2048),
});

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
