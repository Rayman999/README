"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getPrefs, reducedMotion, setPrefs, subscribePrefs, NUMBER_PREFS } from "@/lib/reading/prefs";
import {
  caretAt,
  contentChanged,
  highlightsSupported,
  indexText,
  offsetIn,
  rangeFor,
  readableBlocks,
  sentences,
} from "@/lib/reading/text";

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

/** Paint rules for every ::highlight() name; the CSS build can't parse them. */
const PAINT = [
  "::highlight(reader-sentence){color:var(--reading-color)}",
  "::highlight(reader-speaking){background-color:var(--highlight-bg);color:var(--text-heading)}",
  "::highlight(reader-glossary){text-decoration:underline dotted;text-decoration-color:var(--text-tertiary);text-decoration-thickness:1.5px}",
].join("");

export function FeaturePaint() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && highlightsSupported() ? <style>{PAINT}</style> : null;
}

/** True while <html> carries `name` — kept in sync with preference changes. */
function useHtmlClass(name: string) {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.documentElement.classList.contains(name),
    () => false,
  );
}

function useNumberPref(key: keyof typeof NUMBER_PREFS, fallback: number) {
  return useSyncExternalStore(subscribePrefs, () => getPrefs()[key], () => fallback);
}

function useBoolPref(key: "glossary", fallback: boolean) {
  return useSyncExternalStore(subscribePrefs, () => getPrefs()[key], () => fallback);
}

function setHighlight(name: string, ranges: Range[]) {
  if (!highlightsSupported()) return;
  if (ranges.length) CSS.highlights.set(name, new Highlight(...ranges));
  else CSS.highlights.delete(name);
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** A tiny observable value, for state shared between a button and a dock. */
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => { value = next; listeners.forEach((listener) => listener()); },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

function useStore<T>(store: ReturnType<typeof createStore<T>>, server: T) {
  return useSyncExternalStore(store.subscribe, store.get, () => server);
}

// ---------------------------------------------------------------------------
// Reading speed
// ---------------------------------------------------------------------------

export function useWpm() {
  return useNumberPref("wpm", 230);
}

export function minutesFor(words: number, wpm: number) {
  return Math.max(1, Math.round(words / wpm));
}

/** "6 min read", following the reader's own reading speed. */
export function ReadMinutes({ words, suffix = " min read" }: { words: number; suffix?: string }) {
  const wpm = useWpm();
  return <>{minutesFor(words, wpm)}{suffix}</>;
}

// ---------------------------------------------------------------------------
// Sentence focus
// ---------------------------------------------------------------------------

/** Lights the sentence under the mouse (or at the reading line on touch). */
export function SentenceFocus({ root = ".reading-content" }: { root?: string }) {
  const on = useHtmlClass("sentence-focus");
  useEffect(() => {
    if (!on || !highlightsSupported()) return;
    const container = document.querySelector<HTMLElement>(root);
    if (!container) return;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let lit = false;

    const update = () => {
      frame = 0;
      const rect = container.getBoundingClientRect();
      const x = pointer?.x ?? rect.left + rect.width / 2;
      const y = pointer?.y ?? window.innerHeight * 0.35;
      const hit = document.elementFromPoint(x, y);
      let block = hit?.closest<HTMLElement>("p, li, h2, h3, h4, blockquote, td, th, figcaption") ?? null;
      if (!block || !container.contains(block)) {
        // Nothing under the point: keep what's lit, or light the first sentence.
        if (lit) return;
        block = readableBlocks(container)[0] ?? null;
        if (!block) return;
      }
      const index = indexText(block);
      const caret = caretAt(x, y);
      let at = caret ? offsetIn(index, caret.node, caret.offset) : -1;
      if (at < 0) at = 0;
      const sentence = sentences(index.text).find((entry) => at >= entry.start && at <= entry.end) ?? sentences(index.text)[0];
      const range = sentence ? rangeFor(index, sentence.start, sentence.end) : null;
      if (range) { setHighlight("reader-sentence", [range]); lit = true; }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    update();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("reader:content", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("reader:content", schedule);
      setHighlight("reader-sentence", []);
    };
  }, [on, root]);
  return null;
}

// ---------------------------------------------------------------------------
// Bionic reading
// ---------------------------------------------------------------------------

const WORD = /(\p{L}[\p{L}\p{M}'’-]*)/u;

function boldLength(word: string) {
  const n = [...word].length;
  return n <= 3 ? 1 : n === 4 ? 2 : Math.ceil(n * 0.42);
}

function applyBionic(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("pre, code, kbd, svg, .rd-anchor, .code-copy, b.bionic, [aria-hidden=true]") || !WORD.test((node as Text).data)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const targets: Text[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) targets.push(node);
  for (const node of targets) {
    const fragment = document.createDocumentFragment();
    for (const part of node.data.split(WORD)) {
      if (!part) continue;
      if (WORD.test(part) && new RegExp(`^${WORD.source}$`, "u").test(part)) {
        const chars = [...part];
        const head = chars.slice(0, boldLength(part)).join("");
        const b = document.createElement("b");
        b.className = "bionic";
        b.textContent = head;
        fragment.append(b, chars.slice(head.length).join(""));
      } else {
        fragment.append(part);
      }
    }
    node.replaceWith(fragment);
  }
}

function removeBionic(container: HTMLElement) {
  const parents = new Set<Node>();
  for (const b of container.querySelectorAll("b.bionic")) {
    if (b.parentNode) parents.add(b.parentNode);
    b.replaceWith(b.textContent ?? "");
  }
  parents.forEach((parent) => parent.normalize());
}

/**
 * Bolds the start of each word. The one feature that has to touch the
 * article DOM (bold can't be painted with highlights); it only wraps text
 * nodes and is fully reverted when switched off or when leaving the page.
 */
export function Bionic({ root = ".reading-content" }: { root?: string }) {
  const on = useHtmlClass("bionic");
  useEffect(() => {
    if (!on) return;
    const container = document.querySelector<HTMLElement>(root);
    const body = container?.querySelector<HTMLElement>(".doc-body, .readme-document");
    if (!body) return;
    applyBionic(body);
    contentChanged();
    return () => {
      removeBionic(body);
      contentChanged();
    };
  }, [on, root]);
  return null;
}

// ---------------------------------------------------------------------------
// Glossary hover
// ---------------------------------------------------------------------------

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Underlines the project's own terms; hovering one shows its definition. */
export function GlossaryHover({ glossary, root = ".reading-content" }: { glossary: Record<string, string>; root?: string }) {
  const on = useBoolPref("glossary", true);
  const [card, setCard] = useState<{ term: string; meaning: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const terms = Object.keys(glossary).filter((term) => term.trim().length > 1);
    if (!on || !terms.length || !highlightsSupported()) return;
    const container = document.querySelector<HTMLElement>(root);
    const body = container?.querySelector<HTMLElement>(".doc-body, .readme-document");
    if (!body) return;
    const lookup = new Map(terms.map((term) => [term.toLowerCase(), term]));
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`, "giu");
    let found: { range: Range; term: string }[] = [];

    const scan = () => {
      const index = indexText(body, ".code-copy, .rd-anchor, [aria-hidden=true], pre, code, script, style");
      // Only the first mention of each term per section (between h2s) is
      // marked — underlining every mention turns a page into noise.
      const sectionStarts = [...body.querySelectorAll("h2")]
        .map((heading) => index.nodes.find((entry) => heading.contains(entry.node))?.start ?? -1)
        .filter((start) => start >= 0);
      const sectionOf = (at: number) => sectionStarts.filter((start) => start <= at).length;
      const seen = new Set<string>();
      found = [];
      for (let m = pattern.exec(index.text); m; m = pattern.exec(index.text)) {
        const term = lookup.get(m[0].toLowerCase());
        const key = `${term}|${sectionOf(m.index)}`;
        if (!term || seen.has(key)) continue;
        seen.add(key);
        const range = rangeFor(index, m.index, m.index + m[0].length);
        if (range) found.push({ range, term });
      }
      setHighlight("reader-glossary", found.map((entry) => entry.range));
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const caret = caretAt(event.clientX, event.clientY);
      const hit = caret && found.find((entry) => entry.range.isPointInRange(caret.node, caret.offset));
      if (!hit) { setCard((value) => (value ? null : value)); return; }
      const box = hit.range.getBoundingClientRect();
      setCard((value) => (value?.term === hit.term && value.y === box.bottom ? value : { term: hit.term, meaning: glossary[hit.term], x: box.left, y: box.bottom }));
    };
    const hide = () => setCard(null);
    scan();
    window.addEventListener("reader:content", scan);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      window.removeEventListener("reader:content", scan);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", hide);
      setHighlight("reader-glossary", []);
      setCard(null);
    };
  }, [on, glossary, root]);

  if (!card) return null;
  return (
    <dl className="glossary-card" role="tooltip" style={{ left: Math.min(card.x, window.innerWidth - 336), top: card.y + 8 }}>
      <dt>{card.term}</dt>
      <dd>{card.meaning}</dd>
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Read aloud
// ---------------------------------------------------------------------------

type Speech = { state: "idle" | "playing" | "paused"; index: number; total: number };
const speech = createStore<Speech>({ state: "idle", index: 0, total: 0 });
let queue: { range: Range; text: string }[] = [];

function voiceFor(name: string) {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.name === name) ?? voices.find((voice) => voice.default) ?? null;
}

function speakAt(index: number) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const item = queue[index];
  if (!item) { stopSpeaking(); return; }
  speech.set({ state: "playing", index, total: queue.length });
  setHighlight("reader-speaking", [item.range]);
  const box = item.range.getBoundingClientRect();
  if (box.top < 80 || box.bottom > window.innerHeight - 100) {
    window.scrollBy({ top: box.top - window.innerHeight * 0.35, behavior: reducedMotion() ? "auto" : "smooth" });
  }
  const utterance = new SpeechSynthesisUtterance(item.text);
  const prefs = getPrefs();
  utterance.rate = prefs.voiceRate;
  const voice = voiceFor(prefs.voice);
  if (voice) utterance.voice = voice;
  utterance.onend = () => {
    if (speech.get().state === "playing" && speech.get().index === index) speakAt(index + 1);
  };
  synth.speak(utterance);
}

export function startSpeaking(rootSelector = ".reading-content") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const container = document.querySelector<HTMLElement>(rootSelector);
  if (!container) return;
  queue = readableBlocks(container).flatMap((block) => {
    const index = indexText(block);
    return sentences(index.text).flatMap((sentence) => {
      const range = rangeFor(index, sentence.start, sentence.end);
      return range ? [{ range, text: sentence.text }] : [];
    });
  });
  // Start where the reader is, not at the top of the page.
  const first = queue.findIndex((item) => item.range.getBoundingClientRect().bottom > 90);
  speakAt(Math.max(0, first));
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  queue = [];
  setHighlight("reader-speaking", []);
  speech.set({ state: "idle", index: 0, total: 0 });
}

function togglePause() {
  const synth = window.speechSynthesis;
  const current = speech.get();
  if (current.state === "playing") { synth.pause(); speech.set({ ...current, state: "paused" }); }
  else if (current.state === "paused") { synth.resume(); speech.set({ ...current, state: "playing" }); }
}

export function ListenButton() {
  const state = useStore(speech, { state: "idle", index: 0, total: 0 }).state;
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported("speechSynthesis" in window), []);
  if (!supported) return null;
  return (
    <button type="button" className="toolbar-button" aria-pressed={state !== "idle"} title="Read this page aloud (L)" onClick={() => (state === "idle" ? startSpeaking() : stopSpeaking())}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 6v4h2.5L9 13V3L5.5 6zM11.5 5.5a3.5 3.5 0 0 1 0 5M13 3.5a6 6 0 0 1 0 9" />
      </svg>
      {state === "idle" ? "Listen" : "Stop"}
    </button>
  );
}

function SpeechDock() {
  const value = useStore(speech, { state: "idle", index: 0, total: 0 });
  const rate = useNumberPref("voiceRate", 1);
  if (value.state === "idle") return null;
  return (
    <div className="reader-dock" role="group" aria-label="Read aloud">
      <span className="reader-dock-label">Reading aloud · {value.index + 1}/{value.total}</span>
      <button type="button" aria-label="Previous sentence" onClick={() => speakAt(Math.max(0, value.index - 1))}>‹</button>
      <button type="button" onClick={togglePause}>{value.state === "playing" ? "Pause" : "Resume"}</button>
      <button type="button" aria-label="Next sentence" onClick={() => speakAt(value.index + 1)}>›</button>
      <span className="reader-dock-sep" aria-hidden />
      <select aria-label="Speed" value={rate} onChange={(event) => { setPrefs({ voiceRate: Number(event.target.value) }); speakAt(value.index); }}>
        {[0.75, 1, 1.25, 1.5, 1.75, 2].map((option) => <option key={option} value={option}>{option}×</option>)}
      </select>
      <button type="button" aria-label="Stop reading aloud" onClick={stopSpeaking}>×</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-scroll
// ---------------------------------------------------------------------------

const scroller = createStore<"off" | "running" | "paused">("off");

export function toggleAutoScroll() {
  scroller.set(scroller.get() === "off" ? "running" : "off");
}

export function AutoScrollButton() {
  const state = useStore(scroller, "off");
  return (
    <button type="button" className="toolbar-button" aria-pressed={state !== "off"} title="Scroll slowly on its own; Space pauses (A)" onClick={toggleAutoScroll}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 2.5v11M4.5 10 8 13.5 11.5 10" />
      </svg>
      {state === "off" ? "Auto-scroll" : "Stop scroll"}
    </button>
  );
}

function AutoScrollEngine() {
  const state = useStore(scroller, "off");
  const speed = useNumberPref("scrollSpeed", 40);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (state !== "running") return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      carry += (speedRef.current * (now - last)) / 1000;
      last = now;
      const whole = Math.floor(carry);
      if (whole >= 1) { window.scrollBy(0, whole); carry -= whole; }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) { scroller.set("off"); return; }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  useEffect(() => {
    if (state === "off") return;
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === " ") { event.preventDefault(); scroller.set(scroller.get() === "running" ? "paused" : "running"); }
      else if (event.key === "Escape") scroller.set("off");
    };
    // Grabbing the wheel means "let me drive": pause.
    const onWheel = () => { if (scroller.get() === "running") scroller.set("paused"); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("wheel", onWheel); };
  }, [state]);

  if (state === "off") return null;
  const nudge = (delta: number) => {
    const { min, max } = NUMBER_PREFS.scrollSpeed;
    setPrefs({ scrollSpeed: Math.min(max, Math.max(min, speed + delta)) });
  };
  return (
    <div className="reader-dock" role="group" aria-label="Auto-scroll">
      <span className="reader-dock-label">{state === "running" ? "Auto-scrolling" : "Paused"} · {speed} px/s</span>
      <button type="button" aria-label="Slower" onClick={() => nudge(-5)}>−</button>
      <button type="button" aria-label="Faster" onClick={() => nudge(5)}>+</button>
      <button type="button" onClick={() => scroller.set(state === "running" ? "paused" : "running")}>{state === "running" ? "Pause" : "Resume"}</button>
      <button type="button" aria-label="Stop auto-scroll" onClick={() => scroller.set("off")}>×</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distraction-free
// ---------------------------------------------------------------------------

const zen = createStore(false);

export function toggleZen() {
  const next = !zen.get();
  zen.set(next);
  document.documentElement.classList.toggle("zen-mode", next);
  if (next) void document.documentElement.requestFullscreen?.().catch(() => { /* class alone still hides everything */ });
  else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

export function ZenButton() {
  const on = useStore(zen, false);
  return (
    <button type="button" className="toolbar-button focus-toggle" aria-pressed={on} title="Full screen with only the text (Z)" onClick={toggleZen}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2.5 5.5v-3h3M13.5 5.5v-3h-3M2.5 10.5v3h3M13.5 10.5v3h-3M5.5 6h5M5.5 8h5M5.5 10h3" />
      </svg>
      Distraction-free
    </button>
  );
}

function ZenEngine() {
  const on = useStore(zen, false);
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement && zen.get()) { zen.set(false); document.documentElement.classList.remove("zen-mode"); } };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // Leaving the page leaves the mode.
      if (zen.get()) { zen.set(false); document.documentElement.classList.remove("zen-mode"); }
    };
  }, []);
  return on ? <button type="button" className="zen-exit" onClick={toggleZen}>Exit distraction-free (Esc)</button> : null;
}

// ---------------------------------------------------------------------------
// Everything a reading page mounts
// ---------------------------------------------------------------------------

export function ReaderFeatures({ glossary }: { glossary: Record<string, string> }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (key === "a") toggleAutoScroll();
      else if (key === "l") {
        if (speech.get().state === "idle") startSpeaking();
        else stopSpeaking();
      }
      else if (key === "z") toggleZen();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stopSpeaking();
      scroller.set("off");
    };
  }, []);

  return (
    <>
      <FeaturePaint />
      <SentenceFocus />
      <Bionic />
      <GlossaryHover glossary={glossary} />
      <ZenEngine />
      <div className="reader-docks">
        <SpeechDock />
        <AutoScrollEngine />
      </div>
    </>
  );
}
