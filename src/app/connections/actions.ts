"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
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

export type ClientState = { error?: string; clientId?: string; clientSecret?: string };
export async function createClient(_previous: ClientState, form: FormData): Promise<ClientState> {
  const member = await currentMember();
  if (member.role !== "owner") return { error: "Only owners can register agent apps." };
  try {
    const existing = await db.select({ id: oauthClients.id }).from(oauthClients).where(eq(oauthClients.workspaceId, member.workspaceId)).limit(51);
    if (existing.length >= 50) return { error: "Client limit reached. Contact the server administrator." };
    const result = await registerClient(member.workspaceId, {
      name: form.get("name"),
      redirectUris: String(form.get("redirectUris") ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      scopes: form.get("write") === "on" ? ["docs:read", "docs:write"] : ["docs:read"],
    });
    revalidatePath("/connections");
    return result;
  } catch (error) {
    return { error: error instanceof z.ZodError ? error.issues[0].message : "Could not create the client. Try again." };
  }
}

export async function revokeConnection(form: FormData) {
  const member = await currentMember();
  const id = z.string().uuid().parse(form.get("id"));
  await db.update(oauthGrants).set({ revokedAt: new Date() }).where(and(eq(oauthGrants.id, id), eq(oauthGrants.workspaceId, member.workspaceId), member.role === "owner" ? undefined : eq(oauthGrants.userId, member.userId)));
  revalidatePath("/connections");
}

export async function disableClient(form: FormData) {
  const member = await currentMember();
  if (member.role !== "owner") throw new Error("Owner access required.");
  const id = z.string().uuid().parse(form.get("id"));
  await db.update(oauthClients).set({ revokedAt: new Date() }).where(and(eq(oauthClients.id, id), eq(oauthClients.workspaceId, member.workspaceId)));
  revalidatePath("/connections");
}
