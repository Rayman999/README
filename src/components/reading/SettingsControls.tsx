"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  activeProjectPreset,
  allPresets,
  applyPreset,
  BUILT_IN_PRESETS,
  deletePreset,
  getServerSnapshot,
  getSnapshot,
  matchingPreset,
  MAX_PRESETS,
  savePreset,
  setPrefs,
  setProjectPreset,
  subscribePrefs,
  type ConcreteTheme,
  type ReadingPrefs,
} from "@/lib/reading/prefs";

/** Prefs, presets and project presets together, kept in sync. */
export function useReader() {
  return useSyncExternalStore(subscribePrefs, getSnapshot, getServerSnapshot);
}

export function usePrefs() {
  return useReader().prefs;
}

type Choice<V extends string> = { value: V; label: string; hint?: string };

export const THEMES: (Choice<ConcreteTheme> & { swatch: [string, string, string] })[] = [
  { value: "graphite", label: "Graphite", hint: "Dark, neutral — the default", swatch: ["#0A0A0B", "#171719", "#E3E3E5"] },
  { value: "dusk", label: "Dusk", hint: "Warm and dim, low blue light for night", swatch: ["#12100E", "#1C1916", "#E0D6C5"] },
  { value: "ink", label: "Ink", hint: "True black for OLED screens, brightest text", swatch: ["#000000", "#0D0D0D", "#F0F0F0"] },
  { value: "slate", label: "Slate", hint: "Cool blue-grey dark", swatch: ["#121820", "#1C242F", "#DDE3EB"] },
  { value: "paper", label: "Paper", hint: "Clean light", swatch: ["#F2F2EF", "#FDFDFB", "#1F2022"] },
  { value: "sepia", label: "Sepia", hint: "Warm, low-glare page, like an old book", swatch: ["#EFE6D6", "#FAF4E8", "#33271C"] },
  { value: "mist", label: "Mist", hint: "Soft light grey, gentler than Paper", swatch: ["#E6E7E9", "#F3F4F5", "#2B2E33"] },
];

export const FACES: Choice<ReadingPrefs["face"]>[] = [
  { value: "sans", label: "Sans", hint: "Inter — clean and neutral" },
  { value: "serif", label: "Serif", hint: "Literata — designed for long reading on screens" },
  { value: "editorial", label: "Editorial", hint: "Newsreader — a magazine-style serif" },
  { value: "humanist", label: "Humanist", hint: "Source Sans — warm, open sans" },
  { value: "readable", label: "Readable", hint: "Atkinson Hyperlegible — designed for low vision" },
  { value: "mono", label: "Typewriter", hint: "IBM Plex Mono — every letter the same width" },
];

export const SIZES: Choice<ReadingPrefs["size"]>[] = [
  { value: "s", label: "Small", hint: "15.5 px" },
  { value: "m", label: "Medium", hint: "17 px" },
  { value: "l", label: "Large", hint: "18.5 px" },
  { value: "xl", label: "Extra large", hint: "20 px" },
];

export const WIDTHS: Choice<ReadingPrefs["measure"]>[] = [
  { value: "narrow", label: "Narrow", hint: "560 px page" },
  { value: "standard", label: "Standard", hint: "640 px page" },
  { value: "wide", label: "Wide", hint: "780 px page" },
];

export const SPACINGS: (Choice<ReadingPrefs["leading"]> & { value2: number })[] = [
  { value: "tight", label: "Tight", value2: 1.4 },
  { value: "compact", label: "Compact", value2: 1.55 },
  { value: "normal", label: "Normal", value2: 1.72 },
  { value: "relaxed", label: "Relaxed", value2: 1.84 },
  { value: "airy", label: "Airy", value2: 1.95 },
  { value: "spacious", label: "Spacious", value2: 2.15 },
];

export const CONTRASTS: Choice<ReadingPrefs["contrast"]>[] = [
  { value: "softest", label: "Softest" },
  { value: "soft", label: "Soft" },
  { value: "normal", label: "Normal" },
  { value: "crisp", label: "Crisp" },
  { value: "crispest", label: "Crispest" },
];

const FACE_VAR: Record<ReadingPrefs["face"], string> = {
  sans: "var(--font-sans)", serif: "var(--font-serif)", editorial: "var(--font-editorial)",
  humanist: "var(--font-humanist)", readable: "var(--font-readable)", mono: "var(--font-writer)",
};

export function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="prefs-group">
      <legend>{label}</legend>
      {hint && <p className="prefs-hint">{hint}</p>}
      {children}
    </fieldset>
  );
}

export function Segmented<K extends keyof ReadingPrefs>({ name, choices, render, columns }: {
  name: K;
  choices: Choice<string>[];
  render?: (choice: Choice<string>) => React.ReactNode;
  columns?: number;
}) {
  const prefs = usePrefs();
  return (
    <div className="prefs-segmented" style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoFlow: "row" } : undefined}>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={prefs[name] === choice.value}
          title={choice.hint}
          aria-label={render ? choice.label : undefined}
          onClick={() => setPrefs({ [name]: choice.value } as Partial<ReadingPrefs>)}
        >
          {render ? render(choice) : choice.label}
        </button>
      ))}
    </div>
  );
}

export function ThemePicker({ withModes = true }: { withModes?: boolean }) {
  const prefs = usePrefs();
  const mode = (value: "auto" | "schedule", label: string, hint: string) => (
    <button type="button" className="theme-mode" aria-pressed={prefs.theme === value} title={hint} onClick={() => setPrefs({ theme: value })}>
      {label}
    </button>
  );
  return (
    <div className="theme-picker">
      <div className="theme-swatches">
        {THEMES.map((theme) => (
          <button key={theme.value} type="button" className="theme-swatch" aria-pressed={prefs.theme === theme.value} title={theme.hint} onClick={() => setPrefs({ theme: theme.value })}>
            <span className="theme-chip" style={{ background: theme.swatch[0] }} aria-hidden>
              <span style={{ background: theme.swatch[1] }}><i style={{ background: theme.swatch[2] }} /><i style={{ background: theme.swatch[2] }} /></span>
            </span>
            <span className="theme-name">{theme.label}</span>
          </button>
        ))}
      </div>
      {withModes && (
        <div className="theme-modes">
          {mode("auto", "Auto", "Follow your system: Paper by day, Graphite by night")}
          {mode("schedule", "Schedule", "Switch between two themes at times you choose")}
        </div>
      )}
    </div>
  );
}

export function FacePicker() {
  return (
    <Segmented
      name="face"
      choices={FACES}
      columns={3}
      render={(choice) => (
        <span className="face-option">
          <span className="face-sample" style={{ fontFamily: FACE_VAR[choice.value as ReadingPrefs["face"]] }}>Ag</span>
          <span>{choice.label}</span>
        </span>
      )}
    />
  );
}

export function SizePicker() {
  return <Segmented name="size" choices={SIZES} render={(choice) => <span className={`prefs-size prefs-size-${choice.value}`} aria-hidden>A</span>} />;
}

export function WidthPicker() {
  return <Segmented name="measure" choices={WIDTHS} />;
}

export function SpacingPicker() {
  return (
    <Segmented
      name="leading"
      choices={SPACINGS}
      columns={3}
      render={(choice) => (
        <span className="spacing-option">
          <span className="spacing-lines" style={{ gap: `${((SPACINGS.find((s) => s.value === choice.value)?.value2 ?? 1.7) - 1) * 6}px` }} aria-hidden><i /><i /><i /></span>
          {choice.label}
        </span>
      )}
    />
  );
}

/** Presets row, the "save current look" form and the per-project notice. */
export function PresetPicker() {
  const { prefs, presets, projectPresets } = useReader();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const all = [...BUILT_IN_PRESETS, ...presets];
  const active = matchingPreset(prefs, all);
  // Depends on the URL, so it's worked out after hydration.
  const [project, setProject] = useState<ReturnType<typeof activeProjectPreset>>(null);
  useEffect(() => setProject(activeProjectPreset()), [projectPresets, presets]);

  return (
    <>
      {project && (
        <p className="prefs-notice">
          This project uses <strong>{project.preset.name}</strong>, so changes here won&rsquo;t show on its pages.{" "}
          <button type="button" onClick={() => setProjectPreset(project.slug, null)}>Stop using it here</button>
        </p>
      )}
      <div className="prefs-presets">
        {all.map((preset) => {
          const own = !preset.id.startsWith("builtin-");
          return (
            <span key={preset.id} className="prefs-preset" data-active={active?.id === preset.id}>
              <button type="button" aria-pressed={active?.id === preset.id} onClick={() => applyPreset(preset)}>{preset.name}</button>
              {own && <button type="button" className="prefs-preset-remove" aria-label={`Delete preset ${preset.name}`} onClick={() => deletePreset(preset.id)}>×</button>}
            </span>
          );
        })}
      </div>
      {naming ? (
        <form className="prefs-save" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; savePreset(name); setName(""); setNaming(false); }}>
          <input autoFocus value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Name this look" aria-label="Preset name" />
          <button type="submit" disabled={!name.trim()}>Save</button>
          <button type="button" onClick={() => setNaming(false)}>Cancel</button>
        </form>
      ) : (
        !active && presets.length < MAX_PRESETS && (
          <button type="button" className="prefs-save-trigger" onClick={() => setNaming(true)}>+ Save this look as a preset</button>
        )
      )}
    </>
  );
}

export function Toggle({ name, label, hint }: { name: "focus" | "autoHideHeader" | "bionic" | "codeWrap" | "reduceMotion" | "glossary" | "showStreak"; label: string; hint: string }) {
  const prefs = usePrefs();
  const on = prefs[name];
  return (
    <button type="button" role="switch" aria-checked={on} className="prefs-toggle" onClick={() => setPrefs({ [name]: !on })}>
      <span className="prefs-toggle-text"><span>{label}</span><small>{hint}</small></span>
      <span className="prefs-switch" aria-hidden />
    </button>
  );
}

export { allPresets };
