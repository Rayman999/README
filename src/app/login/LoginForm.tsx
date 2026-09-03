"use client";

import { useActionState, useState } from "react";
import { signInWithPassword, signUpWithPassword, type FormState } from "./actions";

type Mode = "signin" | "signup";

const INPUT_CLASS =
  "ease-base shadow-inset-soft h-10 w-full rounded-input border border-border-visible bg-white/[0.02] px-3 text-[13.5px] text-primary transition-[background-color,border-color] duration-200 outline-none placeholder:text-muted hover:border-white/[0.09] focus:border-white/[0.14] focus:bg-white/[0.035]";

const LABEL_CLASS = "mb-1.5 block text-[12px] font-medium text-tertiary";

export function LoginForm({
  githubAction,
  githubConfigured,
  isFirstUser,
}: {
  githubAction: () => Promise<void>;
  githubConfigured: boolean;
  isFirstUser: boolean;
}) {
  const [mode, setMode] = useState<Mode>(isFirstUser ? "signup" : "signin");
  const [showPassword, setShowPassword] = useState(false);

  const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined,
  );

  return (
    <div className="auth-panel p-6">
      {/* Mode toggle */}
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="mb-5 grid grid-cols-2 gap-1 rounded-control border border-border-subtle bg-black/20 p-1"
      >
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`ease-base h-8 rounded-[6px] text-[12.5px] font-medium transition-[background-color,color] duration-200 ${
              mode === m
                ? "bg-white/[0.06] text-primary"
                : "text-muted hover:text-secondary"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {state?.error && (
        <div
          role="alert"
          className="mb-4 rounded-code border border-border-subtle bg-white/[0.022] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-secondary"
          style={{ borderLeft: "2px solid #8A6A62" }}
        >
          {state.error}
        </div>
      )}

      <form action={formAction} noValidate>
        {mode === "signup" && (
          <div className="mb-3">
            <label htmlFor="name" className={LABEL_CLASS}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Ada Lovelace"
              className={INPUT_CLASS}
            />
          </div>
        )}

        <div className="mb-3">
          <label htmlFor="email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            className={INPUT_CLASS}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className={LABEL_CLASS}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              className={`${INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="ease-base absolute top-1/2 right-1 -translate-y-1/2 rounded-[6px] p-2 text-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-secondary"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <Button pending={pending} pendingLabel={mode === "signin" ? "Signing in…" : "Creating account…"}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="text-[10.5px] tracking-[0.08em] text-muted uppercase">
          or
        </span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <form action={githubAction}>
        <Button
          pending={false}
          pendingLabel="Redirecting…"
          disabled={!githubConfigured}
          icon={<GitHubIcon />}
        >
          Continue with GitHub
        </Button>
      </form>

      {!githubConfigured && (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
          GitHub sign-in needs{" "}
          <code className="inline-code text-[11px]">AUTH_GITHUB_ID</code> and{" "}
          <code className="inline-code text-[11px]">AUTH_GITHUB_SECRET</code> in{" "}
          <code className="inline-code text-[11px]">.env</code>.
        </p>
      )}
    </div>
  );
}

function Button({
  children,
  pending,
  pendingLabel,
  icon,
  disabled,
}: {
  children: React.ReactNode;
  pending: boolean;
  pendingLabel: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="ease-base flex h-10 w-full items-center justify-center gap-2 rounded-control border border-border-visible bg-white/[0.035] text-[13.5px] font-medium text-primary transition-[background-color,transform,color] duration-150 hover:bg-white/[0.065] active:translate-y-[1px] active:bg-white/[0.05] disabled:pointer-events-none disabled:text-muted disabled:opacity-60"
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.5 4A6 6 0 0 1 8 3.5c4 0 6.5 4.5 6.5 4.5a12 12 0 0 1-2 2.5M4 5.5A12 12 0 0 0 1.5 8S4 12.5 8 12.5c.6 0 1.1-.1 1.6-.3M2 2l12 12" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
