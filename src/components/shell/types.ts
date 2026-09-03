export type NavPage = {
  slug: string;
  title: string;
  href: string;
};

export type NavSection = {
  slug: string;
  title: string;
  pages: NavPage[];
};

export type TocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
};
