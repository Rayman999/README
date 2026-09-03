import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { documentSchema, documentText, documentContext, starterDocument } from "../src/lib/documents/schema";
import { DocumentRenderer } from "../src/components/documents/DocumentRenderer";
import { readJson } from "../src/lib/api/read-json";

test("starter validates and schema is discoverable JSON", () => {
  assert.equal(documentSchema.parse(starterDocument).schemaVersion, 1);
  assert.ok(z.toJSONSchema(documentSchema).properties);
});

test("rejects HTML blocks, style overrides, executable fields and unsupported versions", () => {
  for (const block of [{ type: "html", html: "<script>alert(1)</script>" }, { type: "paragraph", text: "hello", style: "color:red" }, { type: "paragraph", text: "hello", onClick: "alert(1)" }]) {
    assert.equal(documentSchema.safeParse({ ...starterDocument, blocks: [block] }).success, false);
  }
  assert.equal(documentSchema.safeParse({ ...starterDocument, schemaVersion: 2 }).success, false);
});

test("enforces chart, table, block and total-byte limits", () => {
  for (const value of [-1, Infinity, NaN, 1e13]) {
    assert.equal(documentSchema.safeParse({ ...starterDocument, blocks: [{ type: "chart", variant: "bar", title: "Example", data: [{ label: "a", value }] }] }).success, false);
  }
  assert.equal(documentSchema.safeParse({ ...starterDocument, blocks: [{ type: "table", title: "x", columns: ["a", "b"], rows: [["one"]] }] }).success, false);
  assert.equal(documentSchema.safeParse({ ...starterDocument, blocks: Array(81).fill({ type: "paragraph", text: "x" }) }).success, false);
  assert.equal(documentSchema.safeParse({ ...starterDocument, blocks: Array(40).fill({ type: "paragraph", text: "界".repeat(3000) }) }).success, false);
});

test("derives readable search text and compact context without blocks", () => {
  const parsed = documentSchema.parse(starterDocument);
  const context = documentContext(parsed);
  assert.equal("blocks" in context, false);
  assert.equal(context.outline[0].id, "doc-section-0");
  assert.match(documentText(parsed), /Guides: 7/);
  assert.doesNotMatch(documentText(parsed), /schemaVersion/);
});

test("renderer escapes hostile text; chart data remains accessible", () => {
  const parsed = documentSchema.parse({ ...starterDocument, blocks: [...starterDocument.blocks, { type: "paragraph", text: '<script>alert("x")</script>' }, { type: "code", language: "html", code: "<img src=x onerror=alert(1)>" }] });
  const html = renderToStaticMarkup(createElement(DocumentRenderer, { document: parsed }));
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /View chart data/);
  assert.match(html, /scope="col"/);
});

test("zero and single-point charts render finite geometry", () => {
  for (const variant of ["bar", "line"]) {
    const doc = documentSchema.parse({ ...starterDocument, blocks: [{ type: "chart", title: "zero", variant, data: [{ label: "Only", value: 0 }] }] });
    const html = renderToStaticMarkup(createElement(DocumentRenderer, { document: doc }));
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test("request reader rejects oversized actual bodies and malformed JSON", async () => {
  assert.deepEqual(await readJson(new Request("https://example.test", { method: "POST", body: '{"ok":true}' })), { ok: true });
  await assert.rejects(readJson(new Request("https://example.test", { method: "POST", body: "x".repeat(200) }), 100), /limit/);
  await assert.rejects(readJson(new Request("https://example.test", { method: "POST", body: "{" })));
});
