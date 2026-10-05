"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  adoptLocalPrefs,
  applyPreset,
  BUILT_IN_PRESETS,
  deletePreset,
  flushPrefs,
  getPrefs,
  getPresets,
  getServerPrefs,
  getServerPresets,
  matchingPreset,
  MAX_PRESETS,
  savePreset,
  setPrefs,
  subscribePrefs,
  type ReadingPrefs,
} from "@/lib/reading/prefs";
import { getServerSkim, getSkim, setSkim, subscribeSkim } from "@/lib/reading/skim";

type EnumKey = "theme" | "face" | "size" | "measure" | "leading";
type Choice<K extends EnumKey> = { value: ReadingPrefs[K]; label: string; hint?: string };

const THEMES: Choice<"theme">[] = [
  { value: "graphite", label: "Graphite", hint: "Dark, neutral" },
  { value: "dusk", label: "Dusk", hint: "Warm and dim, for reading at night" },
  { value: "paper", label: "Paper", hint: "Light" },
  { value: "auto", label: "Auto", hint: "Follow your system: Paper by day, Graphite by night" },
];
const FACES: Choice<"face">[] = [
  { value: "sans", label: "Sans", hint: "Inter" },
  { value: "serif", label: "Serif", hint: "Literata, designed for long reading" },
  { value: "readable", label: "Readable", hint: "Atkinson Hyperlegible, designed for low vision" },
];
const SIZES: Choice<"size">[] = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
  { value: "xl", label: "Extra large" },
];
const MEASURES: Choice<"measure">[] = [
  { value: "narrow", label: "Narrow" },
  { value: "standard", label: "Standard" },
  { value: "wide", label: "Wide" },
];
const LEADINGS: Choice<"leading">[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "airy", label: "Airy" },
];

function Segmented<K extends EnumKey>({
  label,
  name,
  choices,
  value,
  render,
}: {
  label: string;
  name: K;
  choices: Choice<K>[];
  value: ReadingPrefs[K];
  render?: (choice: Choice<K>) => React.ReactNode;
}) {
  return (
    <fieldset className="prefs-group">
      <legend>{label}</legend>
      <div className="prefs-segmented">
        {choices.map((choice) => (
          <button
            key={String(choice.value)}
            type="button"
            aria-pressed={choice.value === value}
            title={choice.hint}
            aria-label={render ? choice.label : undefined}
            onClick={() => setPrefs({ [name]: choice.value } as Partial<ReadingPrefs>)}
          >
            {render ? render(choice) : choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ name, label, hint }: { name: "paragraphFocus" | "ruler" | "autoHideHeader"; label: string; hint: string }) {
  const prefs = usePrefs();
  const on = prefs[name];
  return (
    <button type="button" role="switch" aria-checked={on} className="prefs-toggle" onClick={() => setPrefs({ [name]: !on })}>
      <span className="prefs-toggle-text">
        <span>{label}</span>
        <small>{hint}</small>
      </span>
      <span className="prefs-switch" aria-hidden />
    </button>
  );
}

export function usePrefs() {
  return useSyncExternalStore(subscribePrefs, getPrefs, getServerPrefs);
}

function usePresets() {
  return useSyncExternalStore(subscribePrefs, getPresets, getServerPresets);
}

function Presets() {
  const prefs = usePrefs();
  const custom = usePresets();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const all = [...BUILT_IN_PRESETS, ...custom];
  const active = matchingPreset(prefs, all);

  return (
    <fieldset className="prefs-group">
      <legend>Presets</legend>
      <div className="prefs-presets">
        {all.map((preset) => {
          const own = !preset.id.startsWith("builtin-");
          return (
            <span key={preset.id} className="prefs-preset" data-active={active?.id === preset.id}>
              <button type="button" aria-pressed={active?.id === preset.id} onClick={() => applyPreset(preset)}>
                {preset.name}
              </button>
              {own && (
                <button type="button" className="prefs-preset-remove" aria-label={`Delete preset ${preset.name}`} onClick={() => deletePreset(preset.id)}>
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
      {naming ? (
        <form
          className="prefs-save"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            savePreset(name);
            setName("");
            setNaming(false);
          }}
        >
          <input autoFocus value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Name this preset" aria-label="Preset name" />
          <button type="submit" disabled={!name.trim()}>Save</button>
          <button type="button" onClick={() => setNaming(false)}>Cancel</button>
        </form>
      ) : (
        !active && custom.length < MAX_PRESETS && (
          <button type="button" className="prefs-save-trigger" onClick={() => setNaming(true)}>
            + Save current settings as a preset
          </button>
        )
      )}
    </fieldset>
  );
}

export function ReadingPreferences() {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="prefs-anchor">
      <button
        type="button"
        className="icon-button prefs-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Reading preferences"
        title="Reading preferences"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden className="prefs-glyph">
          <span>A</span>
          <span>a</span>
        </span>
      </button>
      {open && (
        <div className="prefs-panel" role="group" aria-label="Reading preferences">
          <Presets />
          <Segmented label="Theme" name="theme" choices={THEMES} value={prefs.theme} />
          <Segmented
            label="Typeface"
            name="face"
            choices={FACES}
            value={prefs.face}
            render={(choice) => <span className={`prefs-face prefs-face-${choice.value}`}>{choice.label}</span>}
          />
          <Segmented
            label="Text size"
            name="size"
            choices={SIZES}
            value={prefs.size}
            render={(choice) => <span className={`prefs-size prefs-size-${choice.value}`} aria-hidden>A</span>}
          />
          <Segmented label="Line width" name="measure" choices={MEASURES} value={prefs.measure} />
          <Segmented label="Line spacing" name="leading" choices={LEADINGS} value={prefs.leading} />
          <fieldset className="prefs-group">
            <legend>Reading aids</legend>
            <div className="prefs-toggles">
              <Toggle name="paragraphFocus" label="Paragraph focus" hint="Fade everything but what you're reading" />
              <Toggle name="ruler" label="Reading ruler" hint="A band that follows your pointer line by line" />
              <Toggle name="autoHideHeader" label="Hide header while reading" hint="Slides away as you scroll down" />
            </div>
          </fieldset>
          <dl className="prefs-keys">
            <div><dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous / next page</dd></div>
            <div><dt><kbd>F</kbd></dt><dd>Focus mode</dd></div>
            <div><dt><kbd>S</kbd></dt><dd>Skim mode</dd></div>
            <div><dt><kbd>Ctrl</kbd> <kbd>K</kbd></dt><dd>Search</dd></div>
          </dl>
          <p className="prefs-sync">Saved to your account — these follow you to any device.</p>
        </div>
      )}
    </div>
  );
}

/** Mounted once in the root layout: keeps preferences in sync with the account. */
export function ReaderBoot() {
  const prefs = usePrefs();

  useEffect(() => {
    adoptLocalPrefs();
    window.addEventListener("pagehide", flushPrefs);
    return () => window.removeEventListener("pagehide", flushPrefs);
  }, []);

  // "Auto" has to follow the system while the page is open, not just on load.
  useEffect(() => {
    if (prefs.theme !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setPrefs({ theme: "auto" });
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [prefs.theme]);

  return null;
}

const ICON = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const, "aria-hidden": true };

export function FocusToggle() {
  const prefs = usePrefs();
  return (
    <button
      type="button"
      className="toolbar-button focus-toggle"
      aria-pressed={prefs.focus}
      title="Hide the side panels (F)"
      onClick={() => setPrefs({ focus: !prefs.focus })}
    >
      <svg {...ICON}>
        {prefs.focus ? (
          <path d="M6 2.5v3.5H2.5M10 2.5v3.5h3.5M6 13.5V10H2.5M10 13.5V10h3.5" />
        ) : (
          <path d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" />
        )}
      </svg>
      {prefs.focus ? "Exit focus" : "Focus"}
    </button>
  );
}

export function SkimToggle() {
  const skim = useSyncExternalStore(subscribeSkim, getSkim, getServerSkim);
  return (
    <button
      type="button"
      className="toolbar-button"
      aria-pressed={skim}
      title="Show only headings and the opening of each section (S)"
      onClick={() => setSkim(!skim)}
    >
      <svg {...ICON}>
        <path d="M2.5 3.5h11M2.5 8h7M2.5 12.5h9" />
      </svg>
      {skim ? "Read all" : "Skim"}
    </button>
  );
}
