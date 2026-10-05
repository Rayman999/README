// Live position on the page being read, shared between the reader runtime
// and the contents rail. Client-only; the server snapshot is always empty.

export type LiveProgress = { progress: number; minutes: number };

let live: LiveProgress = { progress: 0, minutes: 0 };
const listeners = new Set<() => void>();

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
  listeners.forEach((listener) => listener());
}

export function subscribeLive(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
