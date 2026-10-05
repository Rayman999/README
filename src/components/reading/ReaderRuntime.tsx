"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getPrefs, setPrefs } from "@/lib/reading/prefs";
import { getSkim, setSkim } from "@/lib/reading/skim";
import { getLive, getServerLive, setLive, subscribeLive } from "@/lib/reading/state";
import { flushProgress, useReadingRecords } from "./ReadingRecords";

const DONE_AT = 0.95;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  minutes,
  previousHref,
  nextHref,
}: {
  pageId: string;
  minutes: number;
  previousHref?: string;
  nextHref?: string;
}) {
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
        let next: Element | null = null;
        for (const block of body?.children ?? []) {
          const box = block.getBoundingClientRect();
          if (box.bottom >= line) { next = block; break; }
        }
        if (next !== current) {
          current?.removeAttribute("data-current");
          next?.setAttribute("data-current", "");
          current = next;
        }
      }

      if (getPrefs().autoHideHeader) {
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
      <ReadingRuler />
      {resume && (
        <div className="resume-pill" role="status">
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: resume.y, behavior: prefersReducedMotion() ? "auto" : "smooth" });
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

/**
 * A soft band that follows the pointer across the article, to help keep your
 * place in long lines. Pointer devices only; hidden when the pointer leaves.
 */
function ReadingRuler() {
  const band = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const content = document.querySelector<HTMLElement>(".reading-content");
    if (!content) return;
    const onMove = (event: PointerEvent) => {
      const el = band.current;
      if (!el || !document.documentElement.dataset.ruler) return;
      const rect = content.getBoundingClientRect();
      const inside = event.clientX >= rect.left - 40 && event.clientX <= rect.right + 40
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      el.style.opacity = inside ? "1" : "0";
      if (!inside) return;
      const lineHeight = parseFloat(getComputedStyle(content.firstElementChild ?? content).lineHeight) || 28;
      el.style.left = `${rect.left - 12}px`;
      el.style.width = `${rect.width + 24}px`;
      el.style.height = `${lineHeight * 1.5}px`;
      el.style.transform = `translateY(${event.clientY - lineHeight * 0.75}px)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return <div ref={band} className="reading-ruler" aria-hidden />;
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
