import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { getProjectBySlug, getProjectTree } from "@/lib/projects";
import { canWrite } from "@/lib/api/context";
import { AppShell } from "@/components/shell/AppShell";
import { Icon, ICONS } from "@/components/shell/icons";
import { SectionManager } from "@/components/documents/SectionManager";
import type { NavSection, TocEntry } from "@/components/shell/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  maintenance: "Maintenance",
  archived: "Archived",
  planned: "Planned",
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] border border-border-subtle bg-white/[0.03] px-2 text-[11px] font-medium text-tertiary">
      {children}
    </span>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-[21px] font-semibold text-heading">
      {children}
    </h2>
  );
}

/** A quiet placeholder that says what the field is for, not what phase it is. */
function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-code border border-dashed border-border-subtle px-4 py-3 text-[13px] leading-relaxed text-muted">
      {children}
    </p>
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

  const tree = await getProjectTree(project.id);
  const projectHref = `/p/${project.slug}`;

  const navSections: NavSection[] = tree.sections.map((section) => ({
    slug: section.slug,
    title: section.title,
    pages: section.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      href: `${projectHref}/${section.slug}/${page.slug}`,
    })),
  }));

  const pageCount =
    tree.sections.reduce((n, s) => n + s.pages.length, 0) +
    tree.loosePages.length;

  if (tree.loosePages.length > 0) navSections.push({
    slug: "unsectioned", title: "Pages",
    pages: tree.loosePages.map((page) => ({ slug: page.slug, title: page.title, href: `${projectHref}/${page.slug}` })),
  });

  const toc: TocEntry[] = [
    { id: "overview", text: "Overview", level: 2 },
    { id: "conventions", text: "Conventions", level: 2 },
    { id: "open-questions", text: "Open questions", level: 2 },
    { id: "pages", text: "Pages", level: 2 },
  ];

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

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
      <article className="doc-panel mx-auto w-full max-w-[872px] px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <nav aria-label="Breadcrumb" className="text-[11.5px] text-muted">
          <Link
            href="/"
            className="ease-base transition-colors duration-200 hover:text-tertiary"
          >
            Workspace
          </Link>
          <span className="mx-1.5 opacity-50">/</span>
          <span className="text-tertiary">{project.name}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="text-[32px] leading-[1.15] font-semibold text-heading">
            {project.name}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge>{STATUS_LABEL[project.status] ?? project.status}</Badge>
            {project.version && <Badge>{project.version}</Badge>}
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          {project.summary}
        </p>

        <hr className="my-9 border-0 border-t border-border-subtle" />

        <div className="text-[15px] leading-[1.7] text-secondary">
          <SectionHeading id="overview">Overview</SectionHeading>

          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                Identifier
              </dt>
              <dd className="mt-1.5 text-[13.5px]">
                <code className="inline-code">{project.slug}</code>
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                Pages
              </dt>
              <dd className="mt-1.5 text-[13.5px] text-primary">
                {pageCount === 0
                  ? "None yet"
                  : `${pageCount} page${pageCount === 1 ? "" : "s"}`}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                Stack
              </dt>
              <dd className="mt-1.5 text-[13.5px]">
                {project.stack.length > 0 ? (
                  <span className="text-primary">
                    {project.stack.join(" · ")}
                  </span>
                ) : (
                  <span className="text-muted">Not recorded</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                Repository
              </dt>
              <dd className="mt-1.5 text-[13.5px] break-all">
                {project.repositoryUrl ? (
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ease-base text-primary underline decoration-white/15 underline-offset-2 transition-colors duration-200 hover:decoration-white/40"
                  >
                    {project.repositoryUrl.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-muted">Not linked</span>
                )}
              </dd>
            </div>
          </dl>

          {/* Conventions and open questions are the highest-value fields in
              the schema (BUILD.md §4) — shown prominently even when empty,
              rather than hidden until populated. */}
          <div className="mt-9">
            <SectionHeading id="conventions">Conventions</SectionHeading>
            {project.conventions.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {project.conventions.map((c, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px]">
                    <span
                      aria-hidden
                      className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-white/25"
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint>
                Rules anyone working on this project should follow — naming,
                error formats, units. Recording them here stops the same
                decisions being made twice.
              </EmptyHint>
            )}
          </div>

          <div className="mt-9">
            <SectionHeading id="open-questions">Open questions</SectionHeading>
            {project.openQuestions.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {project.openQuestions.map((q, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px]">
                    <span
                      aria-hidden
                      className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-white/25"
                    />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint>
                Decisions still undecided. Writing them down prevents anyone
                picking up the project from silently guessing an answer.
              </EmptyHint>
            )}
          </div>

          <div className="mt-9">
            <div className="flex flex-wrap items-center justify-between gap-3"><SectionHeading id="pages">Pages</SectionHeading>{canWrite(session.user.role) && <Link href={`/compose/${project.slug}`} className="rounded-control border border-border-visible px-3 py-2 text-[13px] text-primary hover:bg-state-hover">Create document</Link>}</div>
            {canWrite(session.user.role) && <SectionManager project={project.slug} sections={tree.sections.map((entry) => ({ id: entry.id, slug: entry.slug, title: entry.title, position: entry.position, pageCount: entry.pages.length }))} />}

            {pageCount > 0 ? (
              <div className="stagger mt-4 space-y-6">
                {tree.loosePages.length > 0 && <ul className="space-y-2">{tree.loosePages.map((page) => <li key={page.id}><Link href={`${projectHref}/${page.slug}`} className="flex items-baseline gap-3 rounded-control px-2 py-1.5 hover:bg-state-hover"><span className="text-[14px] text-primary">{page.title}</span><span className="truncate text-[12.5px] text-muted">{page.description}</span></Link></li>)}</ul>}
                {tree.sections
                  .filter((s) => s.pages.length > 0)
                  .map((section) => (
                    <div key={section.id}>
                      <h3 className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                        {section.title}
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {section.pages.map((page) => (
                          <li key={page.id}>
                            <Link
                              href={`${projectHref}/${section.slug}/${page.slug}`}
                              className="ease-base group flex items-baseline gap-3 rounded-control px-2 py-1.5 transition-colors duration-200 hover:bg-state-hover"
                            >
                              <span className="text-[14px] text-primary">
                                {page.title}
                              </span>
                              <span className="truncate text-[12.5px] text-muted">
                                {page.description}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="mt-4 rounded-code border border-border-subtle bg-white/[0.018] px-6 py-8 text-center">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] border border-border-visible bg-white/[0.03] text-tertiary">
                  <Icon path={ICONS.doc} size={15} />
                </span>
                <p className="mt-3.5 text-[14px] font-medium text-primary">
                  No pages yet
                </p>
                <p className="mx-auto mt-1.5 max-w-[380px] text-[13px] leading-relaxed text-secondary">
                  Create a structured document with themed cards, charts, and
                  tables. Existing Markdown pages continue to work.
                </p>
              </div>
            )}
          </div>
        </div>
      </article>
    </AppShell>
  );
}
