"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "@/components/shell/NavigationLink";
import type { NavPage, NavSection } from "./types";
import { Icon, ICONS } from "./icons";
import { useReadingRecords } from "@/components/reading/ReadingRecords";

const COLLAPSE_KEY = "readme:nav";
const FOLDER = "M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1z";
const CHECK = "M3.5 8.5l3 3 6-7";

type Node = NavSection & { children: Node[] };

// Which folders the reader has collapsed, shared by every sidebar instance.
let collapsedCache: Record<string, boolean> | null = null;
const collapseListeners = new Set<() => void>();
const NOTHING_COLLAPSED: Record<string, boolean> = {};

function getCollapsed(): Record<string, boolean> {
  if (!collapsedCache) {
    try {
      collapsedCache = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "{}") ?? {};
    } catch {
      collapsedCache = {};
    }
  }
  return collapsedCache!;
}

function getServerCollapsed() {
  return NOTHING_COLLAPSED;
}

function setCollapsed(next: Record<string, boolean>) {
  collapsedCache = next;
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
  } catch {
    /* still applies for this visit */
  }
  collapseListeners.forEach((listener) => listener());
}

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  return () => collapseListeners.delete(listener);
}

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

function JourneyMark({ page, active }: { page: NavPage; active: boolean }) {
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
  // Unread pages stay unmarked so the list reads as titles, not a checklist.
  return <span className="journey-mark" data-active={active} aria-hidden />;
}

/** A quiet one-line sense of how far through the project you are. */
function JourneyHeader({ order }: { order: NavPage[] }) {
  const { records } = useReadingRecords();
  if (order.length < 2) return null;
  const read = order.filter((page) => records[page.id]?.done).length;
  return (
    <section className="journey" aria-label="Your progress through this project">
      <div className="journey-head">
        <span>{read === order.length ? "All read" : `${read} of ${order.length} read`}</span>
      </div>
      <div className="journey-track" aria-hidden>
        <span style={{ width: `${(read / order.length) * 100}%` }} />
      </div>
    </section>
  );
}

function Folder({
  node,
  currentHref,
  query,
  collapsed,
  toggle,
  openPath,
}: {
  node: Node;
  currentHref: string;
  query: string;
  collapsed: Record<string, boolean>;
  toggle: (slug: string, collapse: boolean) => void;
  openPath: Set<string>;
}) {
  const { records } = useReadingRecords();
  const q = query.toLowerCase();
  const pages = q ? node.pages.filter((page) => page.title.toLowerCase().includes(q)) : node.pages;
  const all = subtreePages(node);
  const matches = q ? all.some((page) => page.title.toLowerCase().includes(q)) : true;
  if (!matches) return null;

  // Always show the way to where you are. Other folders start closed so the
  // sidebar stays calm, unless the reader opened them.
  const isCollapsed = !q && !openPath.has(node.slug) && (collapsed[node.slug] ?? true);
  const read = all.filter((page) => records[page.id]?.done).length;
  const top = node.depth === 0;

  return (
    <li className="nav-folder" data-top={top}>
      <button
        type="button"
        aria-expanded={!isCollapsed}
        title={node.description || undefined}
        onClick={() => toggle(node.slug, !isCollapsed)}
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
                    <JourneyMark page={page} active={active} />
                    <span className="nav-page-title">{page.title}</span>
                  </Link>
                </li>
              );
            })}
            {node.children.map((child) => (
              <Folder key={child.id} node={child} currentHref={currentHref} query={query} collapsed={collapsed} toggle={toggle} openPath={openPath} />
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
  // Read synchronously from a shared store: the sidebar remounts on every
  // page, and loading this in an effect made collapsed folders open for one
  // frame and then animate shut — the "jump".
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, getServerCollapsed);
  const toggle = (slug: string, collapse: boolean) => setCollapsed({ ...getCollapsed(), [slug]: collapse });

  // Open/close animation only for clicks, never for the first frame.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const { roots, order, openPath } = useMemo(() => {
    const roots = buildTree(sections);
    const order = readingOrder(roots);
    // Folders on the way to the current page stay open.
    const openPath = new Set<string>();
    const bySlug = new Map(sections.map((section) => [section.id, section]));
    const home = sections.find((section) => section.pages.some((page) => page.href === currentHref));
    for (let at = home; at; at = at.parentId ? bySlug.get(at.parentId) : undefined) openPath.add(at.slug);
    return { roots, order, openPath };
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

      <JourneyHeader order={order} />

      {sections.length === 0 && (
        <p className="px-2 text-[12.5px] leading-relaxed text-muted">No pages yet. Pages you add will appear here, grouped into folders.</p>
      )}

      {order.length > 12 && (
        <label className="nav-filter"><span className="sr-only">Find a page</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter page titles…" />
        </label>
      )}
      {noMatches && <p role="status" className="px-2 text-sm">No matching pages. Try a shorter title.</p>}

      <ul className="nav-tree" data-settled={settled}>
        {roots.map((node) => (
          <Folder key={node.id} node={node} currentHref={currentHref} query={query} collapsed={collapsed} toggle={toggle} openPath={openPath} />
        ))}
      </ul>
    </nav>
  );
}
