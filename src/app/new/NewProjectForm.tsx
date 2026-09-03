"use client";

import { useActionState, useState } from "react";
import { createProject, type NewProjectState } from "./actions";
import { slugify } from "@/lib/slug";

const INPUT =
  "ease-base shadow-inset-soft w-full rounded-input border border-border-visible bg-white/[0.02] px-3 text-[13.5px] text-primary transition-[background-color,border-color] duration-200 outline-none placeholder:text-muted hover:border-white/[0.09] focus:border-white/[0.14] focus:bg-white/[0.035]";
const LABEL = "mb-1.5 block text-[12px] font-medium text-tertiary";
const HINT = "mt-1.5 text-[11.5px] leading-relaxed text-muted";

export function NewProjectForm({
  parents,
}: {
  parents: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<NewProjectState, FormData>(
    createProject,
    undefined,
  );
  const [name, setName] = useState("");
  const slug = slugify(name);

  return (
    <form action={formAction} className="auth-panel p-6" noValidate>
      {state?.error && (
        <div
          role="alert"
          className="mb-5 rounded-code border border-border-subtle bg-white/[0.022] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-secondary"
          style={{ borderLeft: "2px solid #8A6A62" }}
        >
          {state.error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="name" className={LABEL}>
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Payments API"
          className={`${INPUT} h-10`}
        />
        <p className={HINT}>
          {slug ? (
            <>
              Slug will be <code className="inline-code text-[11px]">{slug}</code>
              . Slugs are permanent — renaming the project later never changes
              it.
            </>
          ) : (
            "The slug is derived from the name and can never be changed afterwards."
          )}
        </p>
      </div>

      <div className="mb-4">
        <label htmlFor="summary" className={LABEL}>
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          required
          rows={3}
          placeholder="Internal service handling card capture, refunds, and payout scheduling."
          className={`${INPUT} resize-y py-2.5 leading-relaxed`}
        />
        <p className={HINT}>
          One or two sentences. This is the first thing an agent reads about the
          project.
        </p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className={LABEL}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue="active"
            className={`${INPUT} h-10`}
          >
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="planned">Planned</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label htmlFor="parentId" className={LABEL}>
            Parent project
          </label>
          <select
            id="parentId"
            name="parentId"
            defaultValue=""
            disabled={parents.length === 0}
            className={`${INPUT} h-10 disabled:opacity-50`}
          >
            <option value="">None — top level</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className={HINT}>
            {parents.length === 0
              ? "No other projects yet."
              : "Nesting is one level deep."}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="repositoryUrl" className={LABEL}>
          Repository URL <span className="text-muted">(optional)</span>
        </label>
        <input
          id="repositoryUrl"
          name="repositoryUrl"
          type="url"
          placeholder="https://github.com/you/payments-api"
          className={`${INPUT} h-10`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="ease-base flex h-10 w-full items-center justify-center gap-2 rounded-control border border-border-visible bg-white/[0.035] text-[13.5px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-white/[0.065] active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
