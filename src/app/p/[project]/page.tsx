import Link from "@/components/shell/NavigationLink";
import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { getProjectBySlug, getProjectTree, listLearningPaths } from "@/lib/projects";
import { canWrite } from "@/lib/api/context";
import { AppShell } from "@/components/shell/AppShell";
import { Icon, ICONS } from "@/components/shell/icons";
import { SectionManager } from "@/components/documents/SectionManager";
import { LearningPaths } from "@/components/documents/LearningPaths";
import { ProjectProgress, ReadMark } from "@/components/reading/ReadMarks";
import type { NavSection, TocEntry } from "@/components/shell/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  maintenance: "Maintenance",
  archived: "Archived",
  planned: "Planned",
};

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-[22px] font-semibold tracking-[-0.015em] text-heading">
      {children}
    </h2>
  );
}

/** A quiet placeholder that says what the field is for, not what phase it is. */
function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-code border border-dashed border-border-subtle px-4 py-3 text-[13.5px] leading-relaxed text-muted">
      {children}
    </p>
  );
}

function PageRow({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <li>
      <Link href={href} className="page-list-link ease-base transition-colors duration-200 hover:bg-state-hover">
        <span className="page-list-mark">
          <ReadMark href={href} fallback={<Icon path={ICONS.doc} />} />
        </span>
        <span className="page-list-title">{title}</span>
        {description && <span className="page-list-desc">{description}</span>}
      </Link>
    </li>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { project: slug } = await params;
  const workspace = await getWorkspace();
  if (!workspace) redirect("/");

  const project = await getProjectBySlug(workspace.id, slug);
  if (!project) notFound();

  const [tree, learningPaths] = await Promise.all([
    getProjectTree(project.id),
    listLearningPaths(project.id),
  ]);
  const projectHref = `/p/${project.slug}`;
  const editor = canWrite(session.user.role);

  const navSections: NavSection[] = tree.sections.map((section) => ({
    slug: section.slug,
    title: section.title,
    pages: section.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      href: `${projectHref}/${section.slug}/${page.slug}`,
    })),
  }));
  if (tree.loosePages.length > 0) navSections.push({
    slug: "unsectioned", title: "Pages",
    pages: tree.loosePages.map((page) => ({ slug: page.slug, title: page.title, href: `${projectHref}/${page.slug}` })),
  });

  // Reading order: sections in order, then loose pages — same as the sidebar.
  const readingOrder = [
    ...tree.sections.flatMap((section) => section.pages.map((page) => ({
      slug: page.slug, title: page.title, description: page.description, href: `${projectHref}/${section.slug}/${page.slug}`,
    }))),
    ...tree.loosePages.map((page) => ({
      slug: page.slug, title: page.title, description: page.description, href: `${projectHref}/${page.slug}`,
    })),
  ];
  const pageCount = readingOrder.length;

  const toc: TocEntry[] = [
    { id: "pages", text: "Pages", level: 2 },
    { id: "overview", text: "Overview", level: 2 },
    { id: "conventions", text: "Conventions", level: 2 },
    { id: "open-questions", text: "Open questions", level: 2 },
    { id: "learning-paths", text: "Learning paths", level: 2 },
  ];

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const label = "text-[11px] font-semibold tracking-[0.07em] text-muted uppercase";

  return (
    <AppShell
      sections={navSections}
      currentHref={projectHref}
      projectName={project.name}
      projectHref={projectHref}
      toc={toc}
      signOutAction={signOutAction}
      userEmail={session.user.email}
    >
      <article className="doc-panel reader-panel">
        <header>
          <nav aria-label="Breadcrumb" className="reader-crumbs">
            <Link href="/">Library</Link>
            <span aria-hidden>/</span>
            <span>{project.name}</span>
          </nav>
          <h1 className="reader-title">{project.name}</h1>
          <p className="reader-dek">{project.summary}</p>
          <div className="reader-meta">
            <div className="reader-facts">
              <span>{STATUS_LABEL[project.status] ?? project.status}</span>
              {project.version && <span>{project.version}</span>}
              <span>{pageCount === 0 ? "No pages yet" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}</span>
            </div>
          </div>
          <ProjectProgress pages={readingOrder} />
        </header>

        <div className="mt-14 text-[15px] leading-[1.7] text-secondary">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading id="pages">Pages</SectionHeading>
              {editor && <Link href={`/compose/${project.slug}`} className="toolbar-button border-border-subtle">New document</Link>}
            </div>
            {editor && <SectionManager project={project.slug} sections={tree.sections.map((entry) => ({ id: entry.id, slug: entry.slug, title: entry.title, position: entry.position, pageCount: entry.pages.length }))} />}

            {pageCount > 0 ? (
              <div className="stagger mt-5 space-y-7">
                {tree.sections
                  .filter((s) => s.pages.length > 0)
                  .map((section) => (
                    <div key={section.id}>
                      <h3 className={`${label} px-[14px]`}>{section.title}</h3>
                      <ul className="mt-2 space-y-0.5">
                        {section.pages.map((page) => (
                          <PageRow key={page.id} href={`${projectHref}/${section.slug}/${page.slug}`} title={page.title} description={page.description} />
                        ))}
                      </ul>
                    </div>
                  ))}
                {tree.loosePages.length > 0 && (
                  <div>
                    {tree.sections.some((s) => s.pages.length > 0) && <h3 className={`${label} px-[14px]`}>More pages</h3>}
                    <ul className="mt-2 space-y-0.5">
                      {tree.loosePages.map((page) => (
                        <PageRow key={page.id} href={`${projectHref}/${page.slug}`} title={page.title} description={page.description} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-code border border-border-subtle bg-ink/[0.018] px-6 py-8 text-center">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] border border-border-visible bg-ink/[0.03] text-tertiary">
                  <Icon path={ICONS.doc} size={15} />
                </span>
                <p className="mt-3.5 text-[14px] font-medium text-primary">No pages yet</p>
                <p className="mx-auto mt-1.5 max-w-[380px] text-[13.5px] leading-relaxed text-secondary">
                  Guides, standards and system explanations will appear here as your team documents its work.
                </p>
              </div>
            )}
          </section>

          <section className="mt-14">
            <SectionHeading id="overview">Overview</SectionHeading>
            <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className={label}>Identifier</dt>
                <dd className="mt-1.5 text-[14px]"><code className="inline-code">{project.slug}</code></dd>
              </div>
              <div>
                <dt className={label}>Stack</dt>
                <dd className="mt-1.5 text-[14px]">
                  {project.stack.length > 0 ? <span className="text-primary">{project.stack.join(" · ")}</span> : <span className="text-muted">Not recorded</span>}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className={label}>Repository</dt>
                <dd className="mt-1.5 text-[14px] break-all">
                  {project.repositoryUrl ? (
                    <a
                      href={project.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ease-base text-primary underline decoration-ink/20 underline-offset-[3px] transition-colors duration-200 hover:decoration-ink/50"
                    >
                      {project.repositoryUrl.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-muted">Not linked</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Conventions and open questions are the highest-value fields in
              the schema (BUILD.md §4) — shown prominently even when empty. */}
          <section className="mt-14">
            <SectionHeading id="conventions">Conventions</SectionHeading>
            {project.conventions.length > 0 ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] text-body marker:text-muted">
                {project.conventions.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            ) : (
              <EmptyHint>
                Rules anyone working on this project should follow — naming, error formats, units. Recording them here
                stops the same decisions being made twice.
              </EmptyHint>
            )}
          </section>

          <section className="mt-14">
            <SectionHeading id="open-questions">Open questions</SectionHeading>
            {project.openQuestions.length > 0 ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] text-body marker:text-muted">
                {project.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            ) : (
              <EmptyHint>
                Decisions still undecided. Writing them down prevents anyone picking up the project from silently guessing an answer.
              </EmptyHint>
            )}
          </section>

          <LearningPaths project={project.slug} paths={learningPaths} pages={readingOrder} editable={editor} />
        </div>
      </article>
    </AppShell>
  );
}
