// Reader preferences. One module shared by the pre-paint script in the root
// layout, the client controls, the settings page, the API and the database
// column type, so the stored shape and the <html> attributes never drift.
// Validation schemas live in ./prefs-schema (server only) to keep zod out of
// the browser.

export const CONCRETE_THEMES = ["graphite", "dusk", "paper", "sepia", "ink", "mist", "slate"] as const;
export type ConcreteTheme = (typeof CONCRETE_THEMES)[number];

/** Choices that become `data-*` attributes on <html> (theme is resolved first). */
export const PREF_OPTIONS = {
  theme: [...CONCRETE_THEMES, "auto", "schedule"],
  face: ["sans", "serif", "readable", "humanist", "editorial", "mono"],
  size: ["s", "m", "l", "xl"],
  measure: ["narrow", "standard", "wide"],
  leading: ["tight", "compact", "normal", "relaxed", "airy", "spacious"],
  contrast: ["softest", "soft", "normal", "crisp", "crispest"],
  align: ["left", "justify"],
  paragraph: ["spaced", "indented"],
  focusMode: ["off", "paragraph", "sentence"],
  codeSize: ["s", "m", "l"],
} as const;

/** Other enums that aren't attributes. */
export const OTHER_OPTIONS = {
  dayTheme: CONCRETE_THEMES,
  nightTheme: CONCRETE_THEMES,
} as const;

export const BOOLEAN_PREFS = ["focus", "autoHideHeader", "bionic", "codeWrap", "reduceMotion", "glossary", "showStreak"] as const;

export const NUMBER_PREFS = {
  wpm: { min: 100, max: 600, step: 10 },
  scrollSpeed: { min: 10, max: 160, step: 5 },
  voiceRate: { min: 0.5, max: 2, step: 0.1 },
} as const;

export const STRING_PREFS = ["voice", "dayStart", "nightStart"] as const;

type Attr = typeof PREF_OPTIONS;
type Other = typeof OTHER_OPTIONS;
export type ReadingPrefs =
  { [K in keyof Attr]: Attr[K][number] } &
  { [K in keyof Other]: Other[K][number] } &
  { [K in (typeof BOOLEAN_PREFS)[number]]: boolean } &
  { [K in keyof typeof NUMBER_PREFS]: number } &
  { [K in (typeof STRING_PREFS)[number]]: string };

export type ThemeChoice = ReadingPrefs["theme"];
export type ReadingPreset = { id: string; name: string; prefs: Partial<ReadingPrefs> };
export type ProjectPresets = Record<string, string>;
export const MAX_PRESETS = 12;

export const DEFAULT_PREFS: ReadingPrefs = {
  theme: "graphite",
  face: "sans",
  size: "m",
  measure: "standard",
  leading: "normal",
  contrast: "normal",
  align: "left",
  paragraph: "spaced",
  focusMode: "off",
  codeSize: "m",
  dayTheme: "paper",
  nightTheme: "dusk",
  focus: false,
  autoHideHeader: false,
  bionic: false,
  codeWrap: false,
  reduceMotion: false,
  glossary: true,
  showStreak: true,
  wpm: 230,
  scrollSpeed: 40,
  voiceRate: 1,
  voice: "",
  dayStart: "07:00",
  nightStart: "19:00",
};

/**
 * What a preset controls: how the page looks. Personal things like reading
 * speed or the read-aloud voice are never overwritten by applying one.
 */
export const LOOK_KEYS = ["theme", "face", "size", "measure", "leading", "contrast", "align", "paragraph", "focusMode", "focus", "autoHideHeader", "bionic"] as const;

/** Starting points that cover the common situations; readers can save their own. */
export const BUILT_IN_PRESETS: ReadingPreset[] = [
  { id: "builtin-night", name: "Night", prefs: { theme: "dusk", face: "serif", size: "l", measure: "standard", leading: "airy", contrast: "soft", align: "left", paragraph: "spaced", focusMode: "paragraph", focus: false, autoHideHeader: true, bionic: false } },
  { id: "builtin-deep-focus", name: "Deep focus", prefs: { theme: "graphite", face: "serif", size: "l", measure: "narrow", leading: "relaxed", contrast: "normal", align: "left", paragraph: "spaced", focusMode: "sentence", focus: true, autoHideHeader: true, bionic: false } },
  { id: "builtin-daylight", name: "Daylight", prefs: { theme: "paper", face: "serif", size: "m", measure: "standard", leading: "normal", contrast: "normal", align: "left", paragraph: "spaced", focusMode: "off", focus: false, autoHideHeader: false, bionic: false } },
  { id: "builtin-book", name: "Book", prefs: { theme: "sepia", face: "editorial", size: "l", measure: "narrow", leading: "relaxed", contrast: "normal", align: "justify", paragraph: "indented", focusMode: "off", focus: false, autoHideHeader: true, bionic: false } },
  { id: "builtin-easy", name: "Easy reading", prefs: { theme: "paper", face: "readable", size: "l", measure: "narrow", leading: "airy", contrast: "crisp", align: "left", paragraph: "spaced", focusMode: "off", focus: false, autoHideHeader: false, bionic: true } },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validField(key: string, value: unknown): boolean {
  const attr = (PREF_OPTIONS as Record<string, readonly string[]>)[key] ?? (OTHER_OPTIONS as Record<string, readonly string[]>)[key];
  if (attr) return attr.includes(value as string);
  if ((BOOLEAN_PREFS as readonly string[]).includes(key)) return typeof value === "boolean";
  const range = (NUMBER_PREFS as Record<string, { min: number; max: number }>)[key];
  if (range) return typeof value === "number" && value >= range.min && value <= range.max;
  if (key === "voice") return typeof value === "string" && value.length <= 200;
  if (key === "dayStart" || key === "nightStart") return typeof value === "string" && TIME.test(value);
  return false;
}

/** Accepts anything (old copies, partial objects) and returns valid prefs. */
export function normalizePrefs(value: unknown): ReadingPrefs {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const prefs = { ...DEFAULT_PREFS } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PREFS)) if (validField(key, source[key])) prefs[key] = source[key];
  // Older profiles stored paragraph focus as a boolean.
  if (source.paragraphFocus === true && !validField("focusMode", source.focusMode)) prefs.focusMode = "paragraph";
  return prefs as ReadingPrefs;
}

/** Only the keys a preset controls, validated. */
export function lookOf(prefs: Partial<ReadingPrefs>): Partial<ReadingPrefs> {
  const out: Record<string, unknown> = {};
  for (const key of LOOK_KEYS) if (validField(key, prefs[key])) out[key] = prefs[key];
  return out as Partial<ReadingPrefs>;
}

export function projectFromPath(path: string) {
  return /^\/p\/([a-z0-9-]+)/.exec(path)?.[1] ?? null;
}

/** "07:00" ≤ now < "19:00" → day. Handles schedules that wrap midnight. */
export function scheduledTheme(prefs: Pick<ReadingPrefs, "dayTheme" | "nightTheme" | "dayStart" | "nightStart">, now = new Date()): ConcreteTheme {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const t = now.getHours() * 60 + now.getMinutes();
  const day = minutes(prefs.dayStart);
  const night = minutes(prefs.nightStart);
  const isDay = day < night ? t >= day && t < night : t >= day || t < night;
  return isDay ? prefs.dayTheme : prefs.nightTheme;
}

export const PREFS_KEY = "readme:prefs";

declare global {
  interface Window {
    __READER__?: {
      prefs: ReadingPrefs;
      presets: ReadingPreset[];
      projectPresets: ProjectPresets;
      synced: boolean;
      signedIn: boolean;
      hadLocal: boolean;
    };
  }
}

type Saved = { prefs: Partial<ReadingPrefs>; presets: ReadingPreset[]; projectPresets: ProjectPresets } | null;

/**
 * Runs inline in <head> before first paint, so the right theme, typeface and
 * project preset are in place before anything is drawn. Saved account
 * preferences win; otherwise this browser's last choice; otherwise defaults.
 * Dependency-free and defensive: storage can throw.
 */
export function prefsScript(saved: Saved, signedIn: boolean) {
  const payload = JSON.stringify({
    saved, signedIn, key: PREFS_KEY,
    defaults: DEFAULT_PREFS, attrs: PREF_OPTIONS, other: OTHER_OPTIONS,
    bools: BOOLEAN_PREFS, look: LOOK_KEYS, builtins: BUILT_IN_PRESETS,
  }).replace(/</g, "\\u003c");
  return `(function(){try{
var c=${payload},s=c.saved,p=s&&s.prefs,local=null,r=document.documentElement;
try{local=JSON.parse(localStorage.getItem(c.key)||"null")}catch(e){}
if(!p)p=local||{};
var d=c.defaults,out={},k;
function ok(k,v){var o=c.attrs[k]||c.other[k];if(o)return o.indexOf(v)>=0;if(c.bools.indexOf(k)>=0)return typeof v==="boolean";if(typeof d[k]==="number")return typeof v==="number";return typeof v==="string"}
for(k in d)out[k]=ok(k,p[k])?p[k]:d[k];
if(p.paragraphFocus===true&&!ok("focusMode",p.focusMode))out.focusMode="paragraph";
var eff={};for(k in out)eff[k]=out[k];
var pp=(s&&s.projectPresets)||{},m=/^\\/p\\/([a-z0-9-]+)/.exec(location.pathname),pid=m&&pp[m[1]];
if(pid){var list=c.builtins.concat((s&&s.presets)||[]);for(var i=0;i<list.length;i++)if(list[i].id===pid){for(var j=0;j<c.look.length;j++){var lk=c.look[j];if(ok(lk,list[i].prefs[lk]))eff[lk]=list[i].prefs[lk]}}}
var th=eff.theme;
if(th==="auto")th=matchMedia("(prefers-color-scheme: light)").matches?"paper":"graphite";
if(th==="schedule"){var n=new Date(),t=n.getHours()*60+n.getMinutes(),mn=function(x){return +x.slice(0,2)*60+ +x.slice(3,5)},a=mn(eff.dayStart),b=mn(eff.nightStart);th=(a<b?(t>=a&&t<b):(t>=a||t<b))?eff.dayTheme:eff.nightTheme}
for(k in c.attrs)r.setAttribute("data-"+k.toLowerCase(),k==="theme"?th:eff[k]);
r.classList.toggle("reading-focus",!!eff.focus);r.classList.toggle("paragraph-focus",eff.focusMode==="paragraph");r.classList.toggle("sentence-focus",eff.focusMode==="sentence");
r.classList.toggle("reduce-motion",!!out.reduceMotion);r.classList.toggle("bionic",!!eff.bionic);r.classList.toggle("code-wrap",!!out.codeWrap);
try{if(sessionStorage.getItem("readme:skim")==="1")r.classList.add("skim-mode")}catch(e){}
window.__READER__={prefs:out,presets:(s&&s.presets)||[],projectPresets:pp,synced:!!s,signedIn:c.signedIn,hadLocal:!!local};
if(s)try{localStorage.setItem(c.key,JSON.stringify(out))}catch(e){}
}catch(e){}})();`;
}

// --- client store -----------------------------------------------------------
// A tiny external store so every control sees the same value without a
// context provider. Changes apply instantly, are cached in this browser, and
// are saved to the account shortly after.

let current: ReadingPrefs | null = null;
let presets: ReadingPreset[] | null = null;
let projectPresets: ProjectPresets | null = null;
let snapshot: { prefs: ReadingPrefs; presets: ReadingPreset[]; projectPresets: ProjectPresets } | null = null;
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
let pending: { prefs?: ReadingPrefs; presets?: ReadingPreset[]; projectPresets?: ProjectPresets } = {};

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
export function getProjectPresets(): ProjectPresets {
  if (!projectPresets) projectPresets = window.__READER__?.projectPresets ?? {};
  return projectPresets;
}
const NO_PROJECT_PRESETS: ProjectPresets = {};
export function getServerProjectPresets(): ProjectPresets {
  return NO_PROJECT_PRESETS;
}

export function allPresets() {
  return [...BUILT_IN_PRESETS, ...getPresets()];
}

/** The preset in force on the current page because of its project, if any. */
export function activeProjectPreset(path = typeof window === "undefined" ? "" : window.location.pathname) {
  const slug = projectFromPath(path);
  const id = slug ? getProjectPresets()[slug] : undefined;
  const preset = id ? allPresets().find((entry) => entry.id === id) : undefined;
  return preset && slug ? { slug, preset } : null;
}

/** Global prefs with the current project's preset (if any) laid over the look. */
export function effectivePrefs(path?: string): ReadingPrefs {
  const active = activeProjectPreset(path);
  return active ? { ...getPrefs(), ...lookOf(active.preset.prefs) } : getPrefs();
}

export function resolveTheme(prefs: ReadingPrefs): ConcreteTheme {
  if (prefs.theme === "auto") return window.matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "graphite";
  if (prefs.theme === "schedule") return scheduledTheme(prefs);
  return prefs.theme;
}

/** Re-apply everything to <html>. Safe to call any time (navigation, timers). */
export function applyPrefs() {
  const prefs = effectivePrefs();
  const root = document.documentElement;
  for (const key of Object.keys(PREF_OPTIONS) as (keyof typeof PREF_OPTIONS)[]) {
    root.setAttribute(`data-${key.toLowerCase()}`, key === "theme" ? resolveTheme(prefs) : String(prefs[key]));
  }
  root.classList.toggle("reading-focus", prefs.focus);
  root.classList.toggle("paragraph-focus", prefs.focusMode === "paragraph");
  root.classList.toggle("sentence-focus", prefs.focusMode === "sentence");
  root.classList.toggle("reduce-motion", prefs.reduceMotion);
  root.classList.toggle("code-wrap", prefs.codeWrap);
  root.classList.toggle("bionic", prefs.bionic);
  if (!prefs.autoHideHeader) root.classList.remove("header-hidden");
}

export function subscribePrefs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** One object for components that need prefs and presets together. */
export function getSnapshot() {
  const prefs = getPrefs();
  const list = getPresets();
  const map = getProjectPresets();
  if (!snapshot || snapshot.prefs !== prefs || snapshot.presets !== list || snapshot.projectPresets !== map) {
    snapshot = { prefs, presets: list, projectPresets: map };
  }
  return snapshot;
}
const SERVER_SNAPSHOT = { prefs: DEFAULT_PREFS, presets: NO_PRESETS, projectPresets: NO_PROJECT_PRESETS };
export function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function emit() {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new Event("reader:prefs"));
}

/** Send whatever is waiting. `keepalive` lets it finish while the page unloads. */
export function flushPrefs() {
  window.clearTimeout(saveTimer);
  if (!pending.prefs && !pending.presets && !pending.projectPresets) return;
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
  applyPrefs();
  queueSave({ prefs: current });
  emit();
}

export function applyPreset(preset: ReadingPreset) {
  setPrefs(lookOf(preset.prefs));
}

export function savePreset(name: string): ReadingPreset {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "preset";
  const preset: ReadingPreset = { id: `${slug}-${Date.now().toString(36)}`, name: name.trim().slice(0, 40), prefs: lookOf(getPrefs()) };
  presets = [...getPresets(), preset].slice(-MAX_PRESETS);
  queueSave({ presets });
  emit();
  return preset;
}

export function deletePreset(id: string) {
  presets = getPresets().filter((preset) => preset.id !== id);
  // A project can't keep pointing at a preset that's gone.
  const map = Object.fromEntries(Object.entries(getProjectPresets()).filter(([, value]) => value !== id));
  if (Object.keys(map).length !== Object.keys(getProjectPresets()).length) {
    projectPresets = map;
    queueSave({ presets, projectPresets: map });
  } else {
    queueSave({ presets });
  }
  applyPrefs();
  emit();
}

export function setProjectPreset(project: string, presetId: string | null) {
  const next = { ...getProjectPresets() };
  if (presetId) next[project] = presetId;
  else delete next[project];
  projectPresets = next;
  queueSave({ projectPresets: next });
  applyPrefs();
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

/** Which preset (if any) matches the current look. */
export function matchingPreset(prefs: ReadingPrefs, list: ReadingPreset[]) {
  return list.find((preset) => {
    const look = lookOf(preset.prefs);
    return LOOK_KEYS.every((key) => !(key in look) || look[key] === prefs[key]);
  });
}

/** True when motion should be avoided: the system setting or the reader's own. */
export function reducedMotion() {
  return typeof window !== "undefined" && (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("reduce-motion")
  );
}
