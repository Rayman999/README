"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { NavSection, TocEntry } from "./types";
import { MotionDialog } from "./MotionDialog";
import { Toc } from "./Toc";
import { SidebarNav } from "./SidebarNav";
import { Header } from "./Header";
import { Icon, ICONS, HEADER_H } from "./icons";
import { ReadingRecordsProvider, type PageRecord } from "@/components/reading/ReadingRecords";

// --- shell ----------------------------------------------------------------

const EMPTY_PROGRESS: Record<string, PageRecord> = {};

export function AppShell({
  sections,
  currentHref,
  toc,
  projectName,
  projectHref,
  signOutAction,
  userEmail,
  progress = EMPTY_PROGRESS,
  children,
}: {
  sections: NavSection[];
  currentHref: string;
  toc: TocEntry[];
  projectName?: string;
  projectHref?: string;
  signOutAction?: () => Promise<void>;
  userEmail?: string | null;
  /** This reader's progress through the project's pages, keyed by page id. */
  progress?: Record<string, PageRecord>;
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
    <ReadingRecordsProvider initial={progress}>
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

        {/* Right TOC — the quietest region. Flat on --bg-base. Pages without
            an outline (the project overview) get the width back instead. */}
        {toc.length > 0 && <aside
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
        </aside>}
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
    </ReadingRecordsProvider>
  );
}
