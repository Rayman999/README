"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getPrefs, setPrefs } from "@/lib/reading/prefs";
import {
  getLive,
  getRecord,
  getServerLive,
  saveRecord,
  setLive,
  subscribeLive,
} from "@/lib/reading/state";

const DONE_AT = 0.95;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
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
 * progress line, remembering position, marking it read, resume, keyboard
 * paging and copy buttons on code. Renders only fixed-position UI.
 */
export function ReaderRuntime({
  href,
  minutes,
  previousHref,
  nextHref,
}: {
  href: string;
  minutes: number;
  previousHref?: string;
  nextHref?: string;
}) {
  const router = useRouter();
  const bar = useRef<HTMLDivElement>(null);
  const [resume, setResume] = useState<{ y: number; label: string | null } | null>(null);

  // Progress tracking.
  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".reading-content");
    if (!content) return;
    let frame = 0;
    let lastSave = 0;
    let last = { progress: 0, y: 0 };
    // Nothing is saved until the reader scrolls, so arriving at the top of a
    // page never overwrites the position they left it at.
    let moved = false;

    const measure = () => {
      frame = 0;
      // During a client navigation the router removes this article and resets
      // scroll before this component unmounts (and before the URL changes);
      // that reset must not be recorded as the reader's position.
      if (!content.isConnected || decodeURI(window.location.pathname) !== href) return;
      const rect = content.getBoundingClientRect();
      const line = window.innerHeight * 0.35;
      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const progress = atBottom
        ? 1
        : Math.max(0, Math.min(1, (line - rect.top) / Math.max(1, rect.height)));
      bar.current?.style.setProperty("--progress", String(progress));
      setLive({ progress, minutes });
      last = { progress, y: Math.round(window.scrollY) };

      const now = Date.now();
      if (moved && (now - lastSave > 500 || progress >= DONE_AT)) {
        lastSave = now;
        saveRecord(href, { progress, y: Math.round(window.scrollY), done: progress >= DONE_AT });
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Only real input counts as the reader moving; the router's own scroll
    // resets on arrival and departure don't.
    const onIntent = () => {
      moved = true;
    };
    const INTENT = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    INTENT.forEach((type) => window.addEventListener(type, onIntent, { passive: true }));
    const onScroll = schedule;

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    // Leaving mid-page shouldn't lose the last half-second of position.
    const flush = () => {
      if (moved) saveRecord(href, { ...last, done: last.progress >= DONE_AT });
    };
    window.addEventListener("pagehide", flush);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pagehide", flush);
      INTENT.forEach((type) => window.removeEventListener(type, onIntent));
      flush();
      setLive({ progress: 0, minutes: 0 });
    };
  }, [href, minutes]);

  // Offer to pick up where the reader left off.
  useEffect(() => {
    if (window.location.hash) return;
    const record = getRecord(href);
    if (!record || record.done || record.y < 600) return;
    const y = record.y;
    // Measure after layout settles so the heading lookup is accurate.
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
  }, [href]);

  // Keyboard paging and focus mode.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "]" && nextHref) router.push(nextHref);
      else if (event.key === "[" && previousHref) router.push(previousHref);
      else if (event.key === "f" || event.key === "F") setPrefs({ focus: !getPrefs().focus });
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
              const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: resume.y, behavior: reduced ? "auto" : "smooth" });
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
export function CompletionNote() {
  const live = useSyncExternalStore(subscribeLive, getLive, getServerLive);
  const finished = live.progress >= DONE_AT;
  return (
    <p className="completion-note" data-finished={finished} aria-live="polite">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3.5 8.5l3 3 6-7" />
      </svg>
      {finished ? "Finished — marked as read" : "Reach the end to mark this page as read"}
    </p>
  );
}
