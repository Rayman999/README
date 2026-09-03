import { auth } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import type { Role } from "@/lib/workspace";

/**
 * Session auth for the UI and its REST routes. Agent OAuth is deliberately
 * isolated to /api/mcp and src/lib/mcp/oauth.ts; an agent token does not grant
 * access to member administration or the broader session-authenticated API.
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
