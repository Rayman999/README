export type NavPage = {
  id: string;
  slug: string;
  title: string;
  href: string;
};

/** A folder, flattened in reading order; `parentId` rebuilds the tree. */
export type NavSection = {
  id: string;
  parentId: string | null;
  depth: number;
  slug: string;
  title: string;
  /** What belongs in the folder; shown as a hint in the sidebar. */
  description?: string;
  pages: NavPage[];
};

export type TocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
};
