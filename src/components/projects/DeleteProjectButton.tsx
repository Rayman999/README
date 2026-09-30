"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon, ICONS } from "@/components/shell/icons";

export function DeleteProjectButton({ project }: {
  project: { id: string; slug: string; name: string };
}) {
  const router = useRouter();
  const descriptionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;

  function cancel() {
    if (working) return;
    setConfirming(false);
    setError("");
    trigger.current?.focus();
  }

  async function remove() {
    if (working) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.slug)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "The project could not be deleted. Please try again.");
      }
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The project could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="project-card-actions">
      <button
        ref={trigger}
        type="button"
        className="project-delete-button"
        aria-label={`Delete project ${project.name}`}
        aria-expanded={confirming}
        aria-controls={confirming ? descriptionId : undefined}
        disabled={working}
        onClick={() => { setConfirming(!confirming); setError(""); }}
      >
        <Icon path={ICONS.trash} size={15} />
        Delete project
      </button>
      {confirming && (
        <div id={descriptionId} className="project-delete-confirmation" onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); cancel(); }
        }}>
          <p className="font-medium text-primary">Delete “{project.name}”?</p>
          <p className="mt-2 text-secondary">
            This permanently deletes the project and its pages, history, sections,
            and learning paths. This cannot be undone. Sub-projects stay in your library.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" autoFocus disabled={working} onClick={cancel}
              className="project-cancel-button">Cancel</button>
            <button type="button" disabled={working} onClick={remove}
              className="project-delete-button project-delete-permanent">
              {working ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-secondary">{error}</p>}
        </div>
      )}
    </div>
  );
}
