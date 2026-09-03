import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canWrite } from "@/lib/api/context";
import { getWorkspace } from "@/lib/workspace";
import { getPageBySlug, getProjectBySlug, getSectionById } from "@/lib/projects";
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
  if (pageSlug && (!page || !page.document)) notFound();
  const section = page?.sectionId ? await getSectionById(page.sectionId) : undefined;
  return <main className="mx-auto max-w-[1400px] px-5 py-10 sm:px-10">
    <Link href={`/p/${project.slug}`} className="text-[13px] text-secondary hover:text-primary">← {project.name}</Link>
    <div className="mt-6 mb-8"><p className="text-[11px] tracking-widest text-secondary uppercase">Structured documents / v1</p><h1 className="mt-2 text-[30px] font-semibold text-heading">{page ? "Edit document" : "Create a document"}</h1><p className="mt-3 max-w-[700px] text-sm text-secondary">Write structured content. README takes care of the theme. Validate your JSON, preview the page, then save it to this project.</p><Link href="/document-guide" className="mt-3 inline-block text-sm text-primary underline underline-offset-4">Explore the component guide</Link></div>
    <DocumentComposer project={project.slug} initial={page?.document ? { slug: page.slug, title: page.title, description: page.description, status: page.status, document: page.document, version: page.version, href: section ? `/p/${project.slug}/${section.slug}/${page.slug}` : `/p/${project.slug}/${page.slug}` } : undefined} />
  </main>;
}
