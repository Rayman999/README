import { test } from "node:test";
import assert from "node:assert/strict";
import { isProjectWithin, orderProjects } from "../src/lib/project-tree";

const rows = [
  { id: "web", slug: "website", name: "Website", parentId: "tilde" },
  { id: "tilde", slug: "tilde", name: "Tilde", parentId: null },
  { id: "mkt", slug: "marketing", name: "Marketing", parentId: "web" },
  { id: "api", slug: "api", name: "API", parentId: "tilde" },
  { id: "solo", slug: "solo", name: "Solo", parentId: null },
  { id: "orphan", slug: "orphan", name: "Orphan", parentId: "gone" },
];

test("projects nest to any depth in depth-first, name order", () => {
  const ordered = orderProjects(rows);
  assert.deepEqual(ordered.map((row) => row.slug), ["orphan", "solo", "tilde", "api", "website", "marketing"]);
  const marketing = ordered.find((row) => row.slug === "marketing")!;
  assert.equal(marketing.depth, 2);
  assert.deepEqual(marketing.path, ["Tilde", "Website", "Marketing"]);
  assert.deepEqual(marketing.ancestors.map((a) => a.slug), ["tilde", "website"]);
  assert.deepEqual(ordered.find((row) => row.slug === "tilde")!.children.map((c) => c.slug), ["api", "website"]);
  // A parent that no longer exists means top level.
  assert.equal(ordered.find((row) => row.slug === "orphan")!.depth, 0);
});

test("a cycle never loops and every project still appears", () => {
  const cyclic = [
    { id: "a", slug: "a", name: "A", parentId: "b" },
    { id: "b", slug: "b", name: "B", parentId: "a" },
  ];
  assert.equal(orderProjects(cyclic).length, 2);
});

test("a project can't move inside itself or its own projects", () => {
  assert.equal(isProjectWithin(rows, "mkt", "tilde"), true);
  assert.equal(isProjectWithin(rows, "tilde", "tilde"), true);
  assert.equal(isProjectWithin(rows, "api", "web"), false);
  assert.equal(isProjectWithin(rows, "solo", "tilde"), false);
});
