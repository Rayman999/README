// Reader preferences. Shared by the pre-paint script in the root layout and the
// client controls, so the stored shape and the <html> attributes stay in step.

export type ThemeChoice = "graphite" | "paper" | "auto";
export type Face = "sans" | "serif";
export type Size = "s" | "m" | "l" | "xl";
export type Measure = "narrow" | "standard" | "wide";

export type ReadingPrefs = {
  theme: ThemeChoice;
  face: Face;
  size: Size;
  measure: Measure;
  focus: boolean;
};

export const PREFS_KEY = "readme:prefs";

export const DEFAULT_PREFS: ReadingPrefs = {
  theme: "graphite",
  face: "sans",
  size: "m",
  measure: "standard",
  focus: false,
};

export const PREF_OPTIONS = {
  theme: ["graphite", "paper", "auto"],
  face: ["sans", "serif"],
  size: ["s", "m", "l", "xl"],
  measure: ["narrow", "standard", "wide"],
} as const;

/**
 * Runs inline in <head> before first paint. Kept dependency-free and
 * defensive: storage can throw, and stored values may be from an older shape.
 */
export const PREFS_SCRIPT = `(function(){try{
var d=${JSON.stringify(DEFAULT_PREFS)},o=${JSON.stringify(PREF_OPTIONS)},p={};
try{p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}")||{}}catch(e){}
var r=document.documentElement;
for(var k in o){var v=p[k];if(o[k].indexOf(v)<0)v=d[k];
if(k==="theme"&&v==="auto")v=matchMedia("(prefers-color-scheme: light)").matches?"paper":"graphite";
r.setAttribute("data-"+k,v)}
if(p.focus===true)r.classList.add("reading-focus");
}catch(e){}})();`;

function read(): ReadingPrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") ?? {};
    const prefs = { ...DEFAULT_PREFS };
    for (const key of Object.keys(PREF_OPTIONS) as (keyof typeof PREF_OPTIONS)[]) {
      if ((PREF_OPTIONS[key] as readonly string[]).includes(stored[key])) {
        (prefs as Record<string, unknown>)[key] = stored[key];
      }
    }
    prefs.focus = stored.focus === true;
    return prefs;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function resolveTheme(choice: ThemeChoice): "graphite" | "paper" {
  if (choice !== "auto") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "graphite";
}

function apply(prefs: ReadingPrefs) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(prefs.theme);
  root.dataset.face = prefs.face;
  root.dataset.size = prefs.size;
  root.dataset.measure = prefs.measure;
  root.classList.toggle("reading-focus", prefs.focus);
}

// A tiny external store so the header control, the focus toggle and the
// keyboard shortcut all see the same value without a context provider.
let current: ReadingPrefs | null = null;
const listeners = new Set<() => void>();

export function getPrefs(): ReadingPrefs {
  if (!current) current = read();
  return current;
}

export function getServerPrefs(): ReadingPrefs {
  return DEFAULT_PREFS;
}

export function setPrefs(patch: Partial<ReadingPrefs>) {
  current = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(current));
  } catch {
    /* preferences still apply for this visit */
  }
  apply(current);
  listeners.forEach((listener) => listener());
}

export function subscribePrefs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
