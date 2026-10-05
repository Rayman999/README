import Link from "@/components/shell/NavigationLink";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { listAllHighlights } from "@/lib/reading/server";
import { Header } from "@/components/shell/Header";
import { HEADER_H } from "@/components/shell/icons";

export const dynamic = "force-dynamic";

export default async function HighlightsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspace = await getWorkspace();
  const rows = workspace ? await listAllHighlights(session.user.id, workspace.id) : [];

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  // Group project → page, keeping the newest activity first.
  const projects = new Map<string, { name: string; slug: string; pages: Map<string, { title: string; href: string; items: typeof rows }> }>();
  for (const row of rows) {
    const project = projects.get(row.projectSlug) ?? { name: row.projectName, slug: row.projectSlug, pages: new Map() };
    projects.set(row.projectSlug, project);
    const href = `/p/${row.projectSlug}/${row.sectionSlug ? `${row.sectionSlug}/` : ""}${row.pageSlug}`;
    const page = project.pages.get(href) ?? { title: row.pageTitle, href, items: [] };
    project.pages.set(href, page);
    page.items.push(row);
  }
  const notes = rows.filter((row) => row.note).length;

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[760px] px-6 pb-24" style={{ paddingTop: HEADER_H + 56 }}>
        <p className="eyebrow">Your reading</p>
        <h1 className="text-[40px] leading-[1.1] font-[650] tracking-[-0.028em] text-heading">Highlights</h1>
        <p className="mt-2.5 font-[family-name:var(--font-reading)] text-[17px] text-secondary">
          {rows.length === 0
            ? "Select any text while reading and choose Highlight. Everything you mark collects here."
            : `${rows.length} highlight${rows.length === 1 ? "" : "s"}${notes ? `, ${notes} with notes` : ""}. Only you can see these.`}
        </p>

        <div className="mt-12 grid gap-14">
          {[...projects.values()].map((project) => (
            <section key={project.slug} aria-labelledby={`hl-${project.slug}`}>
              <h2 id={`hl-${project.slug}`} className="eyebrow">{project.name}</h2>
              <div className="grid gap-9">
                {[...project.pages.values()].map((page) => (
                  <article key={page.href}>
                    <Link href={page.href} className="hl-page-title">{page.title} <span aria-hidden>→</span></Link>
                    <ol className="hl-list">
                      {page.items.map((item) => (
                        <li key={item.id}>
                          <blockquote>{item.quote}</blockquote>
                          {item.note && <p className="hl-list-note">{item.note}</p>}
                          <time dateTime={item.createdAt.toISOString()}>
                            {item.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
