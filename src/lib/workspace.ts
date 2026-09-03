import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users, workspaces, workspaceMembers } from "@/db/schema";

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

// ---------------------------------------------------------------------------
// Membership administration — owner-only surface, backing /profile.
// ---------------------------------------------------------------------------

export type Member = {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  joinedAt: Date;
  /** Which sign-in methods this account can actually use. */
  hasPassword: boolean;
  providers: string[];
};

/**
 * Everyone in the workspace, owners first, then editors, then viewers, and
 * alphabetically within a role — so the people who can change things sit at
 * the top of the list rather than being scattered through it.
 */
export async function listMembers(workspaceId: string): Promise<Member[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: workspaceMembers.role,
      joinedAt: users.createdAt,
      passwordHash: users.passwordHash,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const linked = await db
    .select({ userId: accounts.userId, provider: accounts.provider })
    .from(accounts);

  const providersByUser = new Map<string, string[]>();
  for (const row of linked) {
    providersByUser.set(row.userId, [
      ...(providersByUser.get(row.userId) ?? []),
      row.provider,
    ]);
  }

  const rank: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

  return rows
    .map((row) => ({
      userId: row.userId,
      email: row.email,
      name: row.name,
      image: row.image,
      role: row.role,
      joinedAt: row.joinedAt,
      hasPassword: row.passwordHash !== null,
      providers: providersByUser.get(row.userId) ?? [],
    }))
    .sort(
      (a, b) =>
        rank[a.role] - rank[b.role] ||
        (a.name ?? a.email).localeCompare(b.name ?? b.email),
    );
}

/** How many owners the workspace has — the guard against locking everyone out. */
export async function countOwners(workspaceId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "owner"),
      ),
    );
  return value;
}

export async function setMemberRole(
  workspaceId: string,
  userId: string,
  role: Role,
) {
  await db
    .update(workspaceMembers)
    .set({ role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    );
}

/**
 * Drops the membership row but keeps the user. The jwt callback re-checks
 * membership on every request, so an active session dies on the next one.
 */
export async function removeMember(workspaceId: string, userId: string) {
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    );
}

export async function setRegistrationOpen(workspaceId: string, open: boolean) {
  await db
    .update(workspaces)
    .set({ registrationOpen: open })
    .where(eq(workspaces.id, workspaceId));
}
