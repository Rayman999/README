"use client";

import Link from "@/components/shell/NavigationLink";
import { useReadingRecords } from "@/components/reading/ReadingRecords";
import { useNextRead, type ReadablePage } from "@/components/reading/ReadMarks";
import { formatMinutes } from "@/lib/reading/format";

export type OverviewPage = ReadablePage & { slug: string; minutes: number };
export type OverviewSection = { id: string; parentId: string | null; depth: number; number: string; slug: string; title: string; description: string; pages: OverviewPage[] };


function useReadMinutes(pages: OverviewPage[]) {
  const { records } = useReadingRecords();
  return pages.reduce((sum, page) => {
    const record = records[page.id];
    if (!record) return sum;
    return sum + (record.done ? page.minutes : page.minutes * Math.min(0.95, record.progress));
  }, 0);
}

/** The cover's call to action: one ring, one next step. */
export function StartCard({ pages }: { pages: OverviewPage[] }) {
  const { read, total, target, label } = useNextRead(pages);
  const totalMinutes = pages.reduce((sum, page) => sum + page.minutes, 0);
  const readMinutes = useReadMinutes(pages);
  if (total === 0 || !target) return null;

  const share = totalMinutes ? readMinutes / totalMinutes : 0;
  const left = Math.max(0, Math.round(totalMinutes - readMinutes));
  const R = 34;
  const C = 2 * Math.PI * R;
  const next = pages.find((page) => page.id === target.id);

  return (
    <aside className="ov-start" aria-label="Your progress through this project">
      <div className="ov-ring" role="img" aria-label={`${read} of ${total} pages read`}>
        <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
          <circle cx="40" cy="40" r={R} className="ov-ring-track" />
          <circle cx="40" cy="40" r={R} className="ov-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - share)} />
        </svg>
        <span className="ov-ring-value">
          <strong>{Math.round(share * 100)}%</strong>
        </span>
      </div>
      <p className="ov-start-count">
        {read === 0 ? (
          <>New to this project? <strong>{formatMinutes(totalMinutes)}</strong> reads it all.</>
        ) : read === total ? (
          <>You&rsquo;ve read all <strong>{total}</strong> pages.</>
        ) : (
          <><strong>{read}</strong> of {total} pages read · {formatMinutes(left)} left</>
        )}
      </p>
      <Link href={target.href} className="ov-start-next">
        <span className="ov-start-label">{label}</span>
        <span className="ov-start-title">{target.title}</span>
        {next && <span className="ov-start-meta">{next.minutes} min read</span>}
        <span aria-hidden className="ov-start-arrow">→</span>
      </Link>
    </aside>
  );
}

/** The whole project at a glance: one bar, a segment per section sized by reading time. */
export function ReadingMap({ sections }: { sections: OverviewSection[] }) {
  const { records } = useReadingRecords();
  // One segment per top-level folder, covering everything inside it.
  const groups: { id: string; slug: string; title: string; pages: OverviewPage[] }[] = [];
  for (const section of sections) {
    if (section.depth === 0) groups.push({ id: section.id, slug: section.slug, title: section.title, pages: [...section.pages] });
    else groups.at(-1)?.pages.push(...section.pages);
  }
  const withPages = groups.filter((group) => group.pages.length > 0);
  if (withPages.length < 2) return null;
  return (
    <nav className="ov-map" aria-label="Folders at a glance">
      {withPages.map((section, index) => {
        const minutes = section.pages.reduce((sum, page) => sum + page.minutes, 0);
        const read = section.pages.reduce((sum, page) => {
          const record = records[page.id];
          return sum + (record?.done ? page.minutes : record ? page.minutes * Math.min(0.95, record.progress) : 0);
        }, 0);
        return (
          <a key={section.id} href={`#chapter-${section.slug}`} className="ov-map-segment" style={{ flexGrow: Math.max(1, minutes) }}>
            <span className="ov-map-bar"><span style={{ width: `${(read / Math.max(1, minutes)) * 100}%` }} /></span>
            <span className="ov-map-label">
              <span className="ov-map-index">{String(index + 1).padStart(2, "0")}</span> {section.title}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

export function ChapterProgress({ pages }: { pages: OverviewPage[] }) {
  const { records } = useReadingRecords();
  const read = pages.filter((page) => records[page.id]?.done).length;
  const minutes = pages.reduce((sum, page) => sum + page.minutes, 0);
  return (
    <span className="ov-chapter-meta">
      {pages.length} page{pages.length === 1 ? "" : "s"} · {formatMinutes(minutes)}
      {read > 0 && <span className="ov-chapter-read">{read === pages.length ? " · Done" : ` · ${read} read`}</span>}
    </span>
  );
}
