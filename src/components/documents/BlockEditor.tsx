"use client";

import type { DocumentBlock, ReadmeDocument } from "@/lib/documents/schema";

const fieldClass = "composer-field";
const lines = (value: string) => value.split("\n").map(item => item.trim()).filter(Boolean);
const BLOCKS: { type: DocumentBlock["type"]; label: string; hint: string }[] = [
  { type: "paragraph", label: "Text", hint: "Explain an idea" }, { type: "heading", label: "Heading", hint: "Start a section" },
  { type: "list", label: "List", hint: "Steps or facts" }, { type: "callout", label: "Callout", hint: "Highlight advice" },
  { type: "code", label: "Code", hint: "Show an example" }, { type: "details", label: "Details", hint: "Optional depth" },
];

function newBlock(type: DocumentBlock["type"]): DocumentBlock {
  switch (type) {
    case "heading": return { type, level: 2, text: "New section" };
    case "list": return { type, ordered: false, items: ["First point"] };
    case "callout": return { type, tone: "note", title: "Good to know", text: "Add the important context here." };
    case "code": return { type, language: "text", code: "" };
    case "details": return { type, title: "More detail", text: "Add supporting detail here." };
    default: return { type: "paragraph", text: "Start writing here." };
  }
}

function BlockFields({ block, update }: { block: DocumentBlock; update: (block: DocumentBlock) => void }) {
  switch (block.type) {
    case "heading": return <><label>Heading<input className={fieldClass} value={block.text} onChange={event => update({ ...block, text: event.target.value })} /></label><label>Size<select className={fieldClass} value={block.level} onChange={event => update({ ...block, level: Number(event.target.value) as 2 | 3 })}><option value={2}>Section</option><option value={3}>Subsection</option></select></label></>;
    case "paragraph": return <label>Text<textarea className={fieldClass} rows={5} value={block.text} onChange={event => update({ ...block, text: event.target.value })} placeholder="Explain one idea in plain language." /></label>;
    case "list": return <><label>List style<select className={fieldClass} value={block.ordered ? "ordered" : "bullet"} onChange={event => update({ ...block, ordered: event.target.value === "ordered" })}><option value="bullet">Bullets</option><option value="ordered">Numbered steps</option></select></label><label>Items <small>One per line</small><textarea className={fieldClass} rows={5} value={block.items.join("\n")} onChange={event => update({ ...block, items: lines(event.target.value) })} /></label></>;
    case "callout": return <><label>Style<select className={fieldClass} value={block.tone} onChange={event => update({ ...block, tone: event.target.value as "note" | "tip" | "warning" })}><option value="note">Note</option><option value="tip">Tip</option><option value="warning">Warning</option></select></label><label>Title<input className={fieldClass} value={block.title} onChange={event => update({ ...block, title: event.target.value })} /></label><label>Message<textarea className={fieldClass} rows={4} value={block.text} onChange={event => update({ ...block, text: event.target.value })} /></label></>;
    case "code": return <><label>Language<input className={fieldClass} value={block.language} onChange={event => update({ ...block, language: event.target.value })} placeholder="typescript" /></label><label>Code<textarea className={`${fieldClass} composer-code`} rows={9} spellCheck={false} value={block.code} onChange={event => update({ ...block, code: event.target.value })} /></label></>;
    case "details": return <><label>Collapsed title<input className={fieldClass} value={block.title} onChange={event => update({ ...block, title: event.target.value })} /></label><label>Details<textarea className={fieldClass} rows={5} value={block.text} onChange={event => update({ ...block, text: event.target.value })} /></label></>;
    default: return <div className="advanced-block"><strong>{block.type} block</strong><p>This rich block is preserved. Open JSON mode when you need to change its data.</p></div>;
  }
}

export function BlockEditor({ document, onChange, onEditJson }: { document: ReadmeDocument; onChange: (document: ReadmeDocument) => void; onEditJson: () => void }) {
  function patch(values: Partial<ReadmeDocument>) { onChange({ ...document, ...values }); }
  function updateBlock(index: number, block: DocumentBlock) { const blocks = [...document.blocks]; blocks[index] = block; patch({ blocks }); }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= document.blocks.length) return; const blocks = [...document.blocks]; [blocks[index], blocks[target]] = [blocks[target], blocks[index]]; patch({ blocks }); }
  function duplicate(index: number) { const blocks = [...document.blocks]; blocks.splice(index + 1, 0, structuredClone(blocks[index])); patch({ blocks }); }
  function remove(index: number) { if (document.blocks.length === 1) return; patch({ blocks: document.blocks.filter((_, item) => item !== index) }); }

  return <div className="block-editor">
    <section className="composer-overview"><div><span className="eyebrow">Reader orientation</span><h2>What should readers know first?</h2></div><label>Page summary<textarea className={fieldClass} rows={3} value={document.summary} onChange={event => patch({ summary: event.target.value })} placeholder="A short explanation of what this page teaches." /></label>
      <div className="composer-meta-grid"><label>Key facts <small>One per line</small><textarea className={fieldClass} rows={4} value={document.keyFacts.join("\n")} onChange={event => patch({ keyFacts: lines(event.target.value) })} /></label><label>Relevant code paths <small>One per line</small><textarea className={fieldClass} rows={4} value={document.codePaths.join("\n")} onChange={event => patch({ codePaths: lines(event.target.value) })} /></label><label>Related pages <small>One per line</small><textarea className={fieldClass} rows={4} value={document.relatedPages.join("\n")} onChange={event => patch({ relatedPages: lines(event.target.value) })} /></label><label>Open questions <small>One per line</small><textarea className={fieldClass} rows={4} value={document.openQuestions.join("\n")} onChange={event => patch({ openQuestions: lines(event.target.value) })} /></label></div>
    </section>
    <div className="composer-section-heading"><div><span className="eyebrow">Page content</span><h2>Build the explanation</h2></div><button type="button" className="text-action" onClick={onEditJson}>Edit advanced JSON</button></div>
    <div className="block-list">{document.blocks.map((block, index) => <section key={index} className="block-card"><header><span className="block-number">{String(index + 1).padStart(2, "0")}</span><strong>{block.type}</strong><div className="block-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move block up">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === document.blocks.length - 1} aria-label="Move block down">↓</button><button type="button" onClick={() => duplicate(index)}>Duplicate</button><button type="button" onClick={() => remove(index)} disabled={document.blocks.length === 1}>Remove</button></div></header><div className="block-fields"><BlockFields block={block} update={next => updateBlock(index, next)} /></div></section>)}</div>
    <div className="add-block"><p>Add the next part</p><div>{BLOCKS.map(option => <button key={option.type} type="button" onClick={() => patch({ blocks: [...document.blocks, newBlock(option.type)] })}><strong>{option.label}</strong><span>{option.hint}</span></button>)}</div></div>
  </div>;
}
