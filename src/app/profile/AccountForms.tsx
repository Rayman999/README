"use client";

import { useState, useTransition } from "react";
import { changeOwnName, changeOwnPassword } from "./actions";

const INPUT =
  "ease-base shadow-inset-soft h-10 w-full rounded-input border border-border-visible bg-white/[0.02] px-3 text-[13.5px] text-primary transition-[background-color,border-color] duration-200 outline-none placeholder:text-muted hover:border-white/[0.09] focus:border-white/[0.14] focus:bg-white/[0.035]";
const LABEL = "mb-1.5 block text-[12px] font-medium text-tertiary";
const BUTTON =
  "ease-base flex h-9 shrink-0 items-center justify-center rounded-control border border-border-visible bg-white/[0.035] px-3.5 text-[13px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-white/[0.065] active:translate-y-[1px] disabled:pointer-events-none disabled:text-muted disabled:opacity-60";

function Notice({ kind, children }: { kind: "error" | "ok"; children: string }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className="mt-2.5 rounded-code border border-border-subtle bg-white/[0.022] px-3.5 py-2 text-[12.5px] leading-relaxed text-secondary"
      style={{
        borderLeft: `2px solid ${kind === "error" ? "#8A6A62" : "#6A7A62"}`,
      }}
    >
      {children}
    </p>
  );
}

export function NameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const dirty = name.trim() !== initialName.trim();

  return (
    <div>
      <label htmlFor="display-name" className={LABEL}>
        Display name
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          value={name}
          maxLength={120}
          onChange={(e) => {
            setName(e.target.value);
            setNotice(null);
          }}
          className={INPUT}
        />
        <button
          type="button"
          disabled={!dirty || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await changeOwnName(name);
              setNotice(
                result.ok
                  ? { kind: "ok", text: "Name updated." }
                  : { kind: "error", text: result.error },
              );
            })
          }
          className={BUTTON}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
    </div>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await changeOwnPassword(current, next);
          if (result.ok) {
            setCurrent("");
            setNext("");
            setNotice({ kind: "ok", text: "Password changed." });
          } else {
            setNotice({ kind: "error", text: result.error });
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="current-password" className={LABEL}>
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="new-password" className={LABEL}>
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || !current || !next}
        className={`${BUTTON} mt-3`}
      >
        {isPending ? "Changing…" : "Change password"}
      </button>

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
    </form>
  );
}
