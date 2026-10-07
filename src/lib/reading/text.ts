// Text-position helpers for features that paint over the article without
// changing its DOM (CSS Custom Highlight API): sentence focus, read aloud,
// glossary terms, highlights.

export type TextIndex = { text: string; nodes: { node: Text; start: number }[] };

const SKIP = ".code-copy, .rd-anchor, [aria-hidden=true], script, style";

export function indexText(root: Node, skip = SKIP): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: TextIndex["nodes"] = [];
  let text = "";
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    nodes.push({ node, start: text.length });
    text += node.data;
  }
  return { text, nodes };
}

export function rangeFor(index: TextIndex, start: number, end: number): Range | null {
  const range = document.createRange();
  let startSet = false;
  for (const { node, start: offset } of index.nodes) {
    const nodeEnd = offset + node.data.length;
    if (!startSet && start >= offset && start <= nodeEnd) {
      range.setStart(node, start - offset);
      startSet = true;
    }
    if (startSet && end >= offset && end <= nodeEnd) {
      range.setEnd(node, end - offset);
      return range;
    }
  }
  return null;
}

/** Offset of a DOM point within an index, or -1 when it isn't inside. */
export function offsetIn(index: TextIndex, node: Node, offset: number) {
  for (const entry of index.nodes) if (entry.node === node) return entry.start + offset;
  return -1;
}

export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const legacy = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(x, y);
  return legacy ? { node: legacy.startContainer, offset: legacy.startOffset } : null;
}

export type Sentence = { start: number; end: number; text: string };

/** Sentences in a block of text, via the browser's own segmenter. */
export function sentences(text: string): Sentence[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => { segment(text: string): Iterable<{ segment: string; index: number }> } }).Segmenter;
  if (!Segmenter) {
    const out: Sentence[] = [];
    const re = /[^.!?]+[.!?]*\s*/g;
    for (let m = re.exec(text); m; m = re.exec(text)) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    return out.filter((s) => s.text.trim());
  }
  return [...new Segmenter("en", { granularity: "sentence" }).segment(text)]
    .map((s) => ({ start: s.index, end: s.index + s.segment.trimEnd().length, text: s.segment.trim() }))
    .filter((s) => s.text.length > 0);
}

/** The readable blocks of an article, in order: paragraphs, list items, headings, cells. */
export function readableBlocks(root: ParentNode) {
  return [...root.querySelectorAll<HTMLElement>(":is(.doc-body, .readme-document) :is(p, li, h2, h3, h4, blockquote, td, th, figcaption, summary)")]
    .filter((el) => !el.closest("pre, .code-block, .rd-code") && !el.querySelector(":scope p, :scope li"));
}

export const highlightsSupported = () => typeof CSS !== "undefined" && "highlights" in CSS;

export function contentChanged() {
  window.dispatchEvent(new Event("reader:content"));
}
