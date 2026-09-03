import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces, workspaceMembers } from "@/db/schema";

export type Role = "owner" | "editor" | "viewer";

// v1 is a single-workspace deployment (multi-workspace switching is out of
// scope per BUILD.md §14), so "the workspace" is the first and only row.
export async function getWorkspace() {
  return db.query.workspaces.findFirst();
}

/**
 * Bootstrap rule: the first person to sign in creates the workspace and
 * becomes its owner. Everyone after that joins as a viewer — least
 * privilege, with the owner promoting them deliberately.
 */
export async function attachUserToWorkspace(userId: string) {
  let workspace = await getWorkspace();

  if (!workspace) {
    [workspace] = await db
      .insert(workspaces)
      .values({ slug: "main", name: "Workspace" })
      .returning();
  }

  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspace.id));

  const role: Role = memberCount === 0 ? "owner" : "viewer";

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId, role })
    .onConflictDoNothing();

  return role;
}

/** Whether a brand-new email is allowed to create an account right now. */
export async function registrationAllowed() {
  const workspace = await getWorkspace();
  // No workspace yet means nobody has signed in — the first user must be
  // able to get in regardless of any later setting.
  if (!workspace) return true;
  return workspace.registrationOpen;
}

export async function getMembership(userId: string) {
  return db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, userId),
  });
}

export function canEdit(role: Role | undefined) {
  return role === "owner" || role === "editor";
}

export function isOwner(role: Role | undefined) {
  return role === "owner";
}
