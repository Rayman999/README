"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const field = "ease-base rounded-input border border-border-visible bg-inset px-3 py-1.5 text-[13px] text-primary transition-colors duration-200 outline-none focus:border-ink/[0.16]";

/**
 * Where this project sits. Moving it takes everything inside along; slugs
 * and page URLs stay the same. `targets` already excludes this project and
 * anything inside it.
 */
export function MoveProject({ project, name, parentId, targets }: {
  project: string;
  name: string;
  parentId: string | null;
  targets: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(parentId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;
  const changed = choice !== (parentId ?? "");

  async function move() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: choice || null }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "The project could not be moved.");
      }
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The project could not be moved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
      <label className="flex items-center gap-2">
        {name} sits in
        <select value={choice} onChange={(event) => setChoice(event.target.value)} disabled={working} className={field}>
          <option value="">Library (top level)</option>
          {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
        </select>
      </label>
      {changed && (
        <button
          type="button"
          onClick={() => void move()}
          disabled={working}
          className="ease-base rounded-control border border-border-visible px-3 py-1.5 text-[12.5px] text-primary transition-colors duration-200 hover:bg-state-hover disabled:opacity-50"
        >
          {working ? "Moving…" : "Move"}
        </button>
      )}
      {error && <p role="alert" className="w-full text-[12.5px] text-primary">{error}</p>}
    </div>
  );
}
