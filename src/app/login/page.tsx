import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { auth, signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getWorkspace } from "@/lib/workspace";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  RegistrationClosed:
    "Registration is closed for this workspace. Ask an owner to add you.",
  OAuthAccountNotLinked:
    "That email is already registered with a password. Sign in with it instead.",
  OAuthSignin: "Could not reach GitHub. Check the OAuth configuration.",
  OAuthCallback: "GitHub sign-in failed. Check the OAuth configuration.",
  Default: "Something went wrong signing in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;
  const errorMessage = error ? (ERRORS[error] ?? ERRORS.Default) : null;

  const githubConfigured = Boolean(
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
  );

  let isFirstUser = false;
  let registrationClosed = false;
  try {
    const [{ value }] = await db.select({ value: count() }).from(users);
    isFirstUser = value === 0;
    const workspace = await getWorkspace();
    registrationClosed = Boolean(workspace && !workspace.registrationOpen);
  } catch {
    // Database unreachable — still render the form rather than erroring out.
  }

  async function githubAction() {
    "use server";
    await signIn("github", { redirectTo: "/" });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border-visible bg-white/[0.03] text-tertiary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5zM9.5 1.5V5H13" />
            </svg>
          </span>
          <h1 className="mt-4 text-[19px] font-semibold text-heading">readme</h1>
          <p className="mt-1.5 text-center text-[13.5px] text-secondary">
            {isFirstUser
              ? "Nobody has signed in yet — you'll become the workspace owner."
              : "Sign in to your documentation workspace."}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 rounded-code border border-border-subtle bg-white/[0.022] px-4 py-3 text-[13px] text-secondary"
            style={{ borderLeft: "2px solid #8A6A62" }}
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6">
          <LoginForm
            githubAction={githubAction}
            githubConfigured={githubConfigured}
            isFirstUser={isFirstUser}
            signUpAllowed={isFirstUser || !registrationClosed}
          />
        </div>

        {registrationClosed && !isFirstUser && (
          <p className="mt-4 text-center text-[11.5px] text-muted">
            Registration is closed. Existing members can still sign in.
          </p>
        )}
      </div>
    </main>
  );
}
