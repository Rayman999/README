"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Section = { id: string; slug: string; title: string; position: number; pageCount: number };

/**
 * Manual section management for editors. Sections group pages in the sidebar
 * and are what the composer's section picker chooses between, so without this
 * they could only ever be created through the API.
 *
 * Reordering swaps positions with the neighbour rather than renumbering the
 * whole list, so two people moving different sections do not fight over every
 * row's position.
 */
export function SectionManager({ project, sections }: { project: string; sections: Section[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;

  async function send(request: () => Promise<Response>, after?: () => void) {
    setError("");
    setBusy(true);
    try {
      const response = await request();
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "That change could not be saved.");
      }
      after?.();
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const move = (section: Section, delta: number) => {
    const neighbour = sections[sections.indexOf(section) + delta];
    if (!neighbour) return;
    void send(async () => {
      const first = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: neighbour.position }),
      });
      if (!first.ok) return first;
      return fetch(`/api/sections/${neighbour.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: section.position }),
      });
    });
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ease-base rounded-control border border-border-visible px-3 py-2 text-[13px] text-primary transition-colors duration-200 hover:bg-state-hover"
      >
        {open ? "Done with sections" : `Manage sections${sections.length ? ` (${sections.length})` : ""}`}
      </button>

      {open && (
        <div className="mt-3 rounded-control border border-border-subtle bg-white/[0.018] p-4">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim()) return;
              void send(
                () => fetch("/api/sections", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ project, title: title.trim() }),
                }),
                () => setTitle(""),
              );
            }}
          >
            <input
              aria-label="New section title"
              value={title}
              maxLength={120}
              disabled={working}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Guides"
              className="ease-base min-w-[180px] flex-1 rounded-input border border-border-visible bg-inset px-3 py-2 text-[13px] text-primary transition-colors duration-200 outline-none placeholder:text-muted focus:border-white/[0.16]"
            />
            <button
              type="submit"
              disabled={working || !title.trim()}
              className="ease-base rounded-control border border-border-visible bg-white/[0.05] px-3 py-2 text-[13px] text-primary transition-colors duration-200 hover:bg-white/[0.08] disabled:opacity-50"
            >
              Add section
            </button>
          </form>

          {sections.length === 0 ? (
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              No sections yet. Pages without one sit at the top level of the sidebar.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border-subtle">
              {sections.map((section, index) => (
                <li key={section.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  {renaming === section.id ? (
                    <form
                      className="flex flex-1 flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!draft.trim()) return;
                        void send(
                          () => fetch(`/api/sections/${section.id}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ title: draft.trim() }),
                          }),
                          () => setRenaming(null),
                        );
                      }}
                    >
                      <input
                        aria-label={`Rename ${section.title}`}
                        value={draft}
                        maxLength={120}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                        className="ease-base min-w-[160px] flex-1 rounded-input border border-border-visible bg-inset px-2.5 py-1.5 text-[13px] text-primary outline-none focus:border-white/[0.16]"
                      />
                      <button type="submit" disabled={working} className="ease-base rounded-control border border-border-visible px-2.5 py-1.5 text-[12px] text-primary hover:bg-state-hover disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => setRenaming(null)} className="ease-base rounded-control px-2 py-1.5 text-[12px] text-muted hover:text-secondary">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-primary">{section.title}</span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {section.slug} · {section.pageCount} page{section.pageCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <button type="button" disabled={working || index === 0} onClick={() => move(section, -1)} aria-label={`Move ${section.title} up`} className="ease-base rounded-control px-2 py-1.5 text-[12px] text-muted hover:bg-state-hover hover:text-secondary disabled:pointer-events-none disabled:opacity-30">↑</button>
                        <button type="button" disabled={working || index === sections.length - 1} onClick={() => move(section, 1)} aria-label={`Move ${section.title} down`} className="ease-base rounded-control px-2 py-1.5 text-[12px] text-muted hover:bg-state-hover hover:text-secondary disabled:pointer-events-none disabled:opacity-30">↓</button>
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => { setRenaming(section.id); setDraft(section.title); }}
                          className="ease-base rounded-control px-2.5 py-1.5 text-[12px] text-muted hover:bg-state-hover hover:text-secondary disabled:opacity-50"
                        >
                          Rename
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && <p role="alert" className="mt-3 text-[12px] leading-relaxed text-secondary">{error}</p>}
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            A section&rsquo;s slug is fixed when it is created, because page URLs are built from it.
            Assign a page to a section from the composer.
          </p>
        </div>
      )}
    </div>
  );
}
