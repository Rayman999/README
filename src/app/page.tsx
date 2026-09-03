import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { listProjects } from "@/lib/projects";
import { Header } from "@/components/shell/Header";
import { Icon, ICONS, HEADER_H } from "@/components/shell/icons";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  maintenance: "Maintenance",
  archived: "Archived",
  planned: "Planned",
};

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await getWorkspace();
  const projects = workspace ? await listProjects(workspace.id) : [];
  const canEdit = session.user.role === "owner" || session.user.role === "editor";

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const roots = projects.filter((p) => p.parentId === null);

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />

      <main
        className="mx-auto w-full max-w-[900px] px-6 pb-24"
        style={{ paddingTop: HEADER_H + 48 }}
      >
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-[26px] leading-tight font-semibold text-heading">
              {workspace?.name ?? "Workspace"}
            </h1>
            <p className="mt-1.5 text-[14px] text-secondary">
              {projects.length === 0
                ? "No projects yet."
                : `${projects.length} project${projects.length === 1 ? "" : "s"}.`}{" "}
              Signed in as {session.user.email}
              {session.user.role ? ` · ${session.user.role}` : ""}.
            </p>
          </div>

          {canEdit && (
            <Link
              href="/new"
              className="ease-base flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-border-visible bg-white/[0.035] px-3.5 text-[13px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-white/[0.065] active:translate-y-[1px]"
            >
              <Icon path={ICONS.plus} size={13} />
              New project
            </Link>
          )}
        </div>

        <hr className="my-8 border-0 border-t border-border-subtle" />

        {roots.length === 0 ? (
          <div className="auth-panel px-8 py-12 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[11px] border border-border-visible bg-white/[0.03] text-tertiary">
              <Icon path={ICONS.doc} size={17} />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-primary">
              Nothing documented yet
            </h2>
            <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-secondary">
              A project holds your documentation pages and the context record
              agents read before they start work. Create one to begin.
            </p>
            {canEdit && (
              <Link
                href="/new"
                className="ease-base mt-6 inline-flex h-9 items-center gap-1.5 rounded-control border border-border-visible bg-white/[0.035] px-4 text-[13px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-white/[0.065] active:translate-y-[1px]"
              >
                <Icon path={ICONS.plus} size={13} />
                Create your first project
              </Link>
            )}
          </div>
        ) : (
          <ul className="stagger grid gap-3 sm:grid-cols-2">
            {roots.map((project) => {
              const children = projects.filter(
                (p) => p.parentId === project.id,
              );
              return (
                <li key={project.id}>
                  <Link
                    href={`/p/${project.slug}`}
                    className="ease-base block h-full rounded-code border border-border-subtle bg-white/[0.018] p-4 transition-[background-color,transform] duration-200 hover:-translate-y-[2px] hover:bg-white/[0.035] active:translate-y-0"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-medium text-primary">
                        {project.name}
                      </span>
                      <span className="shrink-0 text-[10.5px] tracking-[0.06em] text-muted uppercase">
                        {STATUS_LABEL[project.status] ?? project.status}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-secondary">
                      {project.summary}
                    </p>
                    {children.length > 0 && (
                      <p className="mt-2.5 text-[11.5px] text-muted">
                        {children.length} sub-project
                        {children.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
