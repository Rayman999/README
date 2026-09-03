import { auth } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import type { Role } from "@/lib/workspace";

/**
 * Session auth for the UI (BUILD.md §6 — "Session auth for the UI"). Bearer
 * token auth for agents/MCP is a separate slice (api_tokens table exists;
 * the verification path and MCP route are not built yet) — these routes are
 * reachable from the app today, and will accept a token too once that lands,
 * without changing this shape.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

export async function requireWorkspace() {
  return getWorkspace();
}

export function canWrite(role: Role | undefined) {
  return role === "owner" || role === "editor";
}
