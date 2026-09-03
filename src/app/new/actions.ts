"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getWorkspace } from "@/lib/workspace";
import { slugify, validateParent } from "@/lib/projects";

export type NewProjectState = { error?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120),
  summary: z
    .string()
    .trim()
    .min(1, "Write a one or two sentence summary.")
    .max(400),
  status: z.enum(["active", "maintenance", "archived", "planned"]),
  parentId: z.string().uuid().optional().or(z.literal("")),
  repositoryUrl: z.string().url().optional().or(z.literal("")),
});

export async function createProject(
  _prev: NewProjectState,
  formData: FormData,
): Promise<NewProjectState> {
  const session = await auth();
  if (!session?.user) return { error: "You are not signed in." };
  if (session.user.role !== "owner" && session.user.role !== "editor") {
    return { error: "You need editor access to create a project." };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    summary: formData.get("summary"),
    status: formData.get("status"),
    parentId: formData.get("parentId") ?? "",
    repositoryUrl: formData.get("repositoryUrl") ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const workspace = await getWorkspace();
  if (!workspace) return { error: "No workspace exists yet." };

  const slug = slugify(parsed.data.name);
  if (!slug) {
    return { error: "That name produces an empty slug. Use letters or digits." };
  }

  const clash = await db.query.projects.findFirst({
    where: and(
      eq(projects.workspaceId, workspace.id),
      eq(projects.slug, slug),
    ),
  });
  if (clash) {
    return { error: `A project with the slug "${slug}" already exists.` };
  }

  if (parsed.data.parentId) {
    const problem = await validateParent(parsed.data.parentId);
    if (problem) return { error: problem };
  }

  await db.insert(projects).values({
    workspaceId: workspace.id,
    slug,
    name: parsed.data.name,
    summary: parsed.data.summary,
    status: parsed.data.status,
    parentId: parsed.data.parentId || null,
    repositoryUrl: parsed.data.repositoryUrl || null,
  });

  redirect(`/p/${slug}`);
}
