import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { auth, signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getWorkspace } from "@/lib/workspace";
import { LoginForm } from "./LoginForm";
import { safeReturnTo } from "@/lib/mcp/security";

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
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const { error, returnTo: requestedReturn } = await searchParams;
  const returnTo = safeReturnTo(requestedReturn);
  const session = await auth();
  if (session?.user) redirect(returnTo);

  const errorMessage = error ? (ERRORS[error] ?? ERRORS.Default) : null;

  const githubConfigured = Boolean(
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
  );

  let isFirstUser = false;
  let registrationClosed = false;
  let workspaceName: string | null = null;
  try {
    const [{ value }] = await db.select({ value: count() }).from(users);
    isFirstUser = value === 0;
    const workspace = await getWorkspace();
    registrationClosed = Boolean(workspace && !workspace.registrationOpen);
    workspaceName = workspace?.name ?? null;
  } catch {
    // Database unreachable — still render the form rather than erroring out.
  }

  // "Workspace" is the placeholder name the bootstrap assigns, so naming it
  // back at someone reads as a bug rather than as a greeting.
  const named = workspaceName && workspaceName !== "Workspace";

  async function githubAction() {
    "use server";
    await signIn("github", { redirectTo: returnTo });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="stagger w-full max-w-[392px]">
        <div className="flex flex-col items-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-border-visible bg-white/[0.035] text-tertiary">
            <svg
              width="17"
              height="17"
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
          <h1 className="mt-4 text-[20px] leading-tight font-semibold text-heading">
            {named ? workspaceName : "readme"}
          </h1>
          <p className="mt-1.5 text-center text-[13.5px] text-secondary">
            {named
              ? "Documentation, written by agents and humans alike."
              : "Your documentation workspace."}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-7 rounded-code border border-border-subtle bg-white/[0.022] px-4 py-3 text-[13px] leading-relaxed text-secondary"
            style={{ borderLeft: "2px solid #8A6A62" }}
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-7">
          <LoginForm
            returnTo={returnTo}
            githubAction={githubAction}
            githubConfigured={githubConfigured}
            isFirstUser={isFirstUser}
            signUpAllowed={isFirstUser || !registrationClosed}
          />
        </div>

        {registrationClosed && !isFirstUser && (
          <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted">
            Sign-up is closed. Ask an owner for an account.
          </p>
        )}

        {/* Configuration guidance belongs to whoever is running the app, not
            to whoever is signing in — so it stops at the dev build. */}
        {!githubConfigured && process.env.NODE_ENV !== "production" && (
          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
            GitHub sign-in is hidden until{" "}
            <code className="inline-code text-[10.5px]">AUTH_GITHUB_ID</code>{" "}
            and{" "}
            <code className="inline-code text-[10.5px]">
              AUTH_GITHUB_SECRET
            </code>{" "}
            are set.
          </p>
        )}
      </div>
    </main>
  );
}
