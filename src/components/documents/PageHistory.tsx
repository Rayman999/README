"use client";

import { useRef, useState } from "react";

type Revision = {
  id: string;
  title: string;
  authorType: "human" | "agent";
  createdAt: string;
  summary: string;
  wordCount: number;
};

export function PageHistory({ project, page }: { project: string; page: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    dialog.current?.showModal();
    if (loaded || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project)}/pages/${encodeURIComponent(page)}/revisions`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not load page history.");
      setRevisions(data.revisions); setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load page history.");
    } finally { setLoading(false); }
  }

  const close = () => dialog.current?.close();

  return <>
    <button type="button" className="history-trigger" onClick={() => void open()}>
      <span aria-hidden>↺</span> Page history
    </button>
    <dialog ref={dialog} className="history-dialog" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }}>
      <div className="history-surface">
        <header><div><span className="eyebrow">Change record</span><h2>Page history</h2><p>Earlier saved versions of this documentation.</p></div><button type="button" onClick={close} aria-label="Close page history">×</button></header>
        <div className="history-list" aria-live="polite">
          {loading && <p className="history-empty">Loading history…</p>}
          {error && <p className="history-empty" role="alert">{error}</p>}
          {!loading && loaded && revisions.length === 0 && <p className="history-empty">No earlier revisions have been saved yet.</p>}
          {revisions.map((revision, index) => <article key={revision.id} className="history-item">
            <span className="history-dot" aria-hidden />
            <div className="history-item-heading"><div><strong>{revision.title}</strong><span>{index === 0 ? "Latest saved revision" : `Revision ${revisions.length - index}`}</span></div><time dateTime={revision.createdAt}>{new Date(revision.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time></div>
            <p>{revision.summary || "No summary was recorded for this revision."}</p>
            <footer><span>{revision.authorType === "agent" ? "Automated update" : "Human edit"}</span><span>{revision.wordCount.toLocaleString()} words</span></footer>
          </article>)}
        </div>
      </div>
    </dialog>
  </>;
}
