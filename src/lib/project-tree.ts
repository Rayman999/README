// Projects nest to any depth: a project such as "Tilde" can hold projects,
// which can hold projects of their own. Folders and pages live inside each
// one. Plain functions so server code, pages and MCP tools share one order.

export type ProjectRow = { id: string; slug: string; name: string; parentId: string | null };

export type OrderedProject<T extends ProjectRow> = T & {
  depth: number;
  /** Names from the top-level project down to and including this one. */
  path: string[];
  /** Ancestors, top-level first, nearest last. */
  ancestors: T[];
  /** Direct child projects, by name. */
  children: T[];
};

/** Depth-first, siblings by name. A missing parent counts as top level. */
export function orderProjects<T extends ProjectRow>(rows: T[]): OrderedProject<T>[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const children = new Map<string | null, T[]>();
  for (const row of rows) {
    const parent = row.parentId && byId.has(row.parentId) ? row.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), row]);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const out: OrderedProject<T>[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, ancestors: T[]) => {
    for (const row of children.get(parent) ?? []) {
      if (seen.has(row.id)) continue; // defensive: never loop on a cycle
      seen.add(row.id);
      out.push({ ...row, depth, path: [...ancestors.map((a) => a.name), row.name], ancestors, children: children.get(row.id) ?? [] });
      walk(row.id, depth + 1, [...ancestors, row]);
    }
  };
  walk(null, 0, []);
  for (const row of rows) if (!seen.has(row.id)) out.push({ ...row, depth: 0, path: [row.name], ancestors: [], children: [] });
  return out;
}

/** True when `candidate` is `project` itself or sits anywhere beneath it. */
export function isProjectWithin(rows: ProjectRow[], candidate: string, project: string) {
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
  for (let at: string | null | undefined = candidate, hops = 0; at && hops <= rows.length; at = parentOf.get(at), hops += 1) {
    if (at === project) return true;
  }
  return false;
}
