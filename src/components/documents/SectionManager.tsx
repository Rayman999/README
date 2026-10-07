"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Folder = {
  id: string;
  slug: string;
  title: string;
  description: string;
  parentId: string | null;
  depth: number;
  position: number;
  pageCount: number;
};

const field = "ease-base rounded-input border border-border-visible bg-inset px-3 py-2 text-[13px] text-primary transition-colors duration-200 outline-none placeholder:text-muted focus:border-ink/[0.16]";
const quiet = "ease-base rounded-control px-2 py-1.5 text-[12px] text-muted hover:bg-state-hover hover:text-secondary disabled:pointer-events-none disabled:opacity-30";

/** "Architecture › API › Auth" — how a folder reads in a picker. */
function label(folder: Folder, folders: Folder[]) {
  const byId = new Map(folders.map((entry) => [entry.id, entry]));
  const path = [folder.title];
  for (let at = folder.parentId ? byId.get(folder.parentId) : undefined; at; at = at.parentId ? byId.get(at.parentId) : undefined) path.unshift(at.title);
  return path.join(" › ");
}

function descendants(folders: Folder[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && out.has(folder.parentId) && !out.has(folder.id)) { out.add(folder.id); grew = true; }
    }
  }
  return out;
}

/**
 * Folder management for editors. Folders nest to any depth; each has a
 * one-line purpose that tells readers and AI agents what belongs in it.
 * Reordering swaps with the neighbouring sibling, so two people moving
 * different folders don't fight over every position.
 */
export function SectionManager({ project, sections }: { project: string; sections: Folder[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [parent, setParent] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", purpose: "", parent: "" });
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

  const patch = (id: string, body: Record<string, unknown>) =>
    fetch(`/api/sections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const siblingsOf = (folder: Folder) => sections.filter((entry) => entry.parentId === folder.parentId);

  const reorder = (folder: Folder, delta: number) => {
    const siblings = siblingsOf(folder);
    const neighbour = siblings[siblings.indexOf(folder) + delta];
    if (!neighbour) return;
    void send(async () => {
      const first = await patch(folder.id, { position: neighbour.position });
      return first.ok ? patch(neighbour.id, { position: folder.position }) : first;
    });
  };

  const save = (folder: Folder) => {
    if (!draft.title.trim()) return;
    void send(async () => {
      const nextParent = draft.parent || null;
      const body: Record<string, unknown> = { title: draft.title.trim(), description: draft.purpose.trim() };
      if (nextParent !== folder.parentId) body.parentId = nextParent;
      return patch(folder.id, body);
    }, () => setEditing(null));
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="ease-base rounded-control border border-border-visible px-3 py-2 text-[13px] text-primary transition-colors duration-200 hover:bg-state-hover"
      >
        {open ? "Done with folders" : `Manage folders${sections.length ? ` (${sections.length})` : ""}`}
      </button>

      {open && (
        <div className="motion-enter mt-3 rounded-control border border-border-subtle bg-ink/[0.018] p-4">
          <form
            className="grid gap-2 sm:grid-cols-[1fr_1.4fr]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim()) return;
              void send(
                () => fetch("/api/sections", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ project, title: title.trim(), description: purpose.trim(), parentId: parent || null }),
                }),
                () => { setTitle(""); setPurpose(""); },
              );
            }}
          >
            <input aria-label="New folder name" value={title} maxLength={120} disabled={working} onChange={(event) => setTitle(event.target.value)} placeholder="Folder name, e.g. Architecture" className={field} />
            <input aria-label="What belongs in this folder" value={purpose} maxLength={300} disabled={working} onChange={(event) => setPurpose(event.target.value)} placeholder="What belongs here, e.g. How Tilde is designed and why" className={field} />
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              Inside
              <select value={parent} onChange={(event) => setParent(event.target.value)} disabled={working} className={`${field} min-h-0! flex-1 py-1.5`}>
                <option value="">Top level</option>
                {sections.map((folder) => <option key={folder.id} value={folder.id}>{label(folder, sections)}</option>)}
              </select>
            </label>
            <button
              type="submit"
              disabled={working || !title.trim()}
              className="ease-base justify-self-start rounded-control border border-border-visible bg-ink/[0.05] px-3 py-2 text-[13px] text-primary transition-colors duration-200 hover:bg-ink/[0.08] disabled:opacity-50 sm:justify-self-end"
            >
              Add folder
            </button>
          </form>

          {sections.length === 0 ? (
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              No folders yet. Pages without one sit at the top level of the sidebar.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border-subtle">
              {sections.map((folder) => {
                const siblings = siblingsOf(folder);
                const at = siblings.indexOf(folder);
                const blocked = descendants(sections, folder.id);
                return (
                  <li key={folder.id} className="py-2.5" style={{ paddingLeft: `${Math.min(folder.depth, 8) * 18}px` }}>
                    {editing === folder.id ? (
                      <form className="grid gap-2 sm:grid-cols-[1fr_1.4fr]" onSubmit={(event) => { event.preventDefault(); save(folder); }}>
                        <input aria-label={`Rename ${folder.title}`} value={draft.title} maxLength={120} autoFocus onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={field} />
                        <input aria-label={`What belongs in ${folder.title}`} value={draft.purpose} maxLength={300} placeholder="What belongs here" onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} className={field} />
                        <label className="flex items-center gap-2 text-[12.5px] text-muted">
                          Inside
                          <select value={draft.parent} onChange={(event) => setDraft({ ...draft, parent: event.target.value })} className={`${field} min-h-0! flex-1 py-1.5`}>
                            <option value="">Top level</option>
                            {sections.filter((entry) => !blocked.has(entry.id)).map((entry) => <option key={entry.id} value={entry.id}>{label(entry, sections)}</option>)}
                          </select>
                        </label>
                        <span className="flex justify-end gap-1">
                          <button type="button" onClick={() => setEditing(null)} className={quiet}>Cancel</button>
                          <button type="submit" disabled={working} className="ease-base rounded-control border border-border-visible px-2.5 py-1.5 text-[12px] text-primary hover:bg-state-hover disabled:opacity-50">Save</button>
                        </span>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-primary">{folder.title}</span>
                          {folder.description && <span className="block text-[12.5px] text-secondary">{folder.description}</span>}
                          <span className="block truncate text-[11.5px] text-muted">
                            {folder.slug} · {folder.pageCount} page{folder.pageCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <button type="button" disabled={working || at === 0} onClick={() => reorder(folder, -1)} aria-label={`Move ${folder.title} up`} className={quiet}>↑</button>
                          <button type="button" disabled={working || at === siblings.length - 1} onClick={() => reorder(folder, 1)} aria-label={`Move ${folder.title} down`} className={quiet}>↓</button>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => { setEditing(folder.id); setDraft({ title: folder.title, purpose: folder.description, parent: folder.parentId ?? "" }); }}
                            className={quiet}
                          >
                            Edit
                          </button>
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {error && <p role="alert" className="mt-3 text-[12px] leading-relaxed text-secondary">{error}</p>}
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            A folder&rsquo;s purpose tells readers and AI agents what belongs in it. Folders can sit inside other
            folders; Edit moves one. Its slug is fixed when it is created. Choose a page&rsquo;s folder in the composer.
          </p>
        </div>
      )}
    </div>
  );
}
