import type { NavSection } from "@/components/shell/types";
import type { getProjectTree } from "@/lib/projects";

type Tree = Awaited<ReturnType<typeof getProjectTree>>;

export function pageHref(projectHref: string, sectionSlug: string | null, pageSlug: string) {
  return `${projectHref}/${sectionSlug ? `${sectionSlug}/` : ""}${pageSlug}`;
}

/** Sidebar folders in reading order; loose pages close the list. */
export function toNavSections(tree: Tree, projectHref: string): NavSection[] {
  const folders: NavSection[] = tree.sections.map((section) => ({
    id: section.id,
    parentId: section.parentId,
    depth: section.depth,
    slug: section.slug,
    title: section.title,
    description: section.description,
    pages: section.pages.map((page) => ({ id: page.id, slug: page.slug, title: page.title, href: pageHref(projectHref, section.slug, page.slug) })),
  }));
  if (tree.loosePages.length) {
    folders.push({
      id: "loose",
      parentId: null,
      depth: 0,
      slug: "unsectioned",
      title: folders.length ? "More pages" : "Pages",
      pages: tree.loosePages.map((page) => ({ id: page.id, slug: page.slug, title: page.title, href: pageHref(projectHref, null, page.slug) })),
    });
  }
  return folders;
}

/** Every page in reading order, with the folder path it sits in. */
export function readingOrder(tree: Tree, projectHref: string) {
  return [
    ...tree.sections.flatMap((section) =>
      section.pages.map((page) => ({ ...page, href: pageHref(projectHref, section.slug, page.slug), folderPath: section.path })),
    ),
    ...tree.loosePages.map((page) => ({ ...page, href: pageHref(projectHref, null, page.slug), folderPath: [] as string[] })),
  ];
}
