"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { attachUserToWorkspace, registrationAllowed } from "@/lib/workspace";

export type FormState = { error?: string } | undefined;

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200),
});

export async function signInWithPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    // next-auth throws a redirect on success — let it through.
    if (error instanceof AuthError) {
      return { error: "That email and password combination is not correct." };
    }
    throw error;
  }
}

export async function signUpWithPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  if (!(await registrationAllowed())) {
    return {
      error: "Registration is closed. Ask a workspace owner to add you.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [created] = await db
    .insert(users)
    .values({ email, name: parsed.data.name, passwordHash })
    .returning();

  // Created directly rather than by the adapter, so the workspace hookup
  // that events.createUser normally performs has to happen here.
  await attachUserToWorkspace(created.id);

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try signing in." };
    }
    throw error;
  }
}
