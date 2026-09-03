import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { listTopLevelProjects } from "@/lib/projects";
import { Header } from "@/components/shell/Header";
import { HEADER_H } from "@/components/shell/icons";
import { NewProjectForm } from "./NewProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canEdit = session.user.role === "owner" || session.user.role === "editor";
  if (!canEdit) redirect("/");

  const workspace = await getWorkspace();
  const parents = workspace ? await listTopLevelProjects(workspace.id) : [];

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />

      <main
        className="mx-auto w-full max-w-[600px] px-6 pb-24"
        style={{ paddingTop: HEADER_H + 48 }}
      >
        <nav aria-label="Breadcrumb" className="text-[11.5px] text-muted">
          <Link href="/" className="ease-base transition-colors duration-200 hover:text-tertiary">
            Workspace
          </Link>
          <span className="mx-1.5 opacity-50">/</span>
          <span>New project</span>
        </nav>

        <h1 className="mt-3 text-[24px] leading-tight font-semibold text-heading">
          Create a project
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-secondary">
          A project holds documentation pages and the context record agents read
          before starting work.
        </p>

        <div className="mt-7">
          <NewProjectForm parents={parents} />
        </div>
      </main>
    </div>
  );
}
