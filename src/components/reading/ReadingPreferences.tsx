"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/shell/NavigationLink";
import { adoptLocalPrefs, applyPrefs, flushPrefs, getPrefs, setPrefs } from "@/lib/reading/prefs";
import { getServerSkim, getSkim, setSkim, subscribeSkim } from "@/lib/reading/skim";
import { FacePicker, Group, PresetPicker, SizePicker, SpacingPicker, ThemePicker, usePrefs, WidthPicker } from "./SettingsControls";

export { usePrefs };

/** The quick menu behind "Aa": the look, at a glance. Everything else lives on /settings. */
export function ReadingPreferences() {
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
        <span aria-hidden className="prefs-glyph"><span>A</span><span>a</span></span>
      </button>
      {open && (
        <div className="prefs-panel" role="group" aria-label="Reading preferences">
          <Group label="Presets"><PresetPicker /></Group>
          <Group label="Theme"><ThemePicker /></Group>
          <Group label="Typeface"><FacePicker /></Group>
          <Group label="Text size"><SizePicker /></Group>
          <Group label="Page width"><WidthPicker /></Group>
          <Group label="Line spacing"><SpacingPicker /></Group>
          <Link href="/settings" className="prefs-more" onClick={() => setOpen(false)}>
            <span>All reading settings</span>
            <small>Focus aids, read aloud, reading speed, schedule, stats…</small>
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}

/** Mounted once in the root layout: keeps preferences applied and synced. */
export function ReaderBoot() {
  const prefs = usePrefs();
  const pathname = usePathname();

  useEffect(() => {
    adoptLocalPrefs();
    window.addEventListener("pagehide", flushPrefs);
    return () => window.removeEventListener("pagehide", flushPrefs);
  }, []);

  // A project's own preset applies on its pages and stops when you leave.
  useEffect(() => {
    applyPrefs();
  }, [pathname]);

  // "Auto" follows the system; "Schedule" follows the clock.
  useEffect(() => {
    if (prefs.theme === "auto") {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener("change", applyPrefs);
      return () => media.removeEventListener("change", applyPrefs);
    }
    if (prefs.theme === "schedule") {
      const timer = window.setInterval(applyPrefs, 60_000);
      return () => window.clearInterval(timer);
    }
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
      onClick={() => setPrefs({ focus: !getPrefs().focus })}
    >
      <svg {...ICON}>
        {prefs.focus ? <path d="M6 2.5v3.5H2.5M10 2.5v3.5h3.5M6 13.5V10H2.5M10 13.5V10h3.5" /> : <path d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" />}
      </svg>
      {prefs.focus ? "Exit focus" : "Focus"}
    </button>
  );
}

export function SkimToggle() {
  const skim = useSyncExternalStore(subscribeSkim, getSkim, getServerSkim);
  return (
    <button type="button" className="toolbar-button" aria-pressed={skim} title="Show only headings and the opening of each section (S)" onClick={() => setSkim(!skim)}>
      <svg {...ICON}><path d="M2.5 3.5h11M2.5 8h7M2.5 12.5h9" /></svg>
      {skim ? "Read all" : "Skim"}
    </button>
  );
}
