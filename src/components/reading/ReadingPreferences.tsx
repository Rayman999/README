"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getPrefs,
  getServerPrefs,
  setPrefs,
  subscribePrefs,
  type ReadingPrefs,
} from "@/lib/reading/prefs";

type Choice<K extends keyof ReadingPrefs> = { value: ReadingPrefs[K]; label: string; hint?: string };

const THEMES: Choice<"theme">[] = [
  { value: "graphite", label: "Graphite", hint: "Dark" },
  { value: "paper", label: "Paper", hint: "Light" },
  { value: "auto", label: "Auto", hint: "Match system" },
];
const FACES: Choice<"face">[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
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

function Segmented<K extends keyof ReadingPrefs>({
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
      <div className="prefs-segmented" data-count={choices.length}>
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

export function usePrefs() {
  return useSyncExternalStore(subscribePrefs, getPrefs, getServerPrefs);
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

  // "Auto" has to follow the system while the page is open, not just on load.
  useEffect(() => {
    if (prefs.theme !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setPrefs({ theme: "auto" });
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [prefs.theme]);

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
          <Segmented label="Theme" name="theme" choices={THEMES} value={prefs.theme} />
          <Segmented
            label="Typeface"
            name="face"
            choices={FACES}
            value={prefs.face}
            render={(choice) => (
              <span className={choice.value === "serif" ? "prefs-face-serif" : "prefs-face-sans"}>
                {choice.label}
              </span>
            )}
          />
          <Segmented
            label="Text size"
            name="size"
            choices={SIZES}
            value={prefs.size}
            render={(choice) => (
              <span className={`prefs-size prefs-size-${choice.value}`} aria-hidden>
                A
              </span>
            )}
          />
          <Segmented label="Line width" name="measure" choices={MEASURES} value={prefs.measure} />
          <dl className="prefs-keys">
            <div><dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous / next page</dd></div>
            <div><dt><kbd>F</kbd></dt><dd>Focus mode</dd></div>
            <div><dt><kbd>Ctrl</kbd> <kbd>K</kbd></dt><dd>Search</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}

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
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
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
