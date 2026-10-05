// Skim mode: headings plus the opening of each section. Kept for this browser
// session only — a page that silently hides paragraphs on a later visit
// would be confusing, so it never becomes a saved preference.

const KEY = "readme:skim";
const listeners = new Set<() => void>();

export function getSkim(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function getServerSkim(): boolean {
  return false;
}

export function setSkim(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    /* still applies for this page */
  }
  document.documentElement.classList.toggle("skim-mode", on);
  listeners.forEach((listener) => listener());
}

export function subscribeSkim(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
