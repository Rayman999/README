"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Status = "draft" | "stable" | "deprecated";

const STATUS: { value: Status; label: string; hint: string }[] = [
  { value: "draft", label: "Draft", hint: "Work in progress. Agents may edit drafts." },
  { value: "stable", label: "Stable", hint: "Reviewed and current. Agents cannot edit it." },
  { value: "deprecated", label: "Deprecated", hint: "Kept for history; no longer accurate." },
];

/**
 * Manual controls for a page, for people with editor access: change its status,
 * or delete it. Editing the content itself is the composer's job, linked here.
 *
 * Every change goes through the same REST API an agent would use, including
 * the optimistic-concurrency check: `expectedVersion` is the version this page
 * was rendered from, so a status change made against a stale tab is refused
 * rather than quietly overwriting whatever happened in between.
 */
export function PageActions({
  project,
  page,
  status,
  version,
  editable,
  projectHref,
}: {
  project: string;
  page: string;
  status: Status;
  version: number;
  /** Structured documents can be opened in the composer; legacy Markdown cannot. */
  editable: boolean;
  projectHref: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const base = `/api/projects/${encodeURIComponent(project)}/pages/${encodeURIComponent(page)}`;

  async function run(request: () => Promise<Response>, after: () => void) {
    setError("");
    setBusy(true);
    try {
      const response = await request();
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "That change could not be saved.");
      }
      startTransition(after);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <div className="mb-7 rounded-control border border-border-subtle bg-white/[0.018] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {editable && (
          <Link
            href={`/compose/${project}?page=${page}`}
            className="ease-base rounded-control border border-border-visible px-3 py-1.5 text-[12.5px] text-primary transition-colors duration-200 hover:bg-state-hover"
          >
            Edit document
          </Link>
        )}

        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          Status
          <select
            aria-label="Page status"
            value={status}
            disabled={working}
            title={STATUS.find((option) => option.value === status)?.hint}
            onChange={(event) =>
              run(
                () => fetch(base, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: event.target.value, expectedVersion: version }),
                }),
                () => router.refresh(),
              )
            }
            className="ease-base rounded-control border border-border-visible px-2 py-1.5 text-[12.5px] transition-colors duration-200 disabled:opacity-50"
          >
            {STATUS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <span className="text-[11.5px] text-muted">Version {version}</span>

        <span className="ml-auto flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-[12px] text-secondary">Delete this page?</span>
              <button
                type="button"
                disabled={working}
                onClick={() =>
                  run(
                    () => fetch(base, { method: "DELETE" }),
                    () => { router.push(projectHref); router.refresh(); },
                  )
                }
                className="ease-base rounded-control border px-3 py-1.5 text-[12px] text-primary transition-colors duration-200 hover:bg-white/[0.06] disabled:opacity-50"
                style={{ borderColor: "rgba(138,106,98,0.55)" }}
              >
                {working ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="ease-base rounded-control px-2 py-1.5 text-[12px] text-muted transition-colors duration-200 hover:text-secondary"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={working}
              onClick={() => setConfirming(true)}
              className="ease-base rounded-control px-3 py-1.5 text-[12px] text-muted transition-colors duration-200 hover:bg-state-hover hover:text-secondary disabled:opacity-50"
            >
              Delete page
            </button>
          )}
        </span>
      </div>

      {confirming && (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
          The page is removed from listings and navigation. Its history is kept,
          so this can be undone from the database rather than being permanent.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2.5 text-[12px] leading-relaxed text-secondary">
          {error}
        </p>
      )}
    </div>
  );
}
