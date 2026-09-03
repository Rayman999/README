import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import {
  getPageBySlug,
  getPageNeighbours,
  getProjectBySlug,
  getProjectTree,
  getSectionById,
} from "@/lib/projects";
import { renderMarkdown } from "@/lib/markdown/render";
import { AppShell } from "@/components/shell/AppShell";
import type { NavSection, TocEntry } from "@/components/shell/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  stable: "Stable",
  deprecated: "Deprecated",
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] border border-border-subtle bg-white/[0.03] px-2 text-[11px] font-medium text-tertiary">
      {children}
    </span>
  );
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

  const [tree, { html, headings }, neighbours] = await Promise.all([
    getProjectTree(project.id),
    renderMarkdown(page.body),
    getPageNeighbours(project.id, page.id),
  ]);

  const navSections: NavSection[] = tree.sections.map((s) => ({
    slug: s.slug,
    title: s.title,
    pages: s.pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      href: `${projectHref}/${s.slug}/${p.slug}`,
    })),
  }));

  const toc: TocEntry[] = headings.map((h) => ({
    id: h.id,
    text: h.text,
    level: h.level,
  }));

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const neighbourHref = (p: { slug: string; sectionId: string | null }) => {
    const s = tree.sections.find((sec) => sec.id === p.sectionId);
    return s ? `${projectHref}/${s.slug}/${p.slug}` : `${projectHref}/${p.slug}`;
  };

  return (
    <AppShell
      sections={navSections}
      currentHref={canonicalHref}
      projectName={project.name}
      projectHref={projectHref}
      toc={toc}
      signOutAction={signOutAction}
      userEmail={session.user.email}
    >
      <article className="doc-panel mx-auto w-full max-w-[872px] px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <nav aria-label="Breadcrumb" className="text-[11.5px] text-muted">
          <Link
            href="/"
            className="ease-base transition-colors duration-200 hover:text-tertiary"
          >
            Workspace
          </Link>
          <span className="mx-1.5 opacity-50">/</span>
          <Link
            href={projectHref}
            className="ease-base transition-colors duration-200 hover:text-tertiary"
          >
            {project.name}
          </Link>
          {section && (
            <>
              <span className="mx-1.5 opacity-50">/</span>
              <span className="text-tertiary">{section.title}</span>
            </>
          )}
          <span className="mx-1.5 opacity-50">/</span>
          <span className="text-tertiary">{page.title}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="text-[32px] leading-[1.15] font-semibold text-heading">
            {page.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge>{STATUS_LABEL[page.status] ?? page.status}</Badge>
            {page.authorType === "agent" && <Badge>Written by an agent</Badge>}
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          {page.description}
        </p>

        <hr className="my-9 border-0 border-t border-border-subtle" />

        <div className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />

        {(neighbours.previous || neighbours.next) && (
          <div className="mt-12 grid grid-cols-1 gap-3 border-t border-border-subtle pt-8 sm:grid-cols-2">
            {neighbours.previous ? (
              <Link
                href={neighbourHref(neighbours.previous)}
                className="ease-base group rounded-control border border-border-faint px-4 py-3 transition-colors duration-200 hover:border-border-visible hover:bg-state-hover"
              >
                <span className="block text-[11px] text-secondary">Previous</span>
                <span className="mt-1 block text-[13.5px] font-medium text-primary">
                  {neighbours.previous.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {neighbours.next && (
              <Link
                href={neighbourHref(neighbours.next)}
                className="ease-base group rounded-control border border-border-faint px-4 py-3 text-right transition-colors duration-200 hover:border-border-visible hover:bg-state-hover"
              >
                <span className="block text-[11px] text-secondary">Next</span>
                <span className="mt-1 block text-[13.5px] font-medium text-primary">
                  {neighbours.next.title}
                </span>
              </Link>
            )}
          </div>
        )}
      </article>
    </AppShell>
  );
}
