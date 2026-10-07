import { orderFolders } from "@/lib/folders";
import Link from "@/components/shell/NavigationLink";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canWrite } from "@/lib/api/context";
import { getWorkspace } from "@/lib/workspace";
import { getPageBySlug, getProjectBySlug, getSectionById, listSections } from "@/lib/projects";
import { DocumentComposer } from "@/components/documents/DocumentComposer";

export default async function ComposePage({ params, searchParams }: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const workspace = await getWorkspace();
  if (!workspace) redirect("/");
  const project = await getProjectBySlug(workspace.id, (await params).project);
  if (!project) notFound();
  if (!canWrite(session.user.role)) redirect(`/p/${project.slug}`);
  const pageSlug = (await searchParams).page;
  const page = pageSlug ? await getPageBySlug(project.id, pageSlug) : undefined;
  if (pageSlug && !page) notFound();
  const section = page?.sectionId ? await getSectionById(page.sectionId) : undefined;
  // Full paths in reading order, so nested folders read clearly in the picker.
  const sections = orderFolders(await listSections(project.id)).map((entry) => ({ slug: entry.slug, title: entry.path.join(" › ") }));
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1500px] px-5 py-8 sm:px-10">
    <Link href={`/p/${project.slug}`} className="text-[13px] text-secondary hover:text-primary">← {project.name}</Link>
    <div className="mt-6"><DocumentComposer project={project.slug} sections={sections} initial={page ? { slug: page.slug, title: page.title, description: page.description, status: page.status, body: page.body, document: page.document, version: page.version, section: section?.slug ?? "", href: section ? `/p/${project.slug}/${section.slug}/${page.slug}` : `/p/${project.slug}/${page.slug}` } : undefined} /></div>
  </main>;
}
