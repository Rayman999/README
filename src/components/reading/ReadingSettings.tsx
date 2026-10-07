"use client";

import { useEffect, useState } from "react";
import { BUILT_IN_PRESETS, CONCRETE_THEMES, NUMBER_PREFS, setPrefs, setProjectPreset, type ReadingPrefs } from "@/lib/reading/prefs";
import { formatMinutes } from "@/lib/reading/format";
import {
  CONTRASTS,
  FacePicker,
  Group,
  PresetPicker,
  Segmented,
  SizePicker,
  SpacingPicker,
  THEMES,
  ThemePicker,
  Toggle,
  useReader,
  WidthPicker,
} from "./SettingsControls";
import { Bionic, FeaturePaint, GlossaryHover, SentenceFocus } from "./ReaderFeatures";

const SECTIONS = [
  { id: "look", label: "Look" },
  { id: "focus", label: "Focus" },
  { id: "listening", label: "Listening" },
  { id: "habits", label: "Habits" },
] as const;

const SAMPLE_GLOSSARY = {
  Workspace: "Everything one team documents, in one place.",
  "learning path": "A curated reading order through existing pages.",
};

function Slider({ name, label, format }: { name: keyof typeof NUMBER_PREFS; label: string; format: (value: number) => string }) {
  const { prefs } = useReader();
  const { min, max, step } = NUMBER_PREFS[name];
  return (
    <label className="settings-slider">
      <span className="settings-slider-head"><span>{label}</span><output>{format(prefs[name])}</output></span>
      <input type="range" min={min} max={max} step={step} value={prefs[name]} onChange={(event) => setPrefs({ [name]: Number(event.target.value) } as Partial<ReadingPrefs>)} />
    </label>
  );
}

function ContrastSlider() {
  const { prefs } = useReader();
  const index = CONTRASTS.findIndex((entry) => entry.value === prefs.contrast);
  return (
    <label className="settings-slider">
      <span className="settings-slider-head"><span>Text contrast</span><output>{CONTRASTS[index]?.label}</output></span>
      <input type="range" min={0} max={CONTRASTS.length - 1} step={1} value={index} onChange={(event) => setPrefs({ contrast: CONTRASTS[Number(event.target.value)].value })} />
      <span className="settings-slider-ends"><span>Soft</span><span>Crisp</span></span>
    </label>
  );
}

function ScheduleControls() {
  const { prefs } = useReader();
  if (prefs.theme !== "schedule") return <p className="prefs-hint">Pick <strong>Schedule</strong> to switch themes at set times — say Paper by day and Dusk after dark.</p>;
  const select = (name: "dayTheme" | "nightTheme") => (
    <select value={prefs[name]} onChange={(event) => setPrefs({ [name]: event.target.value } as Partial<ReadingPrefs>)}>
      {CONCRETE_THEMES.map((theme) => <option key={theme} value={theme}>{THEMES.find((entry) => entry.value === theme)?.label}</option>)}
    </select>
  );
  const time = (name: "dayStart" | "nightStart") => (
    <input type="time" value={prefs[name]} onChange={(event) => event.target.value && setPrefs({ [name]: event.target.value } as Partial<ReadingPrefs>)} />
  );
  return (
    <div className="schedule-grid">
      <label>Day theme {select("dayTheme")}</label>
      <label>from {time("dayStart")}</label>
      <label>Night theme {select("nightTheme")}</label>
      <label>from {time("nightStart")}</label>
    </div>
  );
}

function VoiceControls() {
  const { prefs } = useReader();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    if (!("speechSynthesis" in window)) { setSupported(false); return; }
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  if (!supported) return <p className="prefs-hint">This browser can&rsquo;t read aloud.</p>;
  const test = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("This is how pages will sound when you press Listen.");
    utterance.rate = prefs.voiceRate;
    const voice = voices.find((entry) => entry.name === prefs.voice);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
  return (
    <div className="settings-stack">
      <label className="settings-field">Voice
        <select value={prefs.voice} onChange={(event) => setPrefs({ voice: event.target.value })}>
          <option value="">System default</option>
          {voices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name} ({voice.lang})</option>)}
        </select>
      </label>
      <Slider name="voiceRate" label="Speed" format={(value) => `${value.toFixed(1)}×`} />
      <button type="button" className="secondary-action settings-test" onClick={test}>Play a sample</button>
    </div>
  );
}

type Stats = { week: { day: string; seconds: number; pages: number }[]; weekSeconds: number; weekPages: number; streak: number };

function ReadingStats() {
  const { prefs } = useReader();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    fetch(`/api/reader/activity?day=${new Date().toLocaleDateString("en-CA")}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, []);
  if (!stats) return <p className="prefs-hint">Loading your week…</p>;
  const peak = Math.max(60, ...stats.week.map((entry) => entry.seconds));
  return (
    <div className="stats">
      <dl className="stats-numbers">
        <div><dt>This week</dt><dd>{formatMinutes(Math.round(stats.weekSeconds / 60))}</dd></div>
        <div><dt>Pages finished</dt><dd>{stats.weekPages}</dd></div>
        {prefs.showStreak && <div><dt>Streak</dt><dd>{stats.streak} day{stats.streak === 1 ? "" : "s"}</dd></div>}
      </dl>
      <div className="stats-week" role="img" aria-label="Minutes read each day this week">
        {stats.week.map((entry) => {
          const date = new Date(`${entry.day}T00:00:00`);
          return (
            <div key={entry.day} className="stats-day" title={`${Math.round(entry.seconds / 60)} min, ${entry.pages} pages`}>
              <span className="stats-bar"><i style={{ height: `${Math.max(entry.seconds > 0 ? 6 : 0, (entry.seconds / peak) * 100)}%` }} /></span>
              <span className="stats-label">{date.toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
            </div>
          );
        })}
      </div>
      <Toggle name="showStreak" label="Show my streak" hint="Days in a row with at least a minute of reading" />
    </div>
  );
}

function ProjectPresets({ projects }: { projects: { slug: string; name: string }[] }) {
  const { presets, projectPresets } = useReader();
  const options = [...BUILT_IN_PRESETS, ...presets];
  if (!projects.length) return <p className="prefs-hint">No projects yet.</p>;
  return (
    <ul className="project-presets">
      {projects.map((project) => (
        <li key={project.slug}>
          <span>{project.name}</span>
          <select value={projectPresets[project.slug] ?? ""} onChange={(event) => setProjectPreset(project.slug, event.target.value || null)} aria-label={`Preset for ${project.name}`}>
            <option value="">My usual settings</option>
            {options.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </li>
      ))}
    </ul>
  );
}

/** Paragraph focus for the preview (the reader's own version lives in ReaderRuntime). */
function PreviewParagraphFocus() {
  useEffect(() => {
    const body = document.querySelector<HTMLElement>(".settings-preview .doc-body");
    if (!body) return;
    let current: Element | null = body.children[1] ?? null;
    current?.setAttribute("data-current", "");
    const onMove = (event: PointerEvent) => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const block = hit && body.contains(hit) ? [...body.children].find((child) => child.contains(hit)) : null;
      if (block && block !== current) { current?.removeAttribute("data-current"); block.setAttribute("data-current", ""); current = block; }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); current?.removeAttribute("data-current"); };
  }, []);
  return null;
}

function Preview() {
  const { prefs } = useReader();
  const words = 1200;
  return (
    <aside className="settings-preview-wrap" aria-label="Live preview">
      <p className="settings-preview-label">Live preview <span>— hover the text to try focus and glossary</span></p>
      <div className="doc-panel settings-preview-panel">
        <div className="reading-content settings-preview">
          <p className="settings-preview-meta">{Math.max(1, Math.round(words / prefs.wpm))} min read at {prefs.wpm} words a minute</p>
          <div className="doc-body">
            <h2>Why the page reads this way</h2>
            <p>Every page in this Workspace is set for long, comfortable reading. Lines stay short enough for the eye to find the next one, and the spacing gives each line room to breathe. Change anything on the left and this text follows.</p>
            <p>If you are new to a project, start with its learning path. It walks through the pages in the order that makes them easiest to understand, so nothing assumes knowledge you don&rsquo;t have yet.</p>
            <h3>A short checklist</h3>
            <ul>
              <li>Pick a theme that suits the light you&rsquo;re reading in.</li>
              <li>Choose a typeface and size you can read for an hour.</li>
              <li>Turn on a focus aid if your eyes wander.</li>
            </ul>
            <div className="code-block"><div className="code-block__bar"><span>bash</span></div><pre><code>npm run dev   # start the documentation locally</code></pre></div>
          </div>
        </div>
      </div>
      <FeaturePaint />
      <SentenceFocus root=".settings-preview" />
      <Bionic root=".settings-preview" />
      <GlossaryHover glossary={SAMPLE_GLOSSARY} root=".settings-preview" />
      {prefs.focusMode === "paragraph" && <PreviewParagraphFocus />}
    </aside>
  );
}

export function ReadingSettings({ projects }: { projects: { slug: string; name: string }[] }) {
  const { prefs } = useReader();

  return (
    <div className="settings-layout">
      <header className="settings-header">
        <p className="eyebrow">Your reading</p>
        <h1>Reading settings</h1>
        <p>Make every page read the way you like. Changes apply instantly and are saved to your account, so they follow you to any device.</p>
        <nav className="settings-tabs" aria-label="Settings sections">
          {SECTIONS.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
        </nav>
      </header>

      <div className="settings-columns">
        <div className="settings-sections">
          <section id="look" className="settings-section">
            <h2>Look</h2>
            <Group label="Presets" hint="A preset sets the whole look in one click. Your reading speed and voice are never changed by one."><PresetPicker /></Group>
            <Group label="Theme"><ThemePicker /><ScheduleControls /></Group>
            <Group label="Typeface"><FacePicker /></Group>
            <Group label="Text size"><SizePicker /></Group>
            <Group label="Page width" hint="How wide the page is. Changing the text size doesn't change this."><WidthPicker /></Group>
            <Group label="Line spacing"><SpacingPicker /></Group>
            <Group label="Contrast" hint="Fine-tunes how strongly body text stands out, within whichever theme you use."><ContrastSlider /></Group>
            <Group label="Text style">
              <div className="settings-pair">
                <Segmented name="align" choices={[{ value: "left", label: "Ragged right" }, { value: "justify", label: "Justified" }]} />
                <Segmented name="paragraph" choices={[{ value: "spaced", label: "Spaced paragraphs" }, { value: "indented", label: "Book indents" }]} />
              </div>
            </Group>
            <Group label="Code">
              <Segmented name="codeSize" choices={[{ value: "s", label: "Small code" }, { value: "m", label: "Medium code" }, { value: "l", label: "Large code" }]} />
              <Toggle name="codeWrap" label="Wrap long code lines" hint="No sideways scrolling in code blocks" />
            </Group>
          </section>

          <section id="focus" className="settings-section">
            <h2>Focus</h2>
            <Group label="Focus aid" hint="Fade everything except what you're reading. Follows your mouse; on touch screens it follows your scroll position.">
              <Segmented name="focusMode" choices={[{ value: "off", label: "Off" }, { value: "paragraph", label: "Paragraph" }, { value: "sentence", label: "Sentence" }]} />
            </Group>
            <div className="prefs-toggles">
              <Toggle name="bionic" label="Bionic reading" hint="Bolds the start of every word, which some people find makes scanning easier" />
              <Toggle name="focus" label="Hide side panels" hint="Only the page and its header. Shortcut: F" />
              <Toggle name="autoHideHeader" label="Hide header while reading" hint="Slides away as you scroll down, back as you scroll up" />
              <Toggle name="reduceMotion" label="Reduce motion" hint="Turn off every animation and smooth scroll, whatever your system says" />
            </div>
            <Group label="Auto-scroll" hint="A slow, steady scroll, like a teleprompter. Start it from the toolbar or press A on a page; Space pauses, Esc stops.">
              <Slider name="scrollSpeed" label="Speed" format={(value) => `${value} px/s`} />
            </Group>
            <p className="settings-note"><strong>Distraction-free:</strong> on any page, press <kbd>Z</kbd> or use the toolbar to go full screen with only the text.</p>
          </section>

          <section id="listening" className="settings-section">
            <h2>Listening &amp; understanding</h2>
            <Group label="Read aloud" hint="Press Listen on a page (or L). It starts where you are and highlights each sentence as it's read."><VoiceControls /></Group>
            <div className="prefs-toggles">
              <Toggle name="glossary" label="Glossary hover" hint="Underlines a project's own terms; hover one for its definition" />
            </div>
          </section>

          <section id="habits" className="settings-section">
            <h2>Habits</h2>
            <Group label="Reading speed" hint={`Every "min read" and "min left" uses this. A 1,200-word page takes you about ${Math.max(1, Math.round(1200 / prefs.wpm))} minutes.`}>
              <Slider name="wpm" label="Words per minute" format={(value) => `${value}`} />
            </Group>
            <Group label="Look per project" hint="Use a preset automatically on one project's pages, everywhere else your usual settings."><ProjectPresets projects={projects} /></Group>
            <Group label="This week"><ReadingStats /></Group>
            <Group label="Keyboard">
              <dl className="prefs-keys">
                <div><dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous / next page</dd></div>
                <div><dt><kbd>F</kbd></dt><dd>Hide side panels</dd></div>
                <div><dt><kbd>S</kbd></dt><dd>Skim mode</dd></div>
                <div><dt><kbd>L</kbd></dt><dd>Read aloud</dd></div>
                <div><dt><kbd>A</kbd></dt><dd>Auto-scroll</dd></div>
                <div><dt><kbd>Z</kbd></dt><dd>Distraction-free</dd></div>
                <div><dt><kbd>Ctrl</kbd> <kbd>K</kbd></dt><dd>Search</dd></div>
              </dl>
            </Group>
          </section>
        </div>
        <Preview />
      </div>
    </div>
  );
}
