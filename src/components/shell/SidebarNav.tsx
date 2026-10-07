"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shell/NavigationLink";
import type { NavPage, NavSection } from "./types";
import { Icon, ICONS } from "./icons";
import { useReadingRecords } from "@/components/reading/ReadingRecords";

const COLLAPSE_KEY = "readme:nav";
const FOLDER = "M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1z";
const CHECK = "M3.5 8.5l3 3 6-7";

type Node = NavSection & { children: Node[] };

function buildTree(sections: NavSection[]) {
  const byId = new Map<string, Node>();
  for (const section of sections) byId.set(section.id, { ...section, children: [] });
  const roots: Node[] = [];
  for (const section of sections) {
    const node = byId.get(section.id)!;
    const parent = section.parentId ? byId.get(section.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Reading order: a folder's own pages, then its sub-folders. Matches the server's order. */
function readingOrder(nodes: Node[]): NavPage[] {
  return nodes.flatMap((node) => [...node.pages, ...readingOrder(node.children)]);
}

function subtreePages(node: Node): NavPage[] {
  return [...node.pages, ...node.children.flatMap(subtreePages)];
}

function JourneyMark({ page, step, active }: { page: NavPage; step: number; active: boolean }) {
  const { records } = useReadingRecords();
  const record = records[page.id];
  if (record?.done) {
    return (
      <span className="journey-mark journey-done" title="Read">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={CHECK} /></svg>
        <span className="sr-only">Read</span>
      </span>
    );
  }
  if (record && record.progress > 0.08) {
    return (
      <span className="journey-mark read-mark-partial" style={{ "--partial": record.progress } as React.CSSProperties} title={`${Math.round(record.progress * 100)}% read`}>
        <span className="sr-only">{Math.round(record.progress * 100)}% read</span>
      </span>
    );
  }
  return <span className="journey-mark journey-step" data-active={active} aria-hidden>{step}</span>;
}

/** The project as a route: how far through it you are, and the next stop. */
function JourneyHeader({ order, currentHref }: { order: NavPage[]; currentHref: string }) {
  const { records } = useReadingRecords();
  if (order.length < 2) return null;
  const read = order.filter((page) => records[page.id]?.done).length;
  const here = order.findIndex((page) => page.href === currentHref);
  // The next stop is the first unread page after where you are, wrapping round.
  const after = [...order.slice(here + 1), ...order.slice(0, Math.max(0, here))];
  const next = here >= 0 ? after.find((page) => !records[page.id]?.done) : order.find((page) => !records[page.id]?.done);
  return (
    <section className="journey" aria-label="Your route through this project">
      <div className="journey-head">
        <span>{here >= 0 ? `Stop ${here + 1} of ${order.length}` : `${order.length} stops`}</span>
        <span>{read === order.length ? "All read" : `${read} read`}</span>
      </div>
      <div className="journey-track" aria-hidden>
        <span style={{ width: `${(read / order.length) * 100}%` }} />
        {here >= 0 && <i style={{ left: `${((here + 0.5) / order.length) * 100}%` }} />}
      </div>
      {next && (
        <Link href={next.href} className="journey-next">
          <span>Next stop</span>
          <strong>{next.title}</strong>
        </Link>
      )}
    </section>
  );
}

function Folder({
  node,
  currentHref,
  steps,
  query,
  collapsed,
  toggle,
  openPath,
}: {
  node: Node;
  currentHref: string;
  steps: Map<string, number>;
  query: string;
  collapsed: Record<string, boolean>;
  toggle: (slug: string) => void;
  openPath: Set<string>;
}) {
  const { records } = useReadingRecords();
  const q = query.toLowerCase();
  const pages = q ? node.pages.filter((page) => page.title.toLowerCase().includes(q)) : node.pages;
  const all = subtreePages(node);
  const matches = q ? all.some((page) => page.title.toLowerCase().includes(q)) : true;
  if (!matches) return null;

  // Always show the way to where you are; otherwise respect what was collapsed.
  const isCollapsed = !q && !openPath.has(node.slug) && (collapsed[node.slug] ?? false);
  const read = all.filter((page) => records[page.id]?.done).length;
  const top = node.depth === 0;

  return (
    <li className="nav-folder" data-top={top}>
      <button
        type="button"
        aria-expanded={!isCollapsed}
        title={node.description || undefined}
        onClick={() => toggle(node.slug)}
        className="nav-folder-row"
      >
        <span className="nav-folder-chevron" data-open={!isCollapsed} aria-hidden>
          <Icon path={ICONS.chevron} size={10} />
        </span>
        {!top && <span className="nav-folder-icon" aria-hidden><Icon path={FOLDER} size={13} /></span>}
        <span className="nav-folder-title">{node.title}</span>
        {all.length > 0 && <span className="nav-folder-count">{read > 0 ? `${read}/${all.length}` : all.length}</span>}
      </button>

      <div className="nav-collapse" data-open={!isCollapsed} inert={isCollapsed}>
        <div className="nav-collapse-inner">
          <ul className="nav-folder-body">
            {pages.map((page) => {
              const active = page.href === currentHref;
              return (
                <li key={page.id}>
                  <Link href={page.href} aria-current={active ? "page" : undefined} className="nav-page" data-active={active}>
                    {active && <span aria-hidden className="nav-indicator" />}
                    <JourneyMark page={page} step={steps.get(page.id) ?? 0} active={active} />
                    <span className="nav-page-title">{page.title}</span>
                  </Link>
                </li>
              );
            })}
            {node.children.map((child) => (
              <Folder key={child.id} node={child} currentHref={currentHref} steps={steps} query={query} collapsed={collapsed} toggle={toggle} openPath={openPath} />
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

export function SidebarNav({
  sections,
  currentHref,
  projectName,
  projectHref,
}: {
  sections: NavSection[];
  currentHref: string;
  projectName?: string;
  projectHref?: string;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* storage unavailable — everything starts expanded */
    }
  }, []);

  const toggle = (slug: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [slug]: !prev[slug] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { roots, order, steps, openPath } = useMemo(() => {
    const roots = buildTree(sections);
    const order = readingOrder(roots);
    const steps = new Map(order.map((page, index) => [page.id, index + 1]));
    // Folders on the way to the current page stay open.
    const openPath = new Set<string>();
    const bySlug = new Map(sections.map((section) => [section.id, section]));
    const home = sections.find((section) => section.pages.some((page) => page.href === currentHref));
    for (let at = home; at; at = at.parentId ? bySlug.get(at.parentId) : undefined) openPath.add(at.slug);
    return { roots, order, steps, openPath };
  }, [sections, currentHref]);

  const q = query.toLowerCase();
  const noMatches = q && !order.some((page) => page.title.toLowerCase().includes(q));

  return (
    <nav aria-label="Documentation" className="pr-2">
      <Link href="/" className="ease-base mb-4 flex items-center gap-1.5 px-2 text-[11.5px] text-muted transition-colors duration-200 hover:text-secondary">
        <span className="inline-flex rotate-180"><Icon path={ICONS.chevron} size={10} /></span>
        All projects
      </Link>
      <Link href="/highlights" className="ease-base mb-4 -mt-2 flex items-center gap-1.5 px-2 text-[11.5px] text-muted transition-colors duration-200 hover:text-secondary md:hidden">
        Your highlights
      </Link>

      {projectName && (
        <Link
          href={projectHref ?? "#"}
          className={`ease-base mb-3 flex h-[31px] items-center gap-2 rounded-control px-2 text-[13.5px] font-medium transition-colors duration-200 ${
            currentHref === projectHref ? "bg-state-selected text-primary" : "text-secondary hover:bg-state-hover hover:text-primary"
          }`}
        >
          <span className="text-muted"><Icon path={ICONS.book} /></span>
          <span className="truncate">{projectName}</span>
        </Link>
      )}

      <JourneyHeader order={order} currentHref={currentHref} />

      {sections.length === 0 && (
        <p className="px-2 text-[12.5px] leading-relaxed text-muted">No pages yet. Pages you add will appear here, grouped into folders.</p>
      )}

      {order.length > 6 && (
        <label className="nav-filter">Find a page
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter page titles…" />
        </label>
      )}
      {noMatches && <p role="status" className="px-2 text-sm">No matching pages. Try a shorter title.</p>}

      <ul className="nav-tree">
        {roots.map((node) => (
          <Folder key={node.id} node={node} currentHref={currentHref} steps={steps} query={query} collapsed={collapsed} toggle={toggle} openPath={openPath} />
        ))}
      </ul>
    </nav>
  );
}
