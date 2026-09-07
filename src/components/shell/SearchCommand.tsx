"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { slug: string; title: string; description: string; status: string; project: string; href: string; kind: "page" | "path" };

export function SearchCommand() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const open = () => { dialog.current?.showModal(); requestAnimationFrame(() => input.current?.focus()); };
  const close = () => { dialog.current?.close(); setQuery(""); setResults([]); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); open(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (response.ok) { const data = await response.json(); setResults(data.results); setActive(0); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  const choose = (result: Result) => { close(); router.push(result.href); };

  return <>
    <button type="button" onClick={open} className="search-trigger" aria-label="Search documentation">
      <span aria-hidden>⌕</span><span className="hidden sm:inline">Search</span><kbd>Ctrl K</kbd>
    </button>
    <dialog ref={dialog} className="search-dialog" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }}>
      <div className="search-surface">
        <label htmlFor="global-search">Search the library</label>
        <input ref={input} id="global-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Search standards, systems, code paths…" autoComplete="off"
          onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive(value => Math.min(results.length - 1, value + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive(value => Math.max(0, value - 1)); }
            if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
          }} />
        <div className="search-results" role="listbox" aria-label="Search results">
          {results.map((result, index) => <button type="button" role="option" aria-selected={index === active}
            key={`${result.project}-${result.slug}`} onMouseEnter={() => setActive(index)} onClick={() => choose(result)}>
            <span><strong>{result.title}</strong><small>{result.project} · {result.kind === "path" ? "Guided path" : result.status}</small></span>
            <p>{result.description}</p>
          </button>)}
          {!loading && query.length >= 2 && results.length === 0 && <p className="search-empty">No matching documentation. Try fewer or broader words.</p>}
          {loading && <p className="search-empty" role="status">Searching…</p>}
          {query.length < 2 && <p className="search-empty">Type at least two characters to search every project.</p>}
        </div>
        <footer><span>↑↓ Select</span><span>Enter Open</span><button type="button" onClick={close}>Esc Close</button></footer>
      </div>
    </dialog>
  </>;
}
