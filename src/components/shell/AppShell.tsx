"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "@/components/shell/NavigationLink";
import type { NavSection, TocEntry } from "./types";
import { MotionDialog } from "./MotionDialog";
import { Toc } from "./Toc";
import { Header } from "./Header";
import { Icon, ICONS, HEADER_H } from "./icons";
import { ReadMark } from "@/components/reading/ReadMarks";

// --- left navigation ------------------------------------------------------

function SidebarNav({
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

  // Persist expand/collapse across navigations.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("readme:nav");
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* storage unavailable — fall back to all expanded */
    }
  }, []);

  const toggle = (slug: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [slug]: !prev[slug] };
      try {
        localStorage.setItem("readme:nav", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <nav aria-label="Documentation" className="pr-2">
      {/* Orientation: which project this is, and the way back out. */}
      <Link
        href="/"
        className="ease-base mb-4 flex items-center gap-1.5 px-2 text-[11.5px] text-muted transition-colors duration-200 hover:text-secondary"
      >
        <span className="inline-flex rotate-180">
          <Icon path={ICONS.chevron} size={10} />
        </span>
        All projects
      </Link>

      {projectName && (
        <Link
          href={projectHref ?? "#"}
          className={`ease-base mb-4 flex h-[31px] items-center gap-2 rounded-control px-2 text-[13.5px] font-medium transition-colors duration-200 ${
            currentHref === projectHref
              ? "bg-state-selected text-primary"
              : "text-secondary hover:bg-state-hover hover:text-primary"
          }`}
        >
          <span className="text-muted">
            <Icon path={ICONS.book} />
          </span>
          <span className="truncate">{projectName}</span>
        </Link>
      )}

      {sections.length === 0 && (
        <p className="px-2 text-[12.5px] leading-relaxed text-muted">
          No pages yet. Pages you add will appear here, grouped by section.
        </p>
      )}

      <label className="nav-filter">Find a page
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter page titles…" />
      </label>
      {query && !sections.some(s => s.pages.some(p => p.title.toLowerCase().includes(query.toLowerCase()))) && <p role="status" className="px-2 text-sm">No matching pages. Try a shorter title.</p>}
      {sections.map((section) => {
        const pages = section.pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase()));
        if (query && !pages.length) return null;
        const isCollapsed = !query && (collapsed[section.slug] ?? false);
        return (
          <div key={section.slug} className="mb-5">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => toggle(section.slug)}
              className="ease-base flex w-full items-center gap-1.5 rounded-control px-2 py-1 text-[11px] font-medium tracking-[0.06em] text-muted uppercase transition-colors duration-200 hover:text-tertiary"
            >
              <span
                className="ease-base inline-flex transition-transform duration-200"
                style={{
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                }}
              >
                <Icon path={ICONS.chevron} size={10} />
              </span>
              {section.title}
            </button>

            <div className="nav-collapse" data-open={!isCollapsed} inert={isCollapsed}>
              <div className="nav-collapse-inner"><ul className="mt-1">
                {pages.map((page) => {
                  const active = page.href === currentHref;
                  return (
                    <li key={page.slug}>
                      <Link
                        href={page.href}
                        aria-current={active ? "page" : undefined}
                        className={`ease-base relative flex h-[31px] items-center gap-2 rounded-control pr-2 pl-2 text-[13.5px] transition-colors duration-200 ${
                          active
                            ? "bg-state-selected text-primary"
                            : "text-secondary hover:bg-state-hover hover:text-primary"
                        }`}
                      >
                        {active && <span aria-hidden className="nav-indicator" />}
                        <span
                          className={`inline-flex w-[14px] shrink-0 justify-center ${active ? "text-tertiary" : "text-muted"}`}
                        >
                          <ReadMark href={page.href} fallback={<Icon path={ICONS.doc} />} />
                        </span>
                        <span className="truncate">{page.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul></div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// --- shell ----------------------------------------------------------------

export function AppShell({
  sections,
  currentHref,
  toc,
  projectName,
  projectHref,
  signOutAction,
  userEmail,
  children,
}: {
  sections: NavSection[];
  currentHref: string;
  toc: TocEntry[];
  projectName?: string;
  projectHref?: string;
  signOutAction?: () => Promise<void>;
  userEmail?: string | null;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setDrawerOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="min-h-screen bg-base">
      <Header
        onMenu={() => setDrawerOpen(true)}
        signOutAction={signOutAction}
        userEmail={userEmail}
      />

      <div
        className="mx-auto flex w-full max-w-[1600px]"
        style={{ paddingTop: HEADER_H }}
      >
        {/* Left nav — flat, carved into the shell. No card, no background. */}
        <aside
          className="reading-rail hidden shrink-0 py-8 pr-2 pl-5 lg:block"
          style={{
            width: 272,
            position: "sticky",
            top: HEADER_H,
            height: `calc(100vh - ${HEADER_H}px)`,
            overflowY: "auto",
          }}
        >
          <SidebarNav
            sections={sections}
            currentHref={currentHref}
            projectName={projectName}
            projectHref={projectHref}
          />
        </aside>

        {/* Content column — the only elevated object on screen. */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-5 py-8 lg:px-8">{children}</main>

        {/* Right TOC — the quietest region. Flat on --bg-base. */}
        <aside
          className="reading-rail hidden shrink-0 py-8 pr-5 pl-3 xl:block"
          style={{
            width: 232,
            position: "sticky",
            top: HEADER_H,
            height: `calc(100vh - ${HEADER_H}px)`,
            overflowY: "auto",
          }}
        >
          <Toc entries={toc} />
        </aside>
      </div>

      {/* Mobile drawer */}
      <MotionDialog open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"
          className="mb-4 rounded-control p-2 text-muted hover:bg-state-hover hover:text-primary">
          <Icon path={ICONS.close} size={16} />
        </button>
        <SidebarNav sections={sections} currentHref={currentHref}
          projectName={projectName} projectHref={projectHref} />
      </MotionDialog>
    </div>
  );
}
