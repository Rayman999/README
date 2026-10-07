"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { effectivePrefs, getPrefs, reducedMotion, setPrefs, subscribePrefs } from "@/lib/reading/prefs";
import { getSkim, setSkim } from "@/lib/reading/skim";
import { getLive, getServerLive, setLive, subscribeLive } from "@/lib/reading/state";
import { flushProgress, useReadingRecords } from "./ReadingRecords";

const DONE_AT = 0.95;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

const localDay = () => new Date().toLocaleDateString("en-CA");

/** Sends active reading time (and a finished page) for today's stats and streak. */
function reportActivity(seconds: number, finished: number) {
  if (seconds <= 0 && finished <= 0) return;
  void fetch("/api/reader/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day: localDay(), seconds: Math.min(600, Math.round(seconds)), finished: Math.min(5, finished) }),
    keepalive: true,
  }).catch(() => { /* stats are best effort */ });
}

/** The heading a reader was last under, so "resume" can say where it goes. */
function headingAbove(y: number) {
  const headings = document.querySelectorAll<HTMLElement>(
    ".reading-content h2[id], .reading-content h3[id]",
  );
  let label: string | null = null;
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top + window.scrollY > y + 120) break;
    label = heading.firstChild?.textContent?.trim() || heading.textContent?.trim() || null;
  }
  return label;
}

/**
 * Everything that makes a page feel alive while it is being read: the
 * progress line, saving position and marking it read, resume, paragraph
 * focus, the auto-hiding header, keyboard shortcuts and copy buttons on code.
 * Renders only fixed-position UI.
 */
export function ReaderRuntime({
  pageId,
  words,
  previousHref,
  nextHref,
}: {
  pageId: string;
  words: number;
  previousHref?: string;
  nextHref?: string;
}) {
  // Minutes follow the reader's own reading speed from settings.
  const wpm = useSyncExternalStore(subscribePrefs, () => getPrefs().wpm, () => 230);
  const minutes = Math.max(1, Math.round(words / wpm));
  const router = useRouter();
  const { records, update } = useReadingRecords();
  const bar = useRef<HTMLDivElement>(null);
  const [resume, setResume] = useState<{ y: number; label: string | null } | null>(null);
  // Captured once: the position this reader left the page at last time.
  const [arrival] = useState(() => records[pageId]);

  // Progress, paragraph focus and the auto-hiding header all follow scroll.
  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".reading-content");
    if (!content) return;
    const root = document.documentElement;
    let frame = 0;
    let lastSave = 0;
    let last = { progress: 0, y: 0 };
    let lastScrollY = window.scrollY;
    let current: Element | null = null;
    // Only real input counts as the reader moving; the router's own scroll
    // resets on arrival and departure don't.
    let moved = false;

    const measure = () => {
      frame = 0;
      // During a client navigation the router removes this article and resets
      // scroll before this component unmounts (and before the URL changes);
      // that reset must not be recorded as the reader's position.
      if (!content.isConnected) return;

      const rect = content.getBoundingClientRect();
      const line = window.innerHeight * 0.35;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const progress = atBottom ? 1 : Math.max(0, Math.min(1, (line - rect.top) / Math.max(1, rect.height)));
      bar.current?.style.setProperty("--progress", String(progress));
      setLive({ progress, minutes });

      if (root.classList.contains("paragraph-focus")) {
        const body = content.querySelector(".doc-body, .readme-document");
        let next: Element | null = current;
        if (pointer) {
          // Follow the mouse. Over a gap between blocks, or outside the
          // article, keep whatever is lit rather than flickering.
          const hit = document.elementFromPoint(pointer.x, pointer.y);
          const block = hit && body?.contains(hit) ? [...body.children].find((child) => child.contains(hit)) : undefined;
          if (block) next = block;
        } else {
          // Touch screens have no pointer to follow: use the reading line.
          next = null;
          for (const block of body?.children ?? []) {
            if (block.getBoundingClientRect().bottom >= line) { next = block; break; }
          }
        }
        if (next !== current) {
          current?.removeAttribute("data-current");
          next?.setAttribute("data-current", "");
          current = next;
        }
      }

      if (effectivePrefs().autoHideHeader) {
        const delta = window.scrollY - lastScrollY;
        if (window.scrollY < 120 || delta < -6) root.classList.remove("header-hidden");
        else if (delta > 6) root.classList.add("header-hidden");
      }
      lastScrollY = window.scrollY;

      // Skimming collapses the page, so reaching the end proves nothing.
      if (getSkim()) return;
      last = { progress, y: Math.round(window.scrollY) };
      const now = Date.now();
      if (moved && (now - lastSave > 500 || progress >= DONE_AT)) {
        lastSave = now;
        update(pageId, { ...last, done: progress >= DONE_AT });
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const onIntent = () => {
      moved = true;
    };
    // Last mouse position, for paragraph focus. Scrolling under a still
    // mouse changes what it's over, so scroll re-runs the same lookup.
    let pointer: { x: number; y: number } | null = null;
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      if (root.classList.contains("paragraph-focus")) schedule();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    const INTENT = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    INTENT.forEach((type) => window.addEventListener(type, onIntent, { passive: true }));

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      INTENT.forEach((type) => window.removeEventListener(type, onIntent));
      window.removeEventListener("pointermove", onPointer);
      if (moved) update(pageId, { ...last, done: last.progress >= DONE_AT });
      flushProgress();
      current?.removeAttribute("data-current");
      root.classList.remove("header-hidden");
      setLive({ progress: 0, minutes: 0 });
    };
  }, [pageId, minutes, update]);

  // Offer to pick up where the reader left off.
  useEffect(() => {
    if (window.location.hash) return;
    if (!arrival || arrival.done || arrival.y < 600) return;
    const y = arrival.y;
    const frame = requestAnimationFrame(() => setResume({ y, label: headingAbove(y) }));
    const startY = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 240) setResume(null);
    };
    const timer = window.setTimeout(() => setResume(null), 12000);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [arrival]);

  // Reading time for stats and streaks. Counts in 5 s ticks, only while the
  // tab is visible and the reader has done something in the last minute (or
  // read aloud / auto-scroll is doing it for them).
  useEffect(() => {
    let seconds = 0;
    let finished = 0;
    let lastInput = Date.now();
    let counted = Boolean(arrival?.done);
    const mark = () => { lastInput = Date.now(); };
    const INPUT = ["pointermove", "wheel", "keydown", "touchmove", "scroll"] as const;
    INPUT.forEach((type) => window.addEventListener(type, mark, { passive: true }));
    const flush = () => { reportActivity(seconds, finished); seconds = 0; finished = 0; };
    const tick = window.setInterval(() => {
      const assisted = document.querySelector(".reader-dock") !== null;
      if (document.visibilityState === "visible" && (assisted || Date.now() - lastInput < 60_000)) seconds += 5;
      if (!counted && getLive().progress >= DONE_AT) { counted = true; finished += 1; }
      if (seconds >= 60 || finished > 0) flush();
    }, 5000);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(tick);
      INPUT.forEach((type) => window.removeEventListener(type, mark));
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [pageId, arrival]);

  // Keyboard: paging, focus, skim.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (event.key === "]" && nextHref) router.push(nextHref);
      else if (event.key === "[" && previousHref) router.push(previousHref);
      else if (key === "f") setPrefs({ focus: !getPrefs().focus });
      else if (key === "s") setSkim(!getSkim());
      else if (event.key === "Escape" && getPrefs().focus) setPrefs({ focus: false });
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, nextHref, previousHref]);

  // Copy buttons on code blocks, from both the Markdown and block renderers.
  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-copy]");
      if (!button) return;
      const code = button.closest(".code-block, .rd-code")?.querySelector("pre");
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        button.dataset.copied = "true";
        button.textContent = "Copied";
        window.setTimeout(() => {
          delete button.dataset.copied;
          button.textContent = "Copy";
        }, 1600);
      } catch {
        button.textContent = "Press Ctrl C";
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <div ref={bar} className="reading-progress-bar" aria-hidden />
      {resume && (
        <div className="resume-pill" role="status">
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: resume.y, behavior: reducedMotion() ? "auto" : "smooth" });
              setResume(null);
            }}
          >
            <span className="resume-pill-label">Continue where you left off</span>
            {resume.label && <span className="resume-pill-where">{resume.label}</span>}
          </button>
          <button type="button" className="resume-pill-close" aria-label="Dismiss" onClick={() => setResume(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}

/** Quiet acknowledgement at the end of the article once it has been read. */
export function CompletionNote({ pageId }: { pageId: string }) {
  const live = useSyncExternalStore(subscribeLive, getLive, getServerLive);
  const { records } = useReadingRecords();
  const finished = live.progress >= DONE_AT || Boolean(records[pageId]?.done);
  return (
    <p className="completion-note" data-finished={finished} aria-live="polite">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3.5 8.5l3 3 6-7" />
      </svg>
      {finished ? "Finished — marked as read" : "Reach the end to mark this page as read"}
    </p>
  );
}
