"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  countOwners,
  getMembership,
  getWorkspace,
  isOwner,
  removeMember,
  setMemberRole,
  setRegistrationOpen,
  type Role,
} from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Every admin action re-derives the caller's role from the database rather
 * than trusting the role carried in the session token. A token minted before
 * a demotion stays valid until it expires, so the session says who is asking,
 * never what they may do.
 */
type OwnerCheck =
  | { ok: false; error: string }
  | { ok: true; userId: string; workspaceId: string };

async function requireOwner(): Promise<OwnerCheck> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You are not signed in." };

  const workspace = await getWorkspace();
  if (!workspace) return { ok: false, error: "No workspace exists yet." };

  const membership = await getMembership(userId);
  if (!isOwner(membership?.role)) {
    return { ok: false, error: "Only a workspace owner can do that." };
  }

  return { ok: true, userId, workspaceId: workspace.id };
}

const roleSchema = z.enum(["owner", "editor", "viewer"]);

export async function changeMemberRole(
  targetUserId: string,
  role: Role,
): Promise<ActionResult> {
  const caller = await requireOwner();
  if (!caller.ok) return caller;

  if (!roleSchema.safeParse(role).success) {
    return { ok: false, error: "That is not a valid role." };
  }

  // Changing your own role is refused outright rather than merely counted
  // against the owner total. An owner demoting themselves while another owner
  // exists is survivable, but it is never what someone means to click, and
  // the page they are standing on disappears underneath them when it happens.
  if (targetUserId === caller.userId) {
    return {
      ok: false,
      error: "You cannot change your own role. Ask another owner.",
    };
  }

  const target = await getMembership(targetUserId);
  if (!target || target.workspaceId !== caller.workspaceId) {
    return { ok: false, error: "That person is not in this workspace." };
  }

  // Demoting the last owner would leave nobody able to administer the
  // workspace, with no way back short of editing the database by hand.
  if (target.role === "owner" && role !== "owner") {
    if ((await countOwners(caller.workspaceId)) <= 1) {
      return {
        ok: false,
        error: "This is the only owner. Promote someone else first.",
      };
    }
  }

  await setMemberRole(caller.workspaceId, targetUserId, role);
  revalidatePath("/profile");
  return { ok: true };
}

export async function removeWorkspaceMember(
  targetUserId: string,
): Promise<ActionResult> {
  const caller = await requireOwner();
  if (!caller.ok) return caller;

  if (targetUserId === caller.userId) {
    return { ok: false, error: "You cannot remove yourself." };
  }

  const target = await getMembership(targetUserId);
  if (!target || target.workspaceId !== caller.workspaceId) {
    return { ok: false, error: "That person is not in this workspace." };
  }

  if (target.role === "owner" && (await countOwners(caller.workspaceId)) <= 1) {
    return {
      ok: false,
      error: "This is the only owner. Promote someone else first.",
    };
  }

  await removeMember(caller.workspaceId, targetUserId);
  revalidatePath("/profile");
  return { ok: true };
}

export async function changeRegistration(open: boolean): Promise<ActionResult> {
  const caller = await requireOwner();
  if (!caller.ok) return caller;

  await setRegistrationOpen(caller.workspaceId, open);
  revalidatePath("/profile");
  revalidatePath("/login");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Own account
// ---------------------------------------------------------------------------

const nameSchema = z.string().trim().min(1, "Enter a name.").max(120);

export async function changeOwnName(name: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You are not signed in." };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await db
    .update(users)
    .set({ name: parsed.data })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true };
}

// A profile picture is stored inline on the user row as a data URL rather than
// on disk or in object storage. The container has no persistent volume, so a
// file written to the filesystem would vanish on the next deploy; the browser
// crops and re-encodes to 256x256 before upload, which keeps a picture in the
// tens of kilobytes. The ceiling below is the backstop for anything that
// arrives without having gone through that path.
const MAX_AVATAR_BYTES = 400_000;
const AVATAR_PREFIX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export async function changeOwnAvatar(dataUrl: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You are not signed in." };

  if (!AVATAR_PREFIX.test(dataUrl)) {
    return { ok: false, error: "That is not a PNG, JPEG or WebP image." };
  }
  if (dataUrl.length > MAX_AVATAR_BYTES) {
    return { ok: false, error: "That picture is too large. Try a smaller one." };
  }

  await db
    .update(users)
    .set({ image: dataUrl })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true };
}

export async function removeOwnAvatar(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You are not signed in." };

  await db
    .update(users)
    .set({ image: null })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true };
}

const passwordSchema = z
  .string()
  .min(8, "New password must be at least 8 characters.")
  .max(200);

export async function changeOwnPassword(
  current: string,
  next: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You are not signed in." };

  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const account = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!account) return { ok: false, error: "Account not found." };

  // A GitHub-only account has no password to replace, and letting it set one
  // here would quietly add a second way in that nobody chose.
  if (!account.passwordHash) {
    return {
      ok: false,
      error: "This account signs in with GitHub and has no password.",
    };
  }

  if (!(await bcrypt.compare(current, account.passwordHash))) {
    return { ok: false, error: "Your current password is not correct." };
  }

  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(parsed.data, 10) })
    .where(eq(users.id, session.user.id));

  return { ok: true };
}
