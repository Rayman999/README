// What this reader has read, kept in their own browser. Nothing here is sent
// to the server: progress is a private aid, not analytics.

export type PageRecord = {
  /** 0–1, furthest point reached. */
  progress: number;
  /** Last scroll offset, for resuming. */
  y: number;
  done: boolean;
  at: number;
};

const KEY = "readme:reading:v1";
const listeners = new Set<() => void>();
let cache: Record<string, PageRecord> | null = null;

function load(): Record<string, PageRecord> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    cache = {};
  }
  return cache!;
}

export function getRecords(): Record<string, PageRecord> {
  return load();
}

const EMPTY: Record<string, PageRecord> = {};
export function getServerRecords(): Record<string, PageRecord> {
  return EMPTY;
}

export function getRecord(href: string): PageRecord | undefined {
  return load()[href];
}

export function saveRecord(href: string, patch: Partial<PageRecord>) {
  const records = load();
  const previous = records[href] ?? { progress: 0, y: 0, done: false, at: 0 };
  const next: PageRecord = {
    ...previous,
    ...patch,
    progress: Math.max(previous.progress, patch.progress ?? 0),
    done: previous.done || patch.done === true,
    at: Date.now(),
  };
  cache = { ...records, [href]: next };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: progress just isn't remembered */
  }
  if (next.done !== previous.done) listeners.forEach((listener) => listener());
}

export function subscribeRecords(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// --- live position on the current page ------------------------------------

export type LiveProgress = { progress: number; minutes: number };

let live: LiveProgress = { progress: 0, minutes: 0 };
const liveListeners = new Set<() => void>();

export function getLive(): LiveProgress {
  return live;
}

const LIVE_SERVER: LiveProgress = { progress: 0, minutes: 0 };
export function getServerLive(): LiveProgress {
  return LIVE_SERVER;
}

export function setLive(next: LiveProgress) {
  if (next.progress === live.progress && next.minutes === live.minutes) return;
  live = next;
  liveListeners.forEach((listener) => listener());
}

export function subscribeLive(listener: () => void) {
  liveListeners.add(listener);
  return () => liveListeners.delete(listener);
}
