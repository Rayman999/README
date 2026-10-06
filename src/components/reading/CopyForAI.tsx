"use client";

import { useRef, useState } from "react";

type State = "idle" | "copying" | "copied" | "manual";

/** The pre-Clipboard-API route; still works in places that deny the new one. */
function legacyCopy(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Copies the page, framed for an AI chat, for when the MCP connection isn't
 * there. The clipboard is handed a pending fetch rather than awaited text
 * (Safari only allows clipboard writes inside the click itself). If every
 * clipboard route is blocked, the text opens selected so Ctrl+C still works.
 */
export function CopyForAI({ project, page }: { project: string; page: string }) {
  const [state, setState] = useState<State>("idle");
  const [manualText, setManualText] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const url = `/api/projects/${encodeURIComponent(project)}/pages/${encodeURIComponent(page)}/agent-context`;

  async function copy() {
    setState("copying");
    const text = fetch(url).then((response) => {
      if (!response.ok) throw new Error("export failed");
      return response.text();
    });
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": text.then((value) => new Blob([value], { type: "text/plain" })) }),
        ]);
      } else {
        await navigator.clipboard.writeText(await text);
      }
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
      return;
    } catch {
      /* fall through to the older routes */
    }
    let value: string;
    try {
      value = await text;
    } catch {
      setState("idle");
      return;
    }
    if (legacyCopy(value)) {
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
      return;
    }
    setManualText(value);
    setState("manual");
    dialog.current?.showModal();
    requestAnimationFrame(() => area.current?.select());
  }

  const label = state === "copying" ? "Copying…" : state === "copied" ? "Copied" : "Copy for AI";

  return (
    <>
      <button
        type="button"
        className="toolbar-button"
        data-state={state}
        title="Copy this page as Markdown with context, ready to paste into an AI chat"
        onClick={() => void copy()}
        disabled={state === "copying"}
        aria-live="polite"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {state === "copied" ? (
            <path d="M3.5 8.5l3 3 6-7" />
          ) : (
            <path d="M5.5 5.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
          )}
        </svg>
        {label}
      </button>
      <dialog
        ref={dialog}
        className="copy-manual"
        aria-labelledby="copy-manual-title"
        onClose={() => setState("idle")}
        onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}
      >
        <div className="copy-manual-surface">
          <h2 id="copy-manual-title">Copy for AI</h2>
          <p>Your browser blocked automatic copying. The text is selected — press <kbd>Ctrl</kbd> <kbd>C</kbd> (or <kbd>⌘</kbd> <kbd>C</kbd>) and paste it into your chat.</p>
          <textarea ref={area} readOnly value={manualText} rows={12} onFocus={(event) => event.currentTarget.select()} />
          <footer>
            <button type="button" className="primary-action" onClick={() => dialog.current?.close()}>Done</button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
