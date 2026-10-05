"use client";

import { useReadingRecords } from "./ReadingRecords";

const CHECK = "M3.5 8.5l3 3 6-7";

/** A check beside a finished page, a small ring beside a started one. */
export function ReadMark({ pageId, fallback }: { pageId: string; fallback?: React.ReactNode }) {
  const { records } = useReadingRecords();
  const record = records[pageId];
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

export type ReadablePage = { id: string; href: string; title: string; description?: string };

/** The single most useful next step through a list of pages, in order. */
export function useNextRead(pages: ReadablePage[]) {
  const { records } = useReadingRecords();
  const read = pages.filter((page) => records[page.id]?.done).length;
  const inProgress = pages.find((page) => {
    const record = records[page.id];
    return record && !record.done && record.progress > 0.08;
  });
  const nextUnread = inProgress ?? pages.find((page) => !records[page.id]?.done);
  const started = pages.some((page) => records[page.id]);
  const label = !started
    ? "Start here"
    : inProgress
      ? "Continue reading"
      : nextUnread
        ? "Read next"
        : "Read again from the start";
  return { read, total: pages.length, target: nextUnread ?? pages[0], label, inProgress: Boolean(inProgress) };
}
