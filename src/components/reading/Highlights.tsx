"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SavedHighlight = { id: string; quote: string; prefix: string; suffix: string; note: string | null };

const CONTEXT = 32;
const NAME = "reader-highlight";
const ACTIVE = "reader-highlight-active";
// Kept here rather than in globals.css: the CSS build doesn't parse
// ::highlight() yet, while every current browser supports it.
const PAINT = `::highlight(${NAME}){background-color:var(--highlight-bg);color:inherit}::highlight(${ACTIVE}){background-color:var(--highlight-active)}`;

type TextIndex = { text: string; nodes: { node: Text; start: number }[] };

/** Every text node in the article, concatenated, so quotes can be found by offset. */
function indexText(root: HTMLElement): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      (node.parentElement?.closest(".code-copy, .rd-anchor, [aria-hidden=true]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: TextIndex["nodes"] = [];
  let text = "";
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    nodes.push({ node, start: text.length });
    text += node.data;
  }
  return { text, nodes };
}

function rangeFor(index: TextIndex, start: number, end: number): Range | null {
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

/** Find a quote, preferring the occurrence whose surroundings match best. */
function locate(index: TextIndex, h: SavedHighlight): Range | null {
  let best = -1;
  let bestScore = -1;
  for (let at = index.text.indexOf(h.quote); at !== -1; at = index.text.indexOf(h.quote, at + 1)) {
    const before = index.text.slice(Math.max(0, at - h.prefix.length), at);
    const after = index.text.slice(at + h.quote.length, at + h.quote.length + h.suffix.length);
    const score = (before === h.prefix ? 2 : before.endsWith(h.prefix.slice(-8)) ? 1 : 0)
      + (after === h.suffix ? 2 : after.startsWith(h.suffix.slice(0, 8)) ? 1 : 0);
    if (score > bestScore) { best = at; bestScore = score; }
    if (score === 4) break;
  }
  return best === -1 ? null : rangeFor(index, best, best + h.quote.length);
}

/** Absolute offset of a DOM point within the indexed text. */
function offsetOf(index: TextIndex, container: Node, offset: number) {
  for (const entry of index.nodes) if (entry.node === container) return entry.start + offset;
  // Selection ended on an element boundary: measure the text before it.
  const probe = document.createRange();
  probe.setStart(index.nodes[0]?.node ?? container, 0);
  probe.setEnd(container, offset);
  return probe.toString().length;
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  // Older WebKit/Blink.
  const legacy = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(x, y);
  return legacy ? { node: legacy.startContainer, offset: legacy.startOffset } : null;
}

const supported = () => typeof CSS !== "undefined" && "highlights" in CSS;

/**
 * Personal highlights and notes on the article. Painted with the CSS Custom
 * Highlight API so the article's DOM is never modified — React keeps full
 * ownership of it — and re-anchored by quote and context on every load.
 */
export function Highlights({ pageId, initial }: { pageId: string; initial: SavedHighlight[] }) {
  const [items, setItems] = useState(initial);
  const [ranges, setRanges] = useState<Map<string, Range>>(new Map());
  const [selection, setSelection] = useState<{ x: number; y: number; quote: string; prefix: string; suffix: string } | null>(null);
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const content = useRef<HTMLElement | null>(null);
  // Nothing renders on the server (the Highlight API is browser-only), so
  // the first client render must match that.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Anchor and paint.
  const paint = useCallback(() => {
    const root = content.current;
    if (!root || !supported()) return;
    const index = indexText(root);
    const next = new Map<string, Range>();
    for (const item of items) {
      const range = locate(index, item);
      if (range) next.set(item.id, range);
    }
    setRanges(next);
    CSS.highlights.set(NAME, new Highlight(...next.values()));
  }, [items]);

  useEffect(() => {
    content.current = document.querySelector<HTMLElement>(".reading-content");
    paint();
    const observer = new ResizeObserver(() => paint());
    if (content.current) observer.observe(content.current);
    // Bionic reading rewraps text nodes; re-anchor when that happens.
    const onContent = () => paint();
    window.addEventListener("reader:content", onContent);
    return () => {
      observer.disconnect();
      window.removeEventListener("reader:content", onContent);
    };
  }, [paint]);

  useEffect(() => () => {
    if (!supported()) return;
    CSS.highlights.delete(NAME);
    CSS.highlights.delete(ACTIVE);
  }, []);

  useEffect(() => {
    if (!supported()) return;
    const range = open ? ranges.get(open.id) : undefined;
    if (range) CSS.highlights.set(ACTIVE, new Highlight(range));
    else CSS.highlights.delete(ACTIVE);
  }, [open, ranges]);

  // Offer "Highlight" for a selection inside the article.
  useEffect(() => {
    const onUp = () => {
      window.setTimeout(() => {
        const root = content.current;
        const sel = window.getSelection();
        if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return setSelection(null);
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return setSelection(null);
        const quote = range.toString();
        if (!quote.trim() || quote.length > 4000) return setSelection(null);
        const index = indexText(root);
        const start = offsetOf(index, range.startContainer, range.startOffset);
        const end = start + quote.length;
        const rect = range.getBoundingClientRect();
        setSelection({
          x: rect.left + rect.width / 2,
          y: rect.top,
          quote,
          prefix: index.text.slice(Math.max(0, start - CONTEXT), start),
          suffix: index.text.slice(end, end + CONTEXT),
        });
      }, 0);
    };
    const onScroll = () => setSelection(null);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("keyup", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("keyup", onUp);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Clicking painted text opens that highlight's note.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!content.current?.contains(event.target as Node)) return;
      if (window.getSelection()?.isCollapsed === false) return;
      const caret = caretAt(event.clientX, event.clientY);
      if (!caret) return;
      for (const [id, range] of ranges) {
        if (range.isPointInRange(caret.node, caret.offset)) {
          const item = items.find((entry) => entry.id === id);
          setDraft(item?.note ?? "");
          setOpen({ id, x: event.clientX, y: event.clientY });
          setError("");
          return;
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [ranges, items]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    const onScroll = () => setOpen(null);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  async function create(withNote: boolean) {
    if (!selection) return;
    const { quote, prefix, suffix, x, y } = selection;
    setError("");
    const response = await fetch("/api/reader/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, quote, prefix, suffix }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Couldn't save that highlight. Check your connection and try again.");
      return;
    }
    const { highlight } = await response.json();
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setItems((current) => [...current, highlight]);
    if (withNote) {
      setDraft("");
      setOpen({ id: highlight.id, x, y: y + 24 });
    }
  }

  async function saveNote() {
    if (!open) return;
    const note = draft.trim() || null;
    const response = await fetch(`/api/reader/highlights/${open.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }).catch(() => null);
    if (!response?.ok) return setError("Couldn't save the note. Try again.");
    setItems((current) => current.map((item) => (item.id === open.id ? { ...item, note } : item)));
    setOpen(null);
  }

  async function remove() {
    if (!open) return;
    const response = await fetch(`/api/reader/highlights/${open.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) return setError("Couldn't remove the highlight. Try again.");
    setItems((current) => current.filter((item) => item.id !== open.id));
    setOpen(null);
  }

  if (!mounted || !supported()) return null;

  const notes = items.filter((item) => item.note && ranges.has(item.id));
  const clamp = (x: number) => Math.min(window.innerWidth - 170, Math.max(170, x));

  return (
    <>
      <style>{PAINT}</style>
      {selection && (
        <div className="hl-toolbar" style={{ left: clamp(selection.x), top: Math.max(64, selection.y - 46) }} role="toolbar" aria-label="Highlight selection">
          <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => void create(false)}>
            <span className="hl-swatch" aria-hidden /> Highlight
          </button>
          <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => void create(true)}>
            Add note
          </button>
        </div>
      )}

      {notes.map((item) => {
        const rects = ranges.get(item.id)!.getClientRects();
        const last = rects[rects.length - 1];
        // Dots are positioned inside the page panel, so they scroll with it.
        const panel = content.current?.closest(".doc-panel")?.getBoundingClientRect();
        if (!last || !panel) return null;
        return (
          <button
            key={item.id}
            type="button"
            className="hl-note-dot"
            style={{ left: last.right - panel.left + 3, top: last.top - panel.top - 3 }}
            aria-label="Open note"
            onClick={(event) => {
              event.stopPropagation();
              setDraft(item.note ?? "");
              setOpen({ id: item.id, x: last.right, y: last.bottom });
            }}
          />
        );
      })}

      {open && (
        <div className="hl-popover" style={{ left: clamp(open.x), top: Math.min(window.innerHeight - 220, open.y + 14) }} role="dialog" aria-label="Note">
          <textarea
            autoFocus
            value={draft}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a note for yourself…"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void saveNote();
            }}
          />
          <div className="hl-popover-actions">
            <button type="button" className="hl-remove" onClick={() => void remove()}>Remove highlight</button>
            <span />
            <button type="button" onClick={() => setOpen(null)}>Cancel</button>
            <button type="button" className="hl-save" onClick={() => void saveNote()}>Save</button>
          </div>
        </div>
      )}

      {error && <p className="hl-error" role="alert">{error}</p>}
    </>
  );
}
