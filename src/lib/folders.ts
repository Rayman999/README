// Folder (section) ordering. One definition of reading order shared by the
// sidebar, the overview, "up next", the AI export and the MCP layout:
// depth-first — a folder's own pages, then its sub-folders, siblings by
// position. Plain functions so both server and client code can use them.

export type FolderRow = { id: string; parentId: string | null; position: number; title: string; slug: string };

export type OrderedFolder<T extends FolderRow> = T & {
  depth: number;
  /** Titles from the top-level folder down to and including this one. */
  path: string[];
  /** Slugs of every ancestor, nearest last. */
  ancestors: string[];
};

export function orderFolders<T extends FolderRow>(rows: T[]): OrderedFolder<T>[] {
  const ids = new Set(rows.map((row) => row.id));
  const children = new Map<string | null, T[]>();
  for (const row of rows) {
    // A parent that no longer exists means the folder sits at the top level.
    const parent = row.parentId && ids.has(row.parentId) ? row.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), row]);
  }
  for (const list of children.values()) list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

  const out: OrderedFolder<T>[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, path: string[], ancestors: string[]) => {
    for (const row of children.get(parent) ?? []) {
      if (seen.has(row.id)) continue; // defensive: never loop on a cycle
      seen.add(row.id);
      const entry = { ...row, depth, path: [...path, row.title], ancestors };
      out.push(entry);
      walk(row.id, depth + 1, entry.path, [...ancestors, row.slug]);
    }
  };
  walk(null, 0, [], []);
  // Anything unreachable (only possible with a corrupted cycle) still shows.
  for (const row of rows) if (!seen.has(row.id)) out.push({ ...row, depth: 0, path: [row.title], ancestors: [] });
  return out;
}

/** True when `candidate` is `folder` itself or sits anywhere beneath it. */
export function isWithin(rows: FolderRow[], candidate: string, folder: string) {
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
  for (let at: string | null | undefined = candidate, hops = 0; at && hops <= rows.length; at = parentOf.get(at), hops += 1) {
    if (at === folder) return true;
  }
  return false;
}
