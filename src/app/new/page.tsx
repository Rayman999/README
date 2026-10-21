import Link from "@/components/shell/NavigationLink";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { listProjectTree } from "@/lib/projects";
import { Header } from "@/components/shell/Header";
import { HEADER_H } from "@/components/shell/icons";
import { NewProjectForm } from "./NewProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canEdit = session.user.role === "owner" || session.user.role === "editor";
  if (!canEdit) redirect("/");

  const workspace = await getWorkspace();
  const tree = workspace ? await listProjectTree(workspace.id) : [];
  const parents = tree.map((p) => ({ id: p.id, label: p.path.join(" / ") }));
  // "New project here" on a project page links with ?parent=<slug>.
  const { parent: parentSlug } = await searchParams;
  const parent = tree.find((p) => p.slug === parentSlug);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />

      <main id="main-content" tabIndex={-1}
        className="mx-auto w-full max-w-[600px] px-6 pb-24"
        style={{ paddingTop: HEADER_H + 48 }}
      >
        <nav aria-label="Breadcrumb" className="text-[11.5px] text-muted">
          <Link href="/" className="ease-base transition-colors duration-200 hover:text-tertiary">
            Workspace
          </Link>
          <span className="mx-1.5 opacity-50">/</span>
          {parent && (
            <>
              <Link href={`/p/${parent.slug}`} className="ease-base transition-colors duration-200 hover:text-tertiary">{parent.name}</Link>
              <span className="mx-1.5 opacity-50">/</span>
            </>
          )}
          <span>New project</span>
        </nav>

        <h1 className="mt-3 text-[24px] leading-tight font-semibold text-heading">
          {parent ? `New project in ${parent.name}` : "Create a project"}
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-secondary">
          Give your team a home for system explanations, coding standards, and
          decisions. Start with a name and a short introduction.
        </p>

        <div className="mt-7">
          <NewProjectForm parents={parents} defaultParent={parent?.id ?? ""} />
        </div>
      </main>
    </div>
  );
}
