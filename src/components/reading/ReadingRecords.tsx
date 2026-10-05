"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PageRecord = { progress: number; y: number; done: boolean; at: number };
type Records = Record<string, PageRecord>;

const RecordsContext = createContext<{
  records: Records;
  update: (pageId: string, patch: Partial<PageRecord>) => void;
}>({ records: {}, update: () => {} });

// Writes are batched per page and sent at most every couple of seconds; the
// last one is sent with keepalive when the page is left.
const pending = new Map<string, Omit<PageRecord, "at">>();
let timer: number | undefined;

function send(pageId: string, record: Omit<PageRecord, "at">) {
  void fetch(`/api/reader/progress/${encodeURIComponent(pageId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ progress: Math.min(1, Math.max(0, record.progress)), y: Math.max(0, Math.round(record.y)), done: record.done }),
    keepalive: true,
  }).catch(() => {
    /* offline: the next save carries the latest position anyway */
  });
}

export function flushProgress() {
  window.clearTimeout(timer);
  timer = undefined;
  pending.forEach((record, pageId) => send(pageId, record));
  pending.clear();
}

function queue(pageId: string, record: Omit<PageRecord, "at">) {
  pending.set(pageId, record);
  if (!timer) timer = window.setTimeout(flushProgress, 2500);
}

export function ReadingRecordsProvider({ initial, children }: { initial: Records; children: ReactNode }) {
  const [records, setRecords] = useState(initial);

  // A fresh server render (navigation, refresh) may know about reading done
  // on another device; merge rather than replace so local progress survives.
  useEffect(() => {
    setRecords((current) => {
      const merged = { ...current };
      for (const [pageId, incoming] of Object.entries(initial)) {
        const mine = merged[pageId];
        merged[pageId] = !mine
          ? incoming
          : {
              progress: Math.max(mine.progress, incoming.progress),
              done: mine.done || incoming.done,
              y: mine.at >= incoming.at ? mine.y : incoming.y,
              at: Math.max(mine.at, incoming.at),
            };
      }
      return merged;
    });
  }, [initial]);

  useEffect(() => {
    window.addEventListener("pagehide", flushProgress);
    return () => window.removeEventListener("pagehide", flushProgress);
  }, []);

  const update = useCallback((pageId: string, patch: Partial<PageRecord>) => {
    setRecords((current) => {
      const previous = current[pageId] ?? { progress: 0, y: 0, done: false, at: 0 };
      const next: PageRecord = {
        progress: Math.max(previous.progress, patch.progress ?? 0),
        y: patch.y ?? previous.y,
        done: previous.done || patch.done === true,
        at: Date.now(),
      };
      queue(pageId, next);
      // Scroll fires constantly; only re-render the read marks when something
      // a reader could see has changed.
      const visible = next.done !== previous.done || next.progress - previous.progress >= 0.02;
      return visible ? { ...current, [pageId]: next } : current;
    });
  }, []);

  const value = useMemo(() => ({ records, update }), [records, update]);
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useReadingRecords() {
  return useContext(RecordsContext);
}
