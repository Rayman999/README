"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "../shell/types";

export function ReadingTools({ entries }: { entries: TocEntry[] }) {
  const [focus, setFocus] = useState(false);
  const [large, setLarge] = useState(false);
  const [minutes, setMinutes] = useState(1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    try { setLarge(localStorage.getItem("readme:large-text") === "true"); } catch {}
    const body = document.querySelector(".reading-content");
    setMinutes(Math.max(1, Math.ceil((body?.textContent?.trim().split(/\s+/).length ?? 0) / 200)));
    const update = () => {
      if (!body) return;
      const rect = body.getBoundingClientRect();
      setProgress(Math.round(Math.max(0, Math.min(1, (window.innerHeight - rect.top) / rect.height)) * 100));
    };
    update();
    const observer = new ResizeObserver(update);
    if (body) observer.observe(body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("reading-focus", focus);
    document.documentElement.classList.toggle("reading-large", large);
    return () => { document.documentElement.classList.remove("reading-focus", "reading-large"); };
  }, [focus, large]);

  return <div className="reading-tools">
    <div className="reading-tools-row">
      <span>About {minutes} min read <span aria-hidden="true">·</span> {entries.filter(e => e.level === 2).length} sections</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={large} onClick={() => { setLarge(!large); try { localStorage.setItem("readme:large-text", String(!large)); } catch {} }}>Larger text</button>
        <button type="button" aria-pressed={focus} onClick={() => setFocus(!focus)}>{focus ? "Exit focus" : "Focus mode"}</button>
      </div>
    </div>
    <div className="reading-progress" role="progressbar" aria-label="Position in document" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
    {entries.length > 0 && <details className="reading-outline"><summary>Preview the outline</summary><nav aria-label="Document outline"><ol>{entries.map(entry => <li key={entry.id}><a href={`#${entry.id}`}>{entry.text}</a></li>)}</ol></nav></details>}
  </div>;
}

export function ReadingReflection() {
  return <details className="reading-reflection"><summary>Pause & put it into practice</summary><p>Before moving on, explain the main idea in your own words.</p><ul><li>Where would you use this in your work?</li><li>What is one thing you would check before implementing it?</li></ul><p>You can revisit the outline above whenever you need a refresher.</p></details>;
}
