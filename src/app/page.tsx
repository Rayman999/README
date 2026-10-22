import Link from "@/components/shell/NavigationLink";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { listProjectTree } from "@/lib/projects";
import { Header } from "@/components/shell/Header";
import { ProjectLibrary } from "@/components/projects/ProjectLibrary";
import { Icon, ICONS, HEADER_H } from "@/components/shell/icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await getWorkspace();
  const projects = workspace ? await listProjectTree(workspace.id) : [];
  const canEdit = session.user.role === "owner" || session.user.role === "editor";

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  // The library shows top-level projects. Projects inside them are listed on
  // their card, and in full on the project's own page.
  const libraryProjects = projects.filter((project) => project.depth === 0);
  const nested = projects.length - libraryProjects.length;

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />

      <main id="main-content" tabIndex={-1}
        className="mx-auto w-full max-w-[880px] px-6 pb-24"
        style={{ paddingTop: HEADER_H + 56 }}
      >
        <p className="eyebrow">Library</p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[40px] leading-[1.1] font-[650] tracking-[-0.028em] text-heading">
              {workspace?.name ?? "Workspace"}
            </h1>
            <p className="mt-2.5 font-[family-name:var(--font-reading)] text-[17px] text-secondary">
              {projects.length === 0
                ? "Every project's guides, standards and decisions, in one place to read."
                : `${libraryProjects.length} project${libraryProjects.length === 1 ? "" : "s"}${nested ? `, with ${nested} more inside them` : ""}. Pick one to start reading.`}
            </p>
          </div>

          {canEdit && (
            <Link
              href="/new"
              className="ease-base flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-border-visible bg-ink/[0.035] px-3.5 text-[13px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-ink/[0.065] active:translate-y-[1px]"
            >
              <Icon path={ICONS.plus} size={13} />
              New project
            </Link>
          )}
        </div>

        <h2 className="sr-only">Projects</h2>

        {libraryProjects.length === 0 ? (
          <div className="auth-panel mt-10 px-8 py-12 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[11px] border border-border-visible bg-ink/[0.03] text-tertiary">
              <Icon path={ICONS.doc} size={17} />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-primary">
              Nothing documented yet
            </h2>
            <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-secondary">
              A project brings together guides, standards, and decisions that
              your team uses to understand the work.
            </p>
            {canEdit && (
              <Link
                href="/new"
                className="ease-base mt-6 inline-flex h-9 items-center gap-1.5 rounded-control border border-border-visible bg-ink/[0.035] px-4 text-[13px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-ink/[0.065] active:translate-y-[1px]"
              >
                <Icon path={ICONS.plus} size={13} />
                Create your first project
              </Link>
            )}
          </div>
        ) : (
          <ProjectLibrary
            projects={libraryProjects}
            canEdit={canEdit}
            storageKey={`readme:project-favorites:${workspace?.id}:${session.user.id}`}
          />
        )}
      </main>
    </div>
  );
}
