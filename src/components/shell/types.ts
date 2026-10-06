export type NavPage = {
  id: string;
  slug: string;
  title: string;
  href: string;
};

export type NavSection = {
  slug: string;
  title: string;
  /** What belongs in the section; shown as a hint in the sidebar. */
  description?: string;
  pages: NavPage[];
};

export type TocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
};
