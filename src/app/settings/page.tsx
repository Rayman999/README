import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getWorkspace } from "@/lib/workspace";
import { listProjects } from "@/lib/projects";
import { Header } from "@/components/shell/Header";
import { HEADER_H } from "@/components/shell/icons";
import { ReadingSettings } from "@/components/reading/ReadingSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reading settings · readme" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspace = await getWorkspace();
  const projects = workspace ? (await listProjects(workspace.id)).map((project) => ({ slug: project.slug, name: project.name })) : [];

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />
      <main id="main-content" tabIndex={-1} className="settings-page" style={{ paddingTop: HEADER_H + 40 }}>
        <ReadingSettings projects={projects} />
      </main>
    </div>
  );
}
