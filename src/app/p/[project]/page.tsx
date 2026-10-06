import Link from "@/components/shell/NavigationLink";
import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { getProjectBySlug, getProjectTree, listLearningPaths } from "@/lib/projects";
import { getProjectOverviewData } from "@/lib/project-overview";
import { getProgressForProject } from "@/lib/reading/server";
import { canWrite } from "@/lib/api/context";
import { AppShell } from "@/components/shell/AppShell";
import { Icon, ICONS } from "@/components/shell/icons";
import { SectionManager } from "@/components/documents/SectionManager";
import { LearningPaths } from "@/components/documents/LearningPaths";
import { ReadMark } from "@/components/reading/ReadMarks";
import { ChapterProgress, ReadingMap, StartCard, type OverviewPage, type OverviewSection } from "@/components/projects/Overview";
import { formatMinutes } from "@/lib/reading/format";
import { OverviewEditor } from "@/components/projects/OverviewEditor";
import type { NavSection } from "@/components/shell/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  maintenance: "Maintenance",
  archived: "Archived",
  planned: "Planned",
};

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(date: Date) {
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days > -1) return "today";
  if (days > -30) return relative.format(days, "day");
  if (days > -365) return relative.format(Math.round(days / 30), "month");
  return relative.format(Math.round(days / 365), "year");
}

function PageRow({ page, badge }: { page: OverviewPage; badge?: string }) {
  return (
    <li>
      <Link href={page.href} className="ov-page">
        <span className="ov-page-mark">
          <ReadMark pageId={page.id} fallback={<Icon path={ICONS.doc} />} />
        </span>
        <span className="ov-page-title">
          {page.title}
          {badge && <span className="ov-badge">{badge}</span>}
        </span>
        <span className="ov-page-minutes">{page.minutes} min</span>
        {page.description && <span className="ov-page-desc">{page.description}</span>}
      </Link>
    </li>
  );
}

function Panel({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <section className="ov-panel">
      <h2 className="ov-panel-title">
        {title}
        {count !== undefined && <span>{count}</span>}
      </h2>
      {children}
    </section>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project: slug } = await params;
  const workspace = await getWorkspace();
  if (!workspace) redirect("/");

  const project = await getProjectBySlug(workspace.id, slug);
  if (!project) notFound();

  const [tree, learningPaths, overview, progress] = await Promise.all([
    getProjectTree(project.id),
    listLearningPaths(project.id),
    getProjectOverviewData(project),
    getProgressForProject(session.user.id, project.id),
  ]);
  const projectHref = `/p/${project.slug}`;
  const editor = canWrite(session.user.role);

  const toPage = (page: (typeof tree.loosePages)[number], href: string): OverviewPage => ({
    id: page.id,
    slug: page.slug,
    href,
    title: page.title,
    description: page.description,
    minutes: overview.pageStats[page.id]?.minutes ?? 1,
  });

  // Sections are the project's chapters, in order; loose pages close the book.
  const chapters: OverviewSection[] = [
    ...tree.sections.map((section) => ({
      id: section.id,
      slug: section.slug,
      title: section.title,
      description: section.description,
      pages: section.pages.map((page) => toPage(page, `${projectHref}/${section.slug}/${page.slug}`)),
    })),
    ...(tree.loosePages.length
      ? [{ id: "loose", slug: "more", title: tree.sections.length ? "More pages" : "Pages", description: "", pages: tree.loosePages.map((page) => toPage(page, `${projectHref}/${page.slug}`)) }]
      : []),
  ];
  const readingOrder = chapters.flatMap((chapter) => chapter.pages);
  const allMeta = [...tree.sections.flatMap((s) => s.pages), ...tree.loosePages];

  const navSections: NavSection[] = chapters.map((chapter) => ({
    slug: chapter.slug,
    title: chapter.title,
    description: chapter.description,
    pages: chapter.pages.map((page) => ({ id: page.id, slug: page.href, title: page.title, href: page.href })),
  }));

  // "New since your last visit": pages changed after this reader last read
  // them, and pages added since their most recent visit to the project.
  const visits = Object.values(progress).map((record) => record.at);
  const lastVisit = visits.length ? Math.max(...visits) : null;
  type Change = { page: OverviewPage; kind: "New" | "Updated" };
  const changes: Change[] = lastVisit === null ? [] : allMeta.flatMap((meta): Change[] => {
    const page = readingOrder.find((entry) => entry.id === meta.id)!;
    const record = progress[meta.id];
    if (record && meta.updatedAt.getTime() > record.at + 60_000) return [{ page, kind: "Updated" }];
    const created = overview.pageStats[meta.id]?.createdAt;
    if (!record && created && created.getTime() > lastVisit) return [{ page, kind: "New" }];
    return [];
  });
  const changed = new Map(changes.map((change) => [change.page.id, change.kind]));

  const totalMinutes = readingOrder.reduce((sum, page) => sum + page.minutes, 0);
  const lastUpdated = allMeta.reduce((latest, meta) => (meta.updatedAt > latest ? meta.updatedAt : latest), project.updatedAt);
  const glossary = Object.entries(project.glossary ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const missing = [
    ...(glossary.length ? [] : ["a glossary"]),
    ...(project.entrypoints.length ? [] : ["where the code starts"]),
    ...(project.conventions.length ? [] : ["house rules"]),
  ];
  const details = {
    summary: project.summary,
    stack: project.stack,
    repositoryUrl: project.repositoryUrl,
    entrypoints: project.entrypoints,
    conventions: project.conventions,
    openQuestions: project.openQuestions,
    glossary: project.glossary ?? {},
  };
  const neighbours = [
    ...(overview.parent ? [{ ...overview.parent, relation: "Part of" }] : []),
    ...overview.children.map((child) => ({ ...child, relation: "Sub-project" })),
    ...overview.related.map((entry) => ({ ...entry, relation: "Related" })),
  ];

  const hasSide = glossary.length > 0 || project.entrypoints.length > 0 || project.conventions.length > 0
    || project.openQuestions.length > 0 || neighbours.length > 0 || (editor && missing.length > 0);

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
      toc={[]}
      signOutAction={signOutAction}
      userEmail={session.user.email}
      progress={progress}
    >
      <div className="overview">
        {/* Cover */}
        <header className="ov-cover">
          <div className="ov-cover-text">
            <nav aria-label="Breadcrumb" className="reader-crumbs">
              <Link href="/">Library</Link>
              <span aria-hidden>/</span>
              <span>{project.name}</span>
            </nav>
            <p className="ov-kicker">
              <span className="ov-status" data-status={project.status}>{STATUS_LABEL[project.status] ?? project.status}</span>
              {project.version && <span>{project.version}</span>}
            </p>
            <h1 className="ov-title">{project.name}</h1>
            <p className="ov-summary">{project.summary}</p>
            {(project.stack.length > 0 || project.repositoryUrl || editor) && (
              <div className="ov-chips">
                {project.stack.map((item) => <span key={item} className="ov-chip">{item}</span>)}
                {project.repositoryUrl && (
                  <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="ov-chip ov-chip-link">
                    {project.repositoryUrl.replace(/^https?:\/\/(www\.)?/, "")} ↗
                  </a>
                )}
                {editor && <OverviewEditor project={project.slug} details={details} />}
              </div>
            )}
          </div>
          <StartCard pages={readingOrder} />
        </header>

        {/* Stats: only the ones that say something about this project. */}
        <dl className="ov-stats">
          <div><dt>Pages</dt><dd>{readingOrder.length}</dd></div>
          <div><dt>To read it all</dt><dd>{formatMinutes(totalMinutes)}</dd></div>
          {tree.sections.length > 0 && <div><dt>Sections</dt><dd>{tree.sections.length}</dd></div>}
          <div><dt>Last updated</dt><dd>{ago(lastUpdated)}</dd></div>
          {(overview.contributors.people > 0 || overview.contributors.agentEdits > 0) && (
            <div>
              <dt>Contributors</dt>
              <dd>
                {overview.contributors.people > 0 ? `${overview.contributors.people} ${overview.contributors.people === 1 ? "person" : "people"}` : ""}
                {overview.contributors.agentEdits > 0 && <small>{overview.contributors.people > 0 ? " + " : ""}{overview.contributors.agentEdits} agent edit{overview.contributors.agentEdits === 1 ? "" : "s"}</small>}
              </dd>
            </div>
          )}
        </dl>

        {changes.length > 0 && (
          <section className="ov-changes" aria-labelledby="ov-changes-title">
            <h2 id="ov-changes-title">
              <span className="ov-pulse" aria-hidden />
              New since your last visit
            </h2>
            <ul>
              {changes.slice(0, 6).map(({ page, kind }) => (
                <li key={page.id}>
                  <Link href={page.href}>
                    <span className="ov-badge">{kind}</span>
                    <span className="ov-changes-title">{page.title}</span>
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="ov-body" data-side={hasSide}>
          <div className="ov-main">
            <div className="ov-contents-head">
              <h2 id="contents">Contents</h2>
              {editor && <Link href={`/compose/${project.slug}`} className="toolbar-button">+ New document</Link>}
            </div>
            <ReadingMap sections={chapters} />

            {readingOrder.length === 0 ? (
              <div className="ov-empty">
                <Icon path={ICONS.doc} size={16} />
                <p>No pages yet. Guides, standards and system explanations will appear here as the team documents its work.</p>
              </div>
            ) : tree.sections.length === 0 ? (
              // No sections: one plain list, not a lone numbered chapter.
              <ul className="ov-pages-flat">
                {readingOrder.map((page) => <PageRow key={page.id} page={page} badge={changed.get(page.id)} />)}
              </ul>
            ) : (
              <ol className="ov-chapters">
                {chapters.filter((chapter) => chapter.pages.length > 0).map((chapter, index) => (
                  <li key={chapter.id} id={`chapter-${chapter.slug}`} className="ov-chapter">
                    <header>
                      <span className="ov-chapter-index" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                      <h3>{chapter.title}</h3>
                      <ChapterProgress pages={chapter.pages} />
                      {chapter.description && <p className="ov-chapter-purpose">{chapter.description}</p>}
                    </header>
                    <ul>
                      {chapter.pages.map((page) => <PageRow key={page.id} page={page} badge={changed.get(page.id)} />)}
                    </ul>
                  </li>
                ))}
              </ol>
            )}

            {editor && (
              <div className="ov-organise">
                <SectionManager project={project.slug} sections={tree.sections.map((entry) => ({ id: entry.id, slug: entry.slug, title: entry.title, description: entry.description, position: entry.position, pageCount: entry.pages.length }))} />
              </div>
            )}

            {(learningPaths.length > 0 || editor) && (
              <div className="ov-paths">
                <LearningPaths project={project.slug} paths={learningPaths} pages={readingOrder} editable={editor} />
              </div>
            )}
          </div>

          {hasSide && (
            <aside className="ov-side" aria-label="Project reference">
              {glossary.length > 0 && (
                <Panel title="Glossary" count={glossary.length}>
                  <dl className="ov-glossary">
                    {glossary.slice(0, 8).map(([term, meaning]) => (
                      <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>
                    ))}
                  </dl>
                  {glossary.length > 8 && (
                    <details className="ov-more">
                      <summary>All {glossary.length} terms</summary>
                      <dl className="ov-glossary">
                        {glossary.slice(8).map(([term, meaning]) => (
                          <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>
                        ))}
                      </dl>
                    </details>
                  )}
                </Panel>
              )}

              {project.entrypoints.length > 0 && (
                <Panel title="Where the code starts">
                  <ul className="ov-entry">
                    {project.entrypoints.map((entry) => <li key={entry}><code>{entry}</code></li>)}
                  </ul>
                </Panel>
              )}

              {project.conventions.length > 0 && (
                <Panel title="House rules" count={project.conventions.length}>
                  <ul className="ov-list">{project.conventions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </Panel>
              )}

              {project.openQuestions.length > 0 && (
                <Panel title="Still undecided" count={project.openQuestions.length}>
                  <ul className="ov-list">{project.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </Panel>
              )}

              {neighbours.length > 0 && (
                <Panel title="Connected projects">
                  <ul className="ov-neighbours">
                    {neighbours.map((entry) => (
                      <li key={`${entry.relation}-${entry.slug}`}>
                        <Link href={`/p/${entry.slug}`}>
                          <span className="ov-neighbour-relation">{entry.relation}</span>
                          <span className="ov-neighbour-name">{entry.name}</span>
                          <span className="ov-neighbour-summary">{entry.summary}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {editor && missing.length > 0 && (
                <section className="ov-panel ov-panel-todo">
                  <h2 className="ov-panel-title">Help newcomers</h2>
                  <p className="ov-hint">
                    Still missing: {missing.join(", ")}. These panels appear for readers once they have content.
                  </p>
                  <OverviewEditor project={project.slug} details={details} />
                </section>
              )}
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}
