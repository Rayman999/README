"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { documentSchema, MAX_DOCUMENT_BYTES, starterDocument, type ReadmeDocument } from "@/lib/documents/schema";
import { BlockEditor } from "./BlockEditor";
import { DocumentRenderer } from "./DocumentRenderer";

const inputClass = "w-full rounded-input border border-border-visible bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-secondary";

export function DocumentComposer({ project, sections, initial }: { project: string; sections: { slug: string; title: string }[]; initial?: { slug: string; title: string; description: string; status: string; document: ReadmeDocument; version: number; section: string; href: string } }) {
  const router = useRouter();
  const initialDocument = initial?.document ?? starterDocument;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [section, setSection] = useState(initial?.section ?? "");
  const [document, setDocument] = useState<ReadmeDocument>(initialDocument);
  const [source, setSource] = useState(JSON.stringify(initialDocument, null, 2));
  const [mode, setMode] = useState<"visual" | "json">("visual");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  function validate(input = source) {
    if (new TextEncoder().encode(input).byteLength > MAX_DOCUMENT_BYTES) throw new Error("Document exceeds 256 KiB.");
    const result = documentSchema.safeParse(JSON.parse(input));
    if (!result.success) throw new Error(result.error.issues.slice(0, 5).map(issue => `${issue.path.join(".") || "document"}: ${issue.message}`).join("\n"));
    return result.data;
  }
  function updateDocument(next: ReadmeDocument) { setDocument(next); setSource(JSON.stringify(next, null, 2)); setError(""); setNotice(""); }
  function switchMode(next: "visual" | "json") {
    if (next === "json") { setSource(JSON.stringify(document, null, 2)); setMode(next); return; }
    try { const parsed = validate(); setDocument(parsed); setMode(next); setError(""); setNotice("Advanced changes applied."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid document JSON."); }
  }
  function applyJson() {
    try { const parsed = validate(); setDocument(parsed); setError(""); setNotice("Valid document. Preview updated."); }
    catch (cause) { setNotice(""); setError(cause instanceof Error ? cause.message : "Invalid document JSON."); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setPending(true);
    try {
      const content = mode === "json" ? validate() : documentSchema.parse(document);
      const response = await fetch(`/api/projects/${encodeURIComponent(project)}/pages${initial ? `/${encodeURIComponent(initial.slug)}` : ""}`, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, document: content, status: "draft", section: section || null, ...(initial ? { expectedVersion: initial.version } : {}) }) });
      const data = await response.json();
      if (!response.ok) { const issues = Array.isArray(data.errors) ? data.errors.slice(0, 3).map((issue: { message: string }) => issue.message).join(" ") : ""; throw new Error(`${data.detail ?? "Could not save the document."} ${issues}`.trim()); }
      router.push(initial?.href ?? `/p/${project}/${data.page.slug}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); }
    finally { setPending(false); }
  }

  return <form onSubmit={save} className="composer-shell">
    <section className="composer-header"><div><span className="eyebrow">Document studio</span><h1>{initial ? "Improve this page" : "Create useful documentation"}</h1><p>Write for the person who will arrive here six months from now.</p></div><div className="composer-save"><span>{initial ? `Version ${initial.version}` : "New draft"}</span><button type="submit" disabled={pending} className="primary-action">{pending ? "Saving…" : "Save draft"}</button></div></section>
    <section className="composer-basics"><label>Title<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} className={inputClass} placeholder="Authentication architecture" /></label><label>Short description<input required maxLength={300} value={description} onChange={event => setDescription(event.target.value)} className={inputClass} placeholder="What this page helps someone understand" /></label><label>Section<select value={section} onChange={event => setSection(event.target.value)} className={inputClass}><option value="">Top level</option>{sections.map(entry => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}</select></label></section>
    <div className="composer-tabs" role="tablist" aria-label="Editing mode"><button type="button" role="tab" aria-selected={mode === "visual"} onClick={() => switchMode("visual")}>Visual editor</button><button type="button" role="tab" aria-selected={mode === "json"} onClick={() => switchMode("json")}>Advanced JSON</button></div>
    {error && <p role="alert" className="composer-message composer-error">{error}</p>}{notice && <p role="status" className="composer-message">{notice}</p>}
    <div className="composer-workspace"><section className="composer-edit" aria-label="Document editor">{mode === "visual" ? <BlockEditor document={document} onChange={updateDocument} onEditJson={() => switchMode("json")} /> : <div className="json-editor"><div><h2>Advanced JSON</h2><p>Edit structured blocks directly. Validate before saving to update the preview.</p></div><textarea rows={34} spellCheck={false} value={source} onChange={event => setSource(event.target.value)} className={`${inputClass} font-mono text-[12px] leading-relaxed`} /><button type="button" onClick={applyJson} className="secondary-action">Validate and preview</button></div>}</section><aside className="composer-preview" aria-label="Live document preview"><div className="composer-preview-label"><span>Live preview</span><i /></div><div className="doc-panel"><header><h2>{title || "Untitled document"}</h2><p>{description || "Your description will help readers decide if this page answers their question."}</p></header><DocumentRenderer document={document} /></div></aside></div>
    {initial?.status === "stable" && <p className="composer-message">Saving changes returns this page to draft status for review.</p>}
  </form>;
}
