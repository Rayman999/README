"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Details = {
  summary: string;
  stack: string[];
  repositoryUrl: string | null;
  entrypoints: string[];
  conventions: string[];
  openQuestions: string[];
  glossary: Record<string, string>;
};

const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

/** "Term: meaning", one per line. Only the first colon splits, so meanings may contain colons. */
function parseGlossary(value: string): { glossary: Record<string, string>; bad: string[] } {
  const glossary: Record<string, string> = {};
  const bad: string[] = [];
  for (const line of lines(value)) {
    const at = line.indexOf(":");
    const term = line.slice(0, at).trim();
    const meaning = line.slice(at + 1).trim();
    if (at < 1 || !term || !meaning) bad.push(line);
    else glossary[term] = meaning;
  }
  return { glossary, bad };
}

/**
 * Everything the overview's reference panels show, edited in one place. The
 * panels stay hidden from readers until they have content, so this is how an
 * editor makes them appear.
 */
export function OverviewEditor({ project, details }: { project: string; details: Details }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function save(form: FormData) {
    setError("");
    const { glossary, bad } = parseGlossary(String(form.get("glossary") ?? ""));
    if (bad.length) {
      setError(`Write each glossary line as "Term: meaning". Check: ${bad[0]}`);
      return;
    }
    const repository = String(form.get("repositoryUrl") ?? "").trim();
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: String(form.get("summary") ?? "").trim(),
          stack: String(form.get("stack") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
          repositoryUrl: repository || null,
          entrypoints: lines(String(form.get("entrypoints") ?? "")),
          conventions: lines(String(form.get("conventions") ?? "")),
          openQuestions: lines(String(form.get("openQuestions") ?? "")),
          glossary,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const field = body?.errors?.[0]?.path?.[0];
        throw new Error(field ? `Check the ${String(field).replace(/([A-Z])/g, " $1").toLowerCase()} field.` : body?.detail ?? "The overview could not be saved.");
      }
      dialog.current?.close();
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The overview could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const glossaryText = Object.entries(details.glossary).map(([term, meaning]) => `${term}: ${meaning}`).join("\n");

  return (
    <>
      <button type="button" className="toolbar-button ov-edit" onClick={() => { setError(""); dialog.current?.showModal(); }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.5 2.5l3 3-8 8h-3v-3z" />
        </svg>
        Edit overview
      </button>
      <dialog
        ref={dialog}
        className="ov-editor"
        aria-labelledby="ov-editor-title"
        onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}
      >
        <form action={save} className="ov-editor-surface">
          <header>
            <h2 id="ov-editor-title">Edit overview</h2>
            <p>What a newcomer should know before reading. Empty sections stay hidden from readers.</p>
          </header>
          <div className="ov-editor-fields">
            <label className="ov-field-wide">Summary
              <textarea name="summary" defaultValue={details.summary} rows={2} required maxLength={1000} />
            </label>
            <label>Stack <small>Comma separated</small>
              <input name="stack" defaultValue={details.stack.join(", ")} placeholder="Next.js, PostgreSQL, Nx" />
            </label>
            <label>Repository
              <input name="repositoryUrl" type="url" defaultValue={details.repositoryUrl ?? ""} placeholder="https://github.com/…" />
            </label>
            <label className="ov-field-wide">Glossary <small>One per line — Term: meaning</small>
              <textarea name="glossary" defaultValue={glossaryText} rows={5} placeholder={"Workspace: Everything one team documents.\nSlug: The permanent URL-safe name of a page."} />
            </label>
            <label>Where the code starts <small>One file or folder per line</small>
              <textarea name="entrypoints" defaultValue={details.entrypoints.join("\n")} rows={4} placeholder={"apps/web/src/main.tsx\nlibs/api/src/index.ts"} className="ov-mono" />
            </label>
            <label>House rules <small>One per line</small>
              <textarea name="conventions" defaultValue={details.conventions.join("\n")} rows={4} placeholder="Slugs are lowercase-kebab and never change." />
            </label>
            <label className="ov-field-wide">Still undecided <small>Open questions, one per line</small>
              <textarea name="openQuestions" defaultValue={details.openQuestions.join("\n")} rows={3} />
            </label>
          </div>
          {error && <p className="ov-editor-error" role="alert">{error}</p>}
          <footer>
            <button type="button" className="secondary-action" onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="submit" className="primary-action" disabled={busy || pending}>{busy || pending ? "Saving…" : "Save overview"}</button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
