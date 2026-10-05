"use client";

import { useSyncExternalStore } from "react";
import Link from "@/components/shell/NavigationLink";
import { getRecords, getServerRecords, subscribeRecords } from "@/lib/reading/state";

export function useRecords() {
  return useSyncExternalStore(subscribeRecords, getRecords, getServerRecords);
}

const CHECK = "M3.5 8.5l3 3 6-7";

/** A small check beside a page the reader has finished. */
export function ReadMark({ href, fallback }: { href: string; fallback?: React.ReactNode }) {
  const records = useRecords();
  const record = records[href];
  if (record?.done) {
    return (
      <span className="read-mark" title="You've read this page">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={CHECK} />
        </svg>
        <span className="sr-only">Read</span>
      </span>
    );
  }
  if (record && record.progress > 0.08) {
    return (
      <span
        className="read-mark read-mark-partial"
        title={`${Math.round(record.progress * 100)}% read`}
        style={{ "--partial": record.progress } as React.CSSProperties}
      >
        <span className="sr-only">{Math.round(record.progress * 100)}% read</span>
      </span>
    );
  }
  return <>{fallback}</>;
}

/** "3 of 12 read" plus the single most useful next step. */
export function ProjectProgress({
  pages,
}: {
  pages: { href: string; title: string; description?: string }[];
}) {
  const records = useRecords();
  if (pages.length === 0) return null;

  const read = pages.filter((page) => records[page.href]?.done).length;
  const inProgress = pages.find((page) => {
    const record = records[page.href];
    return record && !record.done && record.progress > 0.08;
  });
  const nextUnread = inProgress ?? pages.find((page) => !records[page.href]?.done);
  const started = Object.keys(records).some((href) => pages.some((page) => page.href === href));

  const label = !started
    ? "Start reading"
    : inProgress
      ? "Continue reading"
      : nextUnread
        ? "Read next"
        : "Read again from the start";
  const target = nextUnread ?? pages[0];

  return (
    <section className="project-progress" aria-label="Your reading progress">
      <div className="project-progress-head">
        <p className="project-progress-count">
          <strong>{read}</strong> of {pages.length} page{pages.length === 1 ? "" : "s"} read
        </p>
        <div className="project-progress-track" aria-hidden>
          <span style={{ width: `${(read / pages.length) * 100}%` }} />
        </div>
      </div>
      <Link href={target.href} className="project-progress-next">
        <span className="project-progress-label">{label}</span>
        <span className="project-progress-title">{target.title}</span>
        {target.description && <span className="project-progress-desc">{target.description}</span>}
        <span aria-hidden className="project-progress-arrow">→</span>
      </Link>
    </section>
  );
}
