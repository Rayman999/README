"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentBlock, ReadmeDocument } from "@/lib/documents/schema";

const inputClass = "w-full rounded-input border border-border-visible bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-secondary";
const STARTER = `## Overview

Explain what this part of the system does and why it exists.

## What you need to know

- Add the most important fact first
- Link to relevant code with inline code, such as \`src/example.ts\`
- Record assumptions clearly

> **Tip:** Write for someone seeing this project for the first time.

## Example

\`\`\`typescript
// Add a useful example here
\`\`\`
`;

function table(columns: string[], rows: string[][]) {
  const clean = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
  return `| ${columns.map(clean).join(" | ")} |\n| ${columns.map(() => "---").join(" | ")} |\n${rows.map(row => `| ${columns.map((_, index) => clean(row[index] ?? "")).join(" | ")} |`).join("\n")}`;
}

function blockMarkdown(block: DocumentBlock): string {
  switch (block.type) {
    case "heading": return `${"#".repeat(block.level)} ${block.text}`;
    case "paragraph": return block.text;
    case "list": return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`).join("\n");
    case "callout": return `> **${block.tone === "warning" ? "Warning" : block.title}:** ${block.text}`;
    case "code": return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
    case "table": return `### ${block.title}\n\n${table(block.columns, block.rows)}`;
    case "cards": return block.items.map(item => `### ${item.title}\n\n${item.text}`).join("\n\n");
    case "metrics": return table(["Metric", "Value", "Detail"], block.items.map(item => [item.label, item.value, item.detail ?? ""]));
    case "timeline": return block.items.map((item, index) => `${index + 1}. **${item.title}** — ${item.text}`).join("\n");
    case "details": return `### ${block.title}\n\n${block.text}`;
    case "chart": return `### ${block.title}\n\n${table(["Label", block.unit ? `Value (${block.unit})` : "Value"], block.data.map(item => [item.label, String(item.value)]))}`;
    case "diagram": return `### ${block.title}\n\n${block.nodes.map(node => `- **${node.label}**${node.detail ? ` — ${node.detail}` : ""}`).join("\n")}\n\n${block.edges.map(edge => `- \`${edge.from}\` → \`${edge.to}\`${edge.label ? `: ${edge.label}` : ""}`).join("\n")}`;
  }
}

function documentMarkdown(document: ReadmeDocument): string {
  const context = [document.summary, document.keyFacts.length ? `## Key facts\n\n${document.keyFacts.map(item => `- ${item}`).join("\n")}` : "", document.codePaths.length ? `## Relevant code\n\n${document.codePaths.map(item => `- \`${item}\``).join("\n")}` : ""];
  return [...context, ...document.blocks.map(blockMarkdown), document.openQuestions.length ? `## Open questions\n\n${document.openQuestions.map(item => `- ${item}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
}

type Initial = { slug: string; title: string; description: string; status: string; body: string; document: ReadmeDocument | null; version: number; section: string; href: string };
type Tool = { label: string; title: string; action: "wrap" | "line"; before: string; after?: string; sample: string };
const TOOLS: Tool[] = [
  { label: "H2", title: "Heading", action: "line", before: "## ", sample: "Section heading" },
  { label: "B", title: "Bold (Ctrl+B)", action: "wrap", before: "**", after: "**", sample: "important text" },
  { label: "I", title: "Italic (Ctrl+I)", action: "wrap", before: "_", after: "_", sample: "emphasized text" },
  { label: "↗", title: "Link (Ctrl+K)", action: "wrap", before: "[", after: "](https://)", sample: "link text" },
  { label: "•", title: "Bulleted list", action: "line", before: "- ", sample: "List item" },
  { label: "1.", title: "Numbered list", action: "line", before: "1. ", sample: "Step" },
  { label: "❯", title: "Quote or callout", action: "line", before: "> ", sample: "Important context" },
  { label: "</>", title: "Code", action: "wrap", before: "`", after: "`", sample: "code" },
];

export function DocumentComposer({ project, sections, initial }: { project: string; sections: { slug: string; title: string }[]; initial?: Initial }) {
  const router = useRouter();
  const editor = useRef<HTMLTextAreaElement>(null);
  const initialMarkdown = initial?.document ? documentMarkdown(initial.document) : initial?.body ?? STARTER;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [section, setSection] = useState(initial?.section ?? "");
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [preview, setPreview] = useState("");
  const [previewing, setPreviewing] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewing(true);
      try {
        const response = await fetch("/api/markdown/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdown }), signal: controller.signal });
        if (response.ok) setPreview((await response.json()).html);
      } finally { if (!controller.signal.aborted) setPreviewing(false); }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [markdown]);

  function apply(tool: Tool) {
    const area = editor.current; if (!area) return;
    const start = area.selectionStart, end = area.selectionEnd;
    if (tool.action === "line") {
      const lineStart = markdown.lastIndexOf("\n", start - 1) + 1;
      const selected = markdown.slice(lineStart, end) || tool.sample;
      const replacement = selected.split("\n").map(line => `${tool.before}${line}`).join("\n");
      setMarkdown(markdown.slice(0, lineStart) + replacement + markdown.slice(end));
      requestAnimationFrame(() => { area.focus(); area.setSelectionRange(lineStart + tool.before.length, lineStart + replacement.length); });
    } else {
      const selected = markdown.slice(start, end) || tool.sample;
      const replacement = `${tool.before}${selected}${tool.after ?? ""}`;
      setMarkdown(markdown.slice(0, start) + replacement + markdown.slice(end));
      requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + tool.before.length, start + tool.before.length + selected.length); });
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setPending(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project)}/pages${initial ? `/${encodeURIComponent(initial.slug)}` : ""}`, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, body: markdown, status: "draft", section: section || null, ...(initial ? { expectedVersion: initial.version } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not save the document.");
      router.push(initial?.href ?? `/p/${project}/${data.page.slug}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); }
    finally { setPending(false); }
  }

  return <form onSubmit={save} className="markdown-studio">
    <header className="markdown-studio-header"><div><span className="eyebrow">Markdown editor</span><h1>{initial ? "Edit documentation" : "Create documentation"}</h1><p>Write naturally with Markdown. Your preview updates as you type.</p></div><div className="composer-save"><span>{initial ? `Version ${initial.version}` : "New draft"}</span><button type="submit" disabled={pending} className="primary-action">{pending ? "Saving…" : "Save draft"}</button></div></header>
    {initial?.document && <p className="format-notice">This page was created with structured blocks. Saving converts it to Markdown; its earlier version remains available in Page history.</p>}
    <section className="composer-basics"><label>Title<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} className={inputClass} placeholder="Authentication architecture" /></label><label>Short description<input required maxLength={300} value={description} onChange={event => setDescription(event.target.value)} className={inputClass} placeholder="What this page helps someone understand" /></label><label>Folder<select value={section} onChange={event => setSection(event.target.value)} className={inputClass}><option value="">Top level</option>{sections.map(entry => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}</select></label></section>
    {error && <p role="alert" className="composer-message composer-error">{error}</p>}
    <div className="markdown-workspace">
      <section className="markdown-editor-pane"><div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">{TOOLS.map(tool => <button key={tool.title} type="button" title={tool.title} aria-label={tool.title} onClick={() => apply(tool)} className={tool.label === "B" ? "font-bold" : tool.label === "I" ? "italic" : ""}>{tool.label}</button>)}<span /><small>Markdown</small></div><textarea ref={editor} value={markdown} onChange={event => setMarkdown(event.target.value)} onKeyDown={event => { if (!(event.ctrlKey || event.metaKey)) return; const key = event.key.toLowerCase(); const tool = key === "b" ? TOOLS[1] : key === "i" ? TOOLS[2] : key === "k" ? TOOLS[3] : undefined; if (tool) { event.preventDefault(); apply(tool); } }} spellCheck className="markdown-source" aria-label="Markdown content" /></section>
      <section className="markdown-preview-pane" aria-label="Document preview"><div className="markdown-preview-heading"><span>Preview</span><i data-loading={previewing} /></div><article className="doc-panel"><header><h2>{title || "Untitled document"}</h2><p>{description || "Add a description to help readers understand this page."}</p></header>{preview ? <div className="doc-body" dangerouslySetInnerHTML={{ __html: preview }} /> : <p className="preview-empty">Start writing to see your page here.</p>}</article></section>
    </div>
    {initial?.status === "stable" && <p className="composer-message">Saving changes returns this page to draft status for review.</p>}
  </form>;
}
