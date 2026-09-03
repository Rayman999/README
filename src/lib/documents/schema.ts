import { z } from "zod";

export const MAX_DOCUMENT_BYTES = 256 * 1024;
const short = z.string().trim().min(1).max(200);
const text = z.string().min(1).max(8000);
const strings = z.array(z.string().trim().min(1).max(500)).max(20);

const chart = z.strictObject({
  type: z.literal("chart"),
  variant: z.enum(["bar", "line"]),
  title: short,
  unit: z.string().max(30).optional(),
  // Non-negative values keep the common baseline honest. Signed series
  // require a different renderer and are deliberately not accepted in v1.
  data: z.array(z.strictObject({ label: short, value: z.number().min(0).max(1e12) })).min(1).max(40),
});

// A node-and-edge flow, rendered by README as real SVG. This exists so that an
// agent describing how something works has somewhere structured to put it --
// without it, the only block that accepts a picture-shaped thing is `code`, and
// agents fall back to drawing boxes out of dashes and pipes.
const diagram = z.strictObject({
  type: z.literal("diagram"),
  title: short,
  direction: z.enum(["down", "right"]).default("down"),
  nodes: z.array(z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/),
    // Bounded to what a node box can hold at a readable size. A diagram is a
    // map, not prose: anything longer belongs in a paragraph beside it.
    label: z.string().trim().min(1).max(40),
    detail: z.string().trim().max(90).optional(),
    role: z.enum(["default", "actor", "system", "store", "decision"]).default("default"),
  })).min(2).max(12),
  edges: z.array(z.strictObject({
    from: z.string().max(40),
    to: z.string().max(40),
    label: z.string().trim().max(60).optional(),
  })).min(1).max(24),
});

export const blockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("heading"), text: short, level: z.union([z.literal(2), z.literal(3)]) }),
  z.strictObject({ type: z.literal("paragraph"), text }),
  z.strictObject({ type: z.literal("list"), ordered: z.boolean().optional(), items: z.array(text).min(1).max(30) }),
  z.strictObject({ type: z.literal("callout"), tone: z.enum(["note", "tip", "warning"]), title: short, text }),
  z.strictObject({ type: z.literal("code"), language: z.string().max(40), code: z.string().max(20000) }),
  z.strictObject({ type: z.literal("table"), title: short, columns: z.array(short).min(1).max(8), rows: z.array(z.array(z.string().max(1000)).min(1).max(8)).max(100) }),
  z.strictObject({ type: z.literal("cards"), items: z.array(z.strictObject({ title: short, text })).min(1).max(6) }),
  z.strictObject({ type: z.literal("metrics"), items: z.array(z.strictObject({ label: short, value: z.string().min(1).max(80), detail: z.string().max(300).optional() })).min(1).max(4) }),
  z.strictObject({ type: z.literal("timeline"), items: z.array(z.strictObject({ title: short, text })).min(1).max(20) }),
  z.strictObject({ type: z.literal("details"), title: short, text }),
  chart,
  diagram,
]);

export const documentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  summary: z.string().trim().min(1).max(1000),
  keyFacts: strings,
  codePaths: strings,
  relatedPages: strings,
  openQuestions: strings,
  blocks: z.array(blockSchema).min(1).max(80),
}).superRefine((doc, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_DOCUMENT_BYTES) {
    ctx.addIssue({ code: "custom", message: "Document exceeds the 256 KiB limit." });
  }
  doc.blocks.forEach((block, index) => {
    if (block.type === "diagram") {
      const ids = new Set(block.nodes.map((node) => node.id));
      if (ids.size !== block.nodes.length) ctx.addIssue({ code: "custom", path: ["blocks", index, "nodes"], message: "Diagram node ids must be unique." });
      block.edges.forEach((edge, edgeIndex) => {
        for (const end of ["from", "to"] as const) {
          if (!ids.has(edge[end])) ctx.addIssue({ code: "custom", path: ["blocks", index, "edges", edgeIndex, end], message: `Edge ${end} "${edge[end]}" is not a node id in this diagram.` });
        }
      });
    }
    if (block.type === "table") {
      block.rows.forEach((row, rowIndex) => {
        if (row.length !== block.columns.length) ctx.addIssue({ code: "custom", path: ["blocks", index, "rows", rowIndex], message: "Each row must match the number of columns." });
      });
    }
  });
});

export type ReadmeDocument = z.infer<typeof documentSchema>;
export type DocumentBlock = z.infer<typeof blockSchema>;

// Deterministic plain text, not a second author-maintained copy. This feeds
// the existing PostgreSQL search index without indexing HTML/CSS/JSON keys.
export function documentText(doc: ReadmeDocument): string {
  const pieces = [doc.summary, ...doc.keyFacts, ...doc.codePaths, ...doc.relatedPages, ...doc.openQuestions];
  for (const block of doc.blocks) {
    switch (block.type) {
      case "heading": case "paragraph": pieces.push(block.text); break;
      case "list": pieces.push(...block.items); break;
      case "callout": case "details": pieces.push(block.title, block.text); break;
      case "code": pieces.push(block.language, block.code); break;
      case "table": pieces.push(block.title, ...block.columns, ...block.rows.flat()); break;
      case "cards": case "timeline": block.items.forEach((item) => pieces.push(item.title, item.text)); break;
      case "metrics": block.items.forEach((item) => pieces.push(item.label, item.value, item.detail ?? "")); break;
      case "chart": pieces.push(block.title, block.unit ?? "", ...block.data.map((item) => `${item.label}: ${item.value}`)); break;
      case "diagram": pieces.push(block.title, ...block.nodes.map((node) => [node.label, node.detail ?? ""].join(" ")), ...block.edges.map((edge) => edge.label ?? "")); break;
    }
  }
  return pieces.join("\n");
}

export function documentHeadings(doc: ReadmeDocument) {
  return doc.blocks.flatMap((block, i) => block.type === "heading" ? [{ id: `doc-section-${i}`, text: block.text, level: block.level }] : []);
}

export function documentContext(doc: ReadmeDocument) {
  const { blocks: _blocks, ...context } = doc;
  void _blocks;
  return { ...context, outline: documentHeadings(doc) };
}

export const starterDocument: ReadmeDocument = {
  schemaVersion: 1,
  summary: "Replace this example with a concise description of this part of your project.",
  keyFacts: ["Example content only — replace before publishing."],
  codePaths: [], relatedPages: [], openQuestions: [],
  blocks: [
    { type: "heading", text: "At a glance", level: 2 },
    { type: "paragraph", text: "Describe what this component does, who uses it, and where it fits in the project." },
    { type: "cards", items: [{ title: "Responsibility", text: "What this component owns." }, { title: "Boundaries", text: "What it deliberately does not handle." }] },
    { type: "callout", tone: "note", title: "Start with verified facts", text: "Record decisions and assumptions separately. Do not invent measurements or present example data as real results." },
    { type: "heading", text: "Example chart", level: 2 },
    { type: "chart", variant: "bar", title: "Illustrative data — not project metrics", unit: "examples", data: [{ label: "Overview", value: 4 }, { label: "Guides", value: 7 }, { label: "Reference", value: 5 }] },
    { type: "heading", text: "How a request flows", level: 2 },
    { type: "diagram", title: "Example flow - replace with the real one", direction: "down", nodes: [
      { id: "user", label: "Person", detail: "Asks for something", role: "actor" },
      { id: "app", label: "This component", detail: "Validates and routes", role: "system" },
      { id: "store", label: "Database", role: "store" },
    ], edges: [
      { from: "user", to: "app", label: "request" },
      { from: "app", to: "store", label: "reads / writes" },
    ] },
    { type: "details", title: "Implementation notes", text: "Add constraints and details a future contributor should know." },
  ],
};
