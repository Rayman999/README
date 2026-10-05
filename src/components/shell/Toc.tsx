"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { TocEntry } from "./types";
import { getLive, getServerLive, subscribeLive } from "@/lib/reading/state";

/** Glide to a section, but keep the URL hash so it can still be shared. */
function jumpTo(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  history.replaceState(history.state, "", `#${id}`);
}

function useActiveHeading(entries: TocEntry[]) {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    if (entries.length === 0) return;
    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    // The active section is the last heading that has scrolled above the
    // reading line, so a long section stays active until the next one starts.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= line) current = heading.id;
        else break;
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [entries]);

  return activeId;
}

export function Toc({ entries }: { entries: TocEntry[] }) {
  const activeId = useActiveHeading(entries);
  const live = useSyncExternalStore(subscribeLive, getLive, getServerLive);

  if (entries.length === 0) return null;
  const activeIndex = Math.max(0, entries.findIndex((entry) => entry.id === activeId));
  const left = Math.ceil(live.minutes * (1 - live.progress));

  return (
    <nav aria-label="On this page" className="toc">
      <p className="toc-label">On this page</p>
      <ol className="toc-list">
        {entries.map((entry, index) => (
          <li
            key={entry.id}
            data-level={entry.level}
            data-state={index < activeIndex ? "read" : index === activeIndex ? "active" : "ahead"}
          >
            <a
              href={`#${entry.id}`}
              aria-current={index === activeIndex ? "location" : undefined}
              onClick={(event) => jumpTo(event, entry.id)}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
      {live.minutes > 0 && (
        <div className="toc-foot">
          <span>{live.progress >= 0.95 ? "Finished" : left <= 1 ? "Under a minute left" : `${left} min left`}</span>
          <a
            href="#main-content"
            onClick={(event) => {
              event.preventDefault();
              const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
            }}
          >
            Back to top
          </a>
        </div>
      )}
    </nav>
  );
}

/** The same outline, folded into the article header where there's no side rail. */
export function InlineOutline({ entries }: { entries: TocEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <details className="inline-outline">
      <summary>On this page <span>{entries.filter((entry) => entry.level === 2).length} sections</span></summary>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id} data-level={entry.level}>
            <a href={`#${entry.id}`} onClick={(event) => jumpTo(event, entry.id)}>{entry.text}</a>
          </li>
        ))}
      </ol>
    </details>
  );
}
