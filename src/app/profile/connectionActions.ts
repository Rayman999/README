"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { oauthClients, oauthGrants } from "@/db/schema";
import { getMembership } from "@/lib/workspace";
import { registerClient } from "@/lib/mcp/oauth";
import { issuer } from "@/lib/mcp/security";

async function currentMember() {
  if ((await headers()).get("origin") !== issuer()) throw new Error("Invalid request origin.");
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in first.");
  const member = await getMembership(session.user.id);
  if (!member) throw new Error("No workspace access.");
  return member;
}

export type ClientState = { error?: string; clientId?: string; clientSecret?: string; clientType?: "confidential" | "public" };
export async function createClient(_previous: ClientState, form: FormData): Promise<ClientState> {
  const member = await currentMember();
  if (member.role !== "owner") return { error: "Only owners can register agent apps." };
  try {
    const existing = await db.select({ id: oauthClients.id }).from(oauthClients).where(eq(oauthClients.workspaceId, member.workspaceId)).limit(51);
    if (existing.length >= 50) return { error: "Client limit reached. Contact the server administrator." };
    const result = await registerClient(member.workspaceId, {
      name: form.get("name"),
      clientType: form.get("clientType") === "public" ? "public" : "confidential",
      redirectUris: String(form.get("redirectUris") ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      scopes: form.get("write") === "on" ? ["docs:read", "docs:write"] : ["docs:read"],
    });
    revalidatePath("/profile");
    // A public client has no secret; the panel must not imply one was withheld.
    return { clientId: result.clientId, clientType: result.clientType, ...(result.clientSecret ? { clientSecret: result.clientSecret } : {}) };
  } catch (error) {
    return { error: error instanceof z.ZodError ? error.issues[0].message : "Could not create the client. Try again." };
  }
}

export async function revokeConnection(form: FormData) {
  const member = await currentMember();
  const id = z.string().uuid().parse(form.get("id"));
  // Everyone, owners included, can only see and revoke their own connections.
  // An owner who needs to cut an agent off for everyone disables the app.
  await db.update(oauthGrants).set({ revokedAt: new Date() }).where(and(eq(oauthGrants.id, id), eq(oauthGrants.workspaceId, member.workspaceId), eq(oauthGrants.userId, member.userId)));
  revalidatePath("/profile");
}

export async function disableClient(form: FormData) {
  const member = await currentMember();
  if (member.role !== "owner") throw new Error("Owner access required.");
  const id = z.string().uuid().parse(form.get("id"));
  await db.update(oauthClients).set({ revokedAt: new Date() }).where(and(eq(oauthClients.id, id), eq(oauthClients.workspaceId, member.workspaceId)));
  revalidatePath("/profile");
}

// Removing is only offered for apps that are already disabled, so it can never
// be the step that cuts an agent off. Their grants, codes and tokens go with
// them through the foreign-key cascade.
export async function removeClient(form: FormData) {
  const member = await currentMember();
  if (member.role !== "owner") throw new Error("Owner access required.");
  const id = z.string().uuid().parse(form.get("id"));
  await db.delete(oauthClients).where(and(eq(oauthClients.id, id), eq(oauthClients.workspaceId, member.workspaceId), isNotNull(oauthClients.revokedAt)));
  revalidatePath("/profile");
}

export async function removeDisabledClients() {
  const member = await currentMember();
  if (member.role !== "owner") throw new Error("Owner access required.");
  await db.delete(oauthClients).where(and(eq(oauthClients.workspaceId, member.workspaceId), isNotNull(oauthClients.revokedAt)));
  revalidatePath("/profile");
}

/** Clears your own revoked, expired and cut-off connections from the list. */
export async function clearPastConnections() {
  const member = await currentMember();
  const rows = await db
    .select({ id: oauthGrants.id, revokedAt: oauthGrants.revokedAt, expiresAt: oauthGrants.expiresAt, disabled: oauthClients.revokedAt })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .where(and(eq(oauthGrants.workspaceId, member.workspaceId), eq(oauthGrants.userId, member.userId)));
  const now = new Date();
  const past = rows.filter((row) => row.revokedAt || row.disabled || row.expiresAt <= now).map((row) => row.id);
  if (past.length) await db.delete(oauthGrants).where(and(inArray(oauthGrants.id, past), eq(oauthGrants.userId, member.userId)));
  revalidatePath("/profile");
}
