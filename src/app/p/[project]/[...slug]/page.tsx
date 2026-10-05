import Link from "@/components/shell/NavigationLink";
import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import {
  getPageBySlug,
  getProjectBySlug,
  getProjectTree,
  getSectionById,
} from "@/lib/projects";
import { renderMarkdown } from "@/lib/markdown/render";
import { documentHeadings, type ReadmeDocument } from "@/lib/documents/schema";
import { DocumentRenderer } from "@/components/documents/DocumentRenderer";
import { PageActions } from "@/components/documents/PageActions";
import { PageHistory } from "@/components/documents/PageHistory";
import { FocusToggle, SkimToggle } from "@/components/reading/ReadingPreferences";
import { Highlights } from "@/components/reading/Highlights";
import { getProgressForProject, listHighlightsForPage } from "@/lib/reading/server";
import { CompletionNote, ReaderRuntime } from "@/components/reading/ReaderRuntime";
import { InlineOutline } from "@/components/shell/Toc";
import { canWrite } from "@/lib/api/context";
import { AppShell } from "@/components/shell/AppShell";
import type { NavSection, TocEntry } from "@/components/shell/types";

export const dynamic = "force-dynamic";

const WORDS_PER_MINUTE = 230;

/** Every human-readable string in a structured document, for reading time. */
function documentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(documentText).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !["type", "id", "tone", "role", "variant", "direction", "level", "from", "to"].includes(key))
      .map(([, inner]) => documentText(inner))
      .join(" ");
  }
  return "";
}

function readingMinutes(body: string, document: ReadmeDocument | null) {
  const text = document ? documentText(document.blocks) : body;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ project: string; slug: string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { project: projectSlug, slug: segments } = await params;
  if (segments.length < 1 || segments.length > 2) notFound();

  const workspace = await getWorkspace();
  if (!workspace) redirect("/");

  const project = await getProjectBySlug(workspace.id, projectSlug);
  if (!project) notFound();

  // Pages are addressed by (project, slug) alone — slug is unique per
  // project regardless of section (BUILD.md §4). The last segment is always
  // the page; a leading section segment, if present, is validated against
  // the page's actual section and only used to keep the URL canonical.
  const pageSlug = segments[segments.length - 1];
  const sectionSlugInUrl = segments.length === 2 ? segments[0] : null;

  const page = await getPageBySlug(project.id, pageSlug);
  if (!page) notFound();

  const projectHref = `/p/${project.slug}`;
  const section = page.sectionId ? await getSectionById(page.sectionId) : null;

  // Canonicalise: a loose page hit with a section segment, a sectioned page
  // hit without one, or hit under the wrong section all redirect rather
  // than silently rendering under the wrong breadcrumb.
  const canonicalHref = section
    ? `${projectHref}/${section.slug}/${page.slug}`
    : `${projectHref}/${page.slug}`;
  if (sectionSlugInUrl !== (section?.slug ?? null)) {
    redirect(canonicalHref);
  }

  const userId = session.user.id!;
  const [tree, { html, headings }, progress, highlights] = await Promise.all([
    getProjectTree(project.id),
    page.document ? Promise.resolve({ html: "", headings: documentHeadings(page.document) }) : renderMarkdown(page.body),
    getProgressForProject(userId, project.id),
    listHighlightsForPage(userId, page.id),
  ]);

  const navSections: NavSection[] = tree.sections.map((s) => ({
    slug: s.slug,
    title: s.title,
    pages: s.pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      href: `${projectHref}/${s.slug}/${p.slug}`,
    })),
  }));
  if (tree.loosePages.length > 0) navSections.push({
    slug: "unsectioned", title: "Pages",
    pages: tree.loosePages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, href: `${projectHref}/${p.slug}` })),
  });

  const toc: TocEntry[] = headings.map((h) => ({ id: h.id, text: h.text, level: h.level }));

  // Reading order is the sidebar order, so "next" is always what a reader
  // working through the project would expect.
  const ordered = [
    ...tree.sections.flatMap((s) => s.pages.map((p) => ({ ...p, href: `${projectHref}/${s.slug}/${p.slug}`, sectionTitle: s.title }))),
    ...tree.loosePages.map((p) => ({ ...p, href: `${projectHref}/${p.slug}`, sectionTitle: null as string | null })),
  ];
  const index = ordered.findIndex((p) => p.id === page.id);
  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  const minutes = readingMinutes(page.body, page.document);
  const editor = canWrite(session.user.role);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AppShell
      sections={navSections}
      currentHref={canonicalHref}
      projectName={project.name}
      projectHref={projectHref}
      toc={toc}
      signOutAction={signOutAction}
      userEmail={session.user.email}
      progress={progress}
    >
      <ReaderRuntime
        key={page.id}
        pageId={page.id}
        minutes={minutes}
        previousHref={previous?.href}
        nextHref={next?.href}
      />
      <article className="doc-panel reader-panel">
        <header>
          <nav aria-label="Breadcrumb" className="reader-crumbs">
            <Link href={projectHref}>{project.name}</Link>
            {section && (
              <>
                <span aria-hidden>/</span>
                <span>{section.title}</span>
              </>
            )}
          </nav>

          <h1 className="reader-title">{page.title}</h1>
          {page.description && <p className="reader-dek">{page.description}</p>}

          <div className="reader-meta">
            <div className="reader-facts">
              <span>{minutes} min read</span>
              {/* How current a page is is the first thing a reader needs to know about documentation. */}
              <time dateTime={page.updatedAt.toISOString()}>
                Updated {page.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </time>
              {page.status !== "stable" && (
                <span><span className="chip" data-tone="warn">{page.status === "draft" ? "Draft" : "Deprecated"}</span></span>
              )}
              {page.authorType === "agent" && <span>Written by an agent</span>}
            </div>
            <div className="reader-tools">
              <SkimToggle />
              <FocusToggle />
              <PageHistory project={project.slug} page={page.slug} />
              {editor && (
                <Link href={`/compose/${project.slug}?page=${page.slug}`} className="toolbar-button">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10.5 2.5l3 3-8 8h-3v-3z" />
                  </svg>
                  Edit
                </Link>
              )}
            </div>
          </div>

          {page.status !== "stable" && (
            <p className="document-status" role="note">
              {page.status === "draft" ? (
                <><strong>Draft.</strong> This page is still being reviewed. Confirm details before relying on them.</>
              ) : (
                <><strong>Deprecated.</strong> This guidance may be out of date. Check with the project team before using it.</>
              )}
            </p>
          )}

          <InlineOutline entries={toc} />
        </header>

        <div className="reading-content">
          {page.document ? (
            <DocumentRenderer document={page.document} />
          ) : (
            <div className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>

        <Highlights key={page.id} pageId={page.id} initial={highlights} />

        <footer className="reader-end">
          <CompletionNote pageId={page.id} />
          {next ? (
            <Link href={next.href} className="up-next">
              <span className="up-next-label">
                Up next{next.sectionTitle && next.sectionTitle !== section?.title ? ` · ${next.sectionTitle}` : ""}
                <kbd aria-hidden>]</kbd>
              </span>
              <span className="up-next-title">{next.title}</span>
              {next.description && <span className="up-next-desc">{next.description}</span>}
              <span aria-hidden className="up-next-arrow">→</span>
            </Link>
          ) : (
            <Link href={projectHref} className="up-next">
              <span className="up-next-label">You&rsquo;ve reached the end of {project.name}</span>
              <span className="up-next-title">Back to the project overview</span>
              <span aria-hidden className="up-next-arrow">→</span>
            </Link>
          )}
          {previous && (
            <nav className="reader-pager" aria-label="Previous page">
              <Link href={previous.href}>
                <span aria-hidden>←</span> {previous.title}
              </Link>
            </nav>
          )}
        </footer>

        {editor && (
          <details className="page-manage">
            <summary>Page settings</summary>
            <PageActions project={project.slug} page={page.slug} status={page.status} version={page.version} editable projectHref={projectHref} />
          </details>
        )}
      </article>
    </AppShell>
  );
}
