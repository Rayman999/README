"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "./types";

export function Toc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    entries[0]?.id ?? null,
  );

  useEffect(() => {
    if (entries.length === 0) return;

    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Bias the band toward the top of the viewport so the active entry
      // corresponds to what is being read, not what is merely on screen.
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="On this page" className="text-[12.5px]">
      <p className="mb-3 text-[10.5px] font-medium tracking-[0.08em] text-muted uppercase">
        On this page
      </p>
      <ul>
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                style={{
                  paddingLeft: entry.level === 3 ? 12 : 0,
                  transitionDuration: "var(--dur-slow)",
                }}
                className={`ease-base relative block py-[5px] transition-colors ${
                  active ? "text-primary" : "text-tertiary hover:text-primary"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-[6px] bottom-[6px] -left-3 w-[2px] rounded-full"
                    style={{ background: "rgba(255,255,255,0.22)" }}
                  />
                )}
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
