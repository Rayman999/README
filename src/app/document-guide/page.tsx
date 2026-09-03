import Link from "next/link";
import { DocumentRenderer } from "@/components/documents/DocumentRenderer";
import { starterDocument, type ReadmeDocument } from "@/lib/documents/schema";

const example: ReadmeDocument = {
  ...starterDocument,
  blocks: [
    { type: "heading", level: 2, text: "Content, with a common language" },
    { type: "paragraph", text: "Give an agent the facts and a handful of building blocks. README handles the typography, surfaces, spacing, and charts. These are illustrative examples, not measurements of your project." },
    { type: "metrics", items: [{ label: "Document format", value: "JSON", detail: "One versioned source of truth" }, { label: "Rendered as", value: "HTML", detail: "Styled by the existing README theme" }] },
    { type: "cards", items: [{ title: "For readers", text: "Readable sections, comparisons, and diagrams that belong to this application." }, { title: "For agents", text: "Small summaries and an outline first. Full content only when it is needed." }] },
    { type: "heading", level: 2, text: "Make comparisons visible" },
    { type: "chart", variant: "bar", title: "Example document mix", unit: "illustrative counts", data: [{ label: "Guides", value: 8 }, { label: "Decisions", value: 5 }, { label: "Reference", value: 12 }] },
    { type: "chart", variant: "line", title: "Example weekly progress", unit: "illustrative pages", data: [{ label: "Week 1", value: 2 }, { label: "Week 2", value: 5 }, { label: "Week 3", value: 4 }, { label: "Week 4", value: 9 }] },
    { type: "table", title: "What belongs where", columns: ["Field", "Purpose"], rows: [["summary", "A quick explanation of the page"], ["keyFacts", "Verified facts an agent can reuse"], ["blocks", "The visible document"], ["openQuestions", "Decisions that are not settled"]] },
    { type: "heading", level: 2, text: "Show the reasoning" },
    { type: "timeline", items: [{ title: "Discover", text: "Read project context and the document schema." }, { title: "Draft", text: "Write the content and knowledge summary together." }, { title: "Review", text: "Validate, preview, and save a versioned draft." }] },
    { type: "callout", tone: "tip", title: "Keep evidence close", text: "Use codePaths for the files that support your explanation. Do not turn guesses into project facts." },
    { type: "callout", tone: "warning", title: "No arbitrary executable content", text: "Scripts, custom CSS, external resources, and unrecognised fields are rejected." },
    { type: "heading", level: 3, text: "A small component example" },
    { type: "code", language: "json", code: JSON.stringify({ type: "paragraph", text: "Explain one idea clearly." }, null, 2) },
    { type: "list", ordered: false, items: ["Use headings to build a useful outline.", "Use a table when exact values matter.", "Use a chart only when it makes a relationship clearer."] },
    { type: "details", title: "Current limits", text: "Version 1 accepts up to 80 blocks and 256 KiB per document. Charts allow up to 40 non-negative data points. Tables allow 8 columns and 100 rows. Blocks do not nest." },
  ],
};

export default function DocumentGuide() {
  return <main className="mx-auto max-w-[960px] px-5 py-10 sm:px-10">
    <Link href="/" className="text-sm text-secondary hover:text-primary">← Workspace</Link>
    <article className="doc-panel mt-6 px-5 py-8 sm:p-12"><p className="text-[11px] tracking-widest text-secondary uppercase">README / Component guide</p><h1 className="mt-3 text-[32px] font-semibold text-heading">Rich documents. One theme.</h1><p className="mt-4 mb-9 text-sm text-secondary">A live reference for the structured document format. Open a project and choose Create document to try it.</p><DocumentRenderer document={example} /><details className="mt-10 border-t border-border-subtle pt-6"><summary className="cursor-pointer text-sm text-primary">View this example as JSON</summary><pre className="mt-4 max-h-[480px] overflow-auto rounded-code bg-inset p-4 font-mono text-xs text-primary">{JSON.stringify(example, null, 2)}</pre></details></article>
  </main>;
}
