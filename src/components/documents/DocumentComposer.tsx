"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { documentSchema, MAX_DOCUMENT_BYTES, starterDocument, type ReadmeDocument } from "@/lib/documents/schema";
import { DocumentRenderer } from "./DocumentRenderer";

const inputClass = "w-full rounded-input border border-border-visible bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-secondary";

export function DocumentComposer({ project, sections, initial }: { project: string; sections: { slug: string; title: string }[]; initial?: { slug: string; title: string; description: string; status: string; document: ReadmeDocument; version: number; section: string; href: string } }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  // "" means the page sits at the top level. The API takes null for that, so
  // the empty option is translated on the way out rather than being sent.
  const [section, setSection] = useState(initial?.section ?? "");
  const [source, setSource] = useState(JSON.stringify(initial?.document ?? starterDocument, null, 2));
  const [preview, setPreview] = useState<ReadmeDocument>(initial?.document ?? starterDocument);
  const [previewSource, setPreviewSource] = useState(source);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  function validate() {
    if (new TextEncoder().encode(source).byteLength > MAX_DOCUMENT_BYTES) throw new Error("JSON input exceeds 256 KiB.");
    const result = documentSchema.safeParse(JSON.parse(source));
    if (!result.success) throw new Error(result.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "document"}: ${issue.message}`).join("\n"));
    return result.data;
  }

  function refreshPreview() {
    try { setPreview(validate()); setPreviewSource(source); setError(""); setNotice("Valid document. Preview updated."); }
    catch (error) { setNotice(""); setError(error instanceof Error ? error.message : "Invalid document."); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setPending(true);
    try {
      const document = validate();
      const response = await fetch(`/api/projects/${encodeURIComponent(project)}/pages${initial ? `/${encodeURIComponent(initial.slug)}` : ""}`, {
        method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, document, status: "draft", section: section || null, ...(initial ? { expectedVersion: initial.version } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        const issues = Array.isArray(data.errors) ? data.errors.slice(0, 3).map((issue: { message: string }) => issue.message).join(" ") : "";
        throw new Error(`${data.detail ?? "Could not save the document."} ${issues}`.trim());
      }
      router.push(initial?.href ?? `/p/${project}/${data.page.slug}`); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed."); }
    finally { setPending(false); }
  }

  return <div className="grid items-start gap-6 xl:grid-cols-2">
    <form onSubmit={save} className="auth-panel min-w-0 space-y-5 p-5 sm:p-6">
      <div><label htmlFor="document-title" className="mb-2 block text-xs text-secondary">Title</label><input id="document-title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Authentication architecture" /></div>
      <div><label htmlFor="document-description" className="mb-2 block text-xs text-secondary">Short description</label><input id="document-description" required maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} placeholder="What this page helps someone understand" /></div>
      <div><label htmlFor="document-section" className="mb-2 block text-xs text-secondary">Section</label><select id="document-section" value={section} onChange={(event) => setSection(event.target.value)} className={inputClass}><option value="">No section — top level</option>{sections.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}</select><p className="mt-2 text-xs text-secondary">Groups this page in the sidebar. Manage sections from the project page.</p></div>
      <div><label htmlFor="document-json" className="mb-2 block text-xs text-secondary">Document JSON</label><textarea id="document-json" rows={22} spellCheck={false} value={source} onChange={(event) => setSource(event.target.value)} className={`${inputClass} resize-y font-mono text-[12px] leading-relaxed`} /></div>
      {error && <p role="alert" className="whitespace-pre-wrap rounded-control border border-syn-number p-3 text-sm text-primary">{error}</p>}
      <p role="status" className="text-xs text-secondary">{notice || "Saved content uses the README theme. HTML, custom styles, and scripts are not accepted."}</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={refreshPreview} className="rounded-control border border-border-visible px-4 py-2 text-sm text-primary hover:bg-state-hover">Validate & preview</button><button type="submit" disabled={pending} className="rounded-control border border-border-visible bg-state-selected px-4 py-2 text-sm text-primary disabled:opacity-50">{pending ? "Saving…" : "Save draft"}</button></div>
      {initial?.status === "stable" && <p className="text-xs text-secondary">Saving changes returns this page to draft status for review.</p>}
    </form>
    <section aria-label="Document preview" className="doc-panel min-w-0 p-5 sm:p-8"><div className="mb-7 border-b border-border-subtle pb-5"><p className="text-[11px] tracking-widest text-secondary uppercase">{source === previewSource ? "Preview" : "Preview · pending validation"}</p><h2 className="mt-3 text-[27px] font-semibold text-heading">{title || "Your document"}</h2><p className="mt-2 text-sm text-secondary">{description || "Add a title and description, then adapt the example content."}</p></div><DocumentRenderer document={preview} /></section>
  </div>;
}
