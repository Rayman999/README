"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/shell/NavigationLink";

type Page = { slug: string; title: string; href: string };
type Path = { id: string; title: string; description: string; pageSlugs: string[] };

export function LearningPaths({ project, paths, pages, editable }: {
  project: string; paths: Path[]; pages: Page[]; editable: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [completed, setCompleted] = useState<Record<string, string[]>>({});
  const pageBySlug = new Map(pages.map(page => [page.slug, page]));

  useEffect(() => {
    try { setCompleted(JSON.parse(localStorage.getItem(`readme-learning:${project}`) ?? "{}")); }
    catch { setCompleted({}); }
  }, [project]);

  function toggleComplete(pathId: string, slug: string) {
    setCompleted(current => {
      const values = new Set(current[pathId] ?? []);
      if (values.has(slug)) values.delete(slug); else values.add(slug);
      const next = { ...current, [pathId]: [...values] };
      localStorage.setItem(`readme-learning:${project}`, JSON.stringify(next));
      return next;
    });
  }

  async function create(form: FormData) {
    setError("");
    const response = await fetch(`/api/projects/${encodeURIComponent(project)}/learning-paths`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.get("title"), description: form.get("description"), pageSlugs: form.getAll("pages") }),
    });
    if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.detail ?? "Could not create the path."); return; }
    setCreating(false); startTransition(() => router.refresh());
  }
  async function remove(id: string) {
    const response = await fetch(`/api/projects/${encodeURIComponent(project)}/learning-paths/${id}`, { method: "DELETE" });
    if (response.ok) startTransition(() => router.refresh());
  }

  return <section id="learning-paths" className="mt-10 scroll-mt-24">
    <div className="flex items-end justify-between gap-4"><div><span className="eyebrow">Guided learning</span><h2 className="text-[21px] font-semibold text-heading">Learning paths</h2></div>
      {editable && pages.length > 0 && <button type="button" onClick={() => setCreating(value => !value)} className="secondary-action">{creating ? "Cancel" : "Create path"}</button>}
    </div>
    <p className="mt-2 text-sm">Follow a curated sequence when you want to learn this project in the right order.</p>
    {creating && <form action={create} className="learning-path-form motion-enter">
      <label>Path title<input required name="title" placeholder="New developer essentials" /></label>
      <label>What will someone learn?<textarea required name="description" rows={2} placeholder="Understand the project boundaries and make a safe first change." /></label>
      <fieldset><legend>Choose pages in reading order</legend><div className="path-page-picker">{pages.map((page, index) => <label key={page.slug}><input type="checkbox" name="pages" value={page.slug} /><span>{index + 1}</span>{page.title}</label>)}</div></fieldset>
      {error && <p role="alert">{error}</p>}<button disabled={pending} className="primary-action">Create learning path</button>
    </form>}
    {paths.length ? <div className="learning-path-grid">{paths.map(path => { const done = completed[path.id] ?? []; const available = path.pageSlugs.filter(slug => pageBySlug.has(slug)); return <article id={`learning-path-${path.id}`} key={path.id} className="learning-path-card">
      <div><span className="path-progress-label">{done.filter(slug => available.includes(slug)).length} of {available.length} complete</span><h3>{path.title}</h3><p>{path.description}</p><div className="path-progress" aria-hidden><span style={{ width: `${available.length ? done.filter(slug => available.includes(slug)).length / available.length * 100 : 0}%` }} /></div></div>
      <ol>{path.pageSlugs.map((slug, index) => { const page = pageBySlug.get(slug); return page && <li key={slug}><label aria-label={`Mark ${page.title} complete`}><input type="checkbox" checked={done.includes(slug)} onChange={() => toggleComplete(path.id, slug)} /><span>{index + 1}</span></label><Link href={page.href}>{page.title}</Link></li>; })}</ol>
      {editable && <button type="button" onClick={() => void remove(path.id)} className="path-delete">Remove path</button>}
    </article>; })}</div> : !creating && <p className="empty-learning-path">No learning paths yet. Pages are still available below.</p>}
  </section>;
}
