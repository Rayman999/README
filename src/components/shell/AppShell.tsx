"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { NavSection, TocEntry } from "./types";
import { Toc } from "./Toc";
import { Header } from "./Header";
import { Icon, ICONS, HEADER_H } from "./icons";

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

      {sections.map((section) => {
        const isCollapsed = collapsed[section.slug] ?? false;
        return (
          <div key={section.slug} className="mb-5">
            <button
              type="button"
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

            {!isCollapsed && (
              <ul className="mt-1">
                {section.pages.map((page) => {
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
                        {active && (
                          <span
                            aria-hidden
                            className="absolute top-[7px] bottom-[7px] left-0 w-[2px] rounded-full"
                            style={{ background: "rgba(255,255,255,0.25)" }}
                          />
                        )}
                        <span
                          className={active ? "text-tertiary" : "text-muted"}
                        >
                          <Icon path={ICONS.doc} />
                        </span>
                        <span className="truncate">{page.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          className="hidden shrink-0 py-8 pr-2 pl-5 lg:block"
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
        <main className="min-w-0 flex-1 px-5 py-8 lg:px-8">{children}</main>

        {/* Right TOC — the quietest region. Flat on --bg-base. */}
        <aside
          className="hidden shrink-0 py-8 pr-5 pl-3 xl:block"
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
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto border-r border-border-faint bg-base px-5 py-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="ease-base mb-4 rounded-control p-1.5 text-muted transition-colors duration-200 hover:bg-state-hover hover:text-primary"
            >
              <Icon path={ICONS.close} size={16} />
            </button>
            <SidebarNav
            sections={sections}
            currentHref={currentHref}
            projectName={projectName}
            projectHref={projectHref}
          />
          </div>
        </div>
      )}
    </div>
  );
}
