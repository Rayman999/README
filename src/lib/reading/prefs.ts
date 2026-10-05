// Reader preferences. One module shared by the pre-paint script in the root
// layout, the client controls, the API and the database column type, so the
// stored shape and the <html> attributes can never drift apart. Validation
// schemas live in ./prefs-schema (server only) to keep zod out of the browser.

export const PREF_OPTIONS = {
  theme: ["graphite", "dusk", "paper", "auto"],
  face: ["sans", "serif", "readable"],
  size: ["s", "m", "l", "xl"],
  measure: ["narrow", "standard", "wide"],
  leading: ["compact", "normal", "airy"],
} as const;

type Options = typeof PREF_OPTIONS;
export type ReadingPrefs = { [K in keyof Options]: Options[K][number] } & {
  focus: boolean;
  paragraphFocus: boolean;
  ruler: boolean;
  autoHideHeader: boolean;
};
export type ThemeChoice = ReadingPrefs["theme"];
export type ReadingPreset = { id: string; name: string; prefs: ReadingPrefs };
export const MAX_PRESETS = 12;

export const DEFAULT_PREFS: ReadingPrefs = {
  theme: "graphite",
  face: "sans",
  size: "m",
  measure: "standard",
  leading: "normal",
  focus: false,
  paragraphFocus: false,
  ruler: false,
  autoHideHeader: false,
};

/** Starting points that cover the common situations; readers can save their own. */
export const BUILT_IN_PRESETS: ReadingPreset[] = [
  {
    id: "builtin-night",
    name: "Night",
    prefs: { ...DEFAULT_PREFS, theme: "dusk", face: "serif", size: "l", leading: "airy", paragraphFocus: true, autoHideHeader: true },
  },
  {
    id: "builtin-deep-focus",
    name: "Deep focus",
    prefs: { ...DEFAULT_PREFS, face: "serif", size: "l", measure: "narrow", focus: true, paragraphFocus: true, autoHideHeader: true },
  },
  {
    id: "builtin-daylight",
    name: "Daylight",
    prefs: { ...DEFAULT_PREFS, theme: "paper", face: "serif" },
  },
  {
    id: "builtin-easy",
    name: "Easy reading",
    prefs: { ...DEFAULT_PREFS, theme: "paper", face: "readable", size: "l", measure: "narrow", leading: "airy", ruler: true },
  },
];

/** Accepts anything (old local copies, partial objects) and returns valid prefs. */
export function normalizePrefs(value: unknown): ReadingPrefs {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const prefs = { ...DEFAULT_PREFS } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PREFS) as (keyof ReadingPrefs)[]) {
    const value = source[key];
    const options = (PREF_OPTIONS as Record<string, readonly string[]>)[key];
    if (options ? options.includes(value as string) : typeof value === "boolean") prefs[key] = value;
  }
  return prefs as ReadingPrefs;
}

export const PREFS_KEY = "readme:prefs";

declare global {
  interface Window {
    __READER__?: { prefs: ReadingPrefs; presets: ReadingPreset[]; synced: boolean; signedIn: boolean; hadLocal: boolean };
  }
}

/**
 * Runs inline in <head> before first paint. Saved account preferences win;
 * otherwise this browser's last choice; otherwise the defaults. Kept
 * dependency-free and defensive: storage can throw.
 */
export function prefsScript(saved: { prefs: ReadingPrefs; presets: ReadingPreset[] } | null, signedIn: boolean) {
  const payload = JSON.stringify({ saved, signedIn, defaults: DEFAULT_PREFS, options: PREF_OPTIONS, key: PREFS_KEY })
    .replace(/</g, "\\u003c");
  return `(function(){try{
var c=${payload},p=c.saved&&c.saved.prefs,local=null;
try{local=JSON.parse(localStorage.getItem(c.key)||"null")}catch(e){}
if(!p)p=local||{};
var r=document.documentElement,o=c.options,d=c.defaults,out={};
for(var k in d){var v=p[k];out[k]=(o[k]?o[k].indexOf(v)>=0:typeof v==="boolean")?v:d[k]}
for(var k2 in o){var v2=out[k2];if(k2==="theme"&&v2==="auto")v2=matchMedia("(prefers-color-scheme: light)").matches?"paper":"graphite";r.setAttribute("data-"+k2,v2)}
r.classList.toggle("reading-focus",out.focus);r.classList.toggle("paragraph-focus",out.paragraphFocus);
if(out.ruler)r.setAttribute("data-ruler","");
try{if(sessionStorage.getItem("readme:skim")==="1")r.classList.add("skim-mode")}catch(e){}
window.__READER__={prefs:out,presets:(c.saved&&c.saved.presets)||[],synced:!!c.saved,signedIn:c.signedIn,hadLocal:!!local};
if(c.saved)try{localStorage.setItem(c.key,JSON.stringify(out))}catch(e){}
}catch(e){}})();`;
}

export function resolveTheme(choice: ThemeChoice): "graphite" | "dusk" | "paper" {
  if (choice !== "auto") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "graphite";
}

function apply(prefs: ReadingPrefs) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(prefs.theme);
  root.dataset.face = prefs.face;
  root.dataset.size = prefs.size;
  root.dataset.measure = prefs.measure;
  root.dataset.leading = prefs.leading;
  root.classList.toggle("reading-focus", prefs.focus);
  root.classList.toggle("paragraph-focus", prefs.paragraphFocus);
  root.toggleAttribute("data-ruler", prefs.ruler);
  if (!prefs.autoHideHeader) root.classList.remove("header-hidden");
}

// --- client store -----------------------------------------------------------
// A tiny external store so every control sees the same value without a
// context provider. Changes apply instantly, are cached in this browser, and
// are saved to the account shortly after.

let current: ReadingPrefs | null = null;
let presets: ReadingPreset[] | null = null;
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
let pending: { prefs?: ReadingPrefs; presets?: ReadingPreset[] } = {};

export function getPrefs(): ReadingPrefs {
  if (!current) current = normalizePrefs(window.__READER__?.prefs);
  return current;
}
export function getServerPrefs(): ReadingPrefs {
  return DEFAULT_PREFS;
}
export function getPresets(): ReadingPreset[] {
  if (!presets) presets = window.__READER__?.presets ?? [];
  return presets;
}
const NO_PRESETS: ReadingPreset[] = [];
export function getServerPresets(): ReadingPreset[] {
  return NO_PRESETS;
}

export function subscribePrefs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

/** Send whatever is waiting. `keepalive` lets it finish while the page unloads. */
export function flushPrefs() {
  window.clearTimeout(saveTimer);
  if (!pending.prefs && !pending.presets) return;
  const body = JSON.stringify(pending);
  pending = {};
  void fetch("/api/reader/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* offline: this browser keeps the local copy and it syncs next change */
  });
}

function queueSave(patch: typeof pending) {
  if (!window.__READER__?.signedIn) return;
  pending = { ...pending, ...patch };
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushPrefs, 600);
}

export function setPrefs(patch: Partial<ReadingPrefs>) {
  current = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(current));
  } catch {
    /* preferences still apply for this visit */
  }
  apply(current);
  queueSave({ prefs: current });
  emit();
}

export function applyPreset(preset: ReadingPreset) {
  setPrefs(preset.prefs);
}

export function savePreset(name: string): ReadingPreset {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "preset";
  const preset: ReadingPreset = { id: `${slug}-${Date.now().toString(36)}`, name: name.trim().slice(0, 40), prefs: getPrefs() };
  presets = [...getPresets(), preset].slice(-MAX_PRESETS);
  queueSave({ presets });
  emit();
  return preset;
}

export function deletePreset(id: string) {
  presets = getPresets().filter((preset) => preset.id !== id);
  queueSave({ presets });
  emit();
}

/**
 * First visit after signing in on a browser that already had settings: carry
 * them into the account instead of resetting them to defaults.
 */
export function adoptLocalPrefs() {
  const boot = window.__READER__;
  if (!boot?.signedIn || boot.synced || !boot.hadLocal) return;
  boot.synced = true;
  queueSave({ prefs: getPrefs() });
}

/** Which preset (if any) exactly matches the current settings. */
export function matchingPreset(prefs: ReadingPrefs, list: ReadingPreset[]) {
  return list.find((preset) =>
    (Object.keys(DEFAULT_PREFS) as (keyof ReadingPrefs)[]).every((key) => preset.prefs[key] === prefs[key]),
  );
}
