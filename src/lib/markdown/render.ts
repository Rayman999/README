import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { toString as hastToString } from "hast-util-to-string";
import type { Root, Element } from "hast";
import type { Blockquote } from "mdast";
import { codeToHtml } from "shiki";
import { readmeSyntaxTheme } from "./shiki-theme";

export type Heading = { id: string; text: string; level: 2 | 3 };

/**
 * BUILD.md §11: agent-written content is untrusted input. Raw HTML in a page
 * body must not execute. This schema allows structural markup only — no
 * script, style, iframe, event handlers, or javascript: URLs.
 */
const schema: typeof defaultSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "id"],
    code: [["className", /^language-./]],
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    div: [...(defaultSchema.attributes?.div ?? []), ["dataAlert", /^(NOTE|TIP|IMPORTANT|WARNING|CAUTION)$/]],
  },
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (t) => !["script", "style", "iframe", "object", "embed"].includes(t),
  ),
};

const ALERTS: Record<string, string> = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Caution",
};

/** GitHub alert syntax: a blockquote whose first line is `[!NOTE]`. */
function remarkGithubAlerts() {
  return (tree: Root) => {
    visit(tree, "blockquote", (node: Blockquote) => {
      const first = node.children?.[0];
      if (first?.type !== "paragraph") return;
      const text = first.children?.[0];
      if (text?.type !== "text") return;

      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/.exec(
        text.value,
      );
      if (!match) return;

      const kind = match[1];
      text.value = text.value.slice(match[0].length).replace(/^\n+/, "");
      if (!text.value) first.children.shift();

      node.data = {
        hName: "div",
        hProperties: {
          className: ["callout"],
          dataAlert: kind,
        },
      };
      node.children.unshift({
        type: "paragraph",
        data: {
          hName: "p",
          hProperties: { className: ["callout__label"] },
        },
        children: [{ type: "text", value: ALERTS[kind] }],
      });
    });
  };
}

/** Collect ## and ### for the table of contents. */
function collectHeadings(tree: Root, out: Heading[]) {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "h2" && node.tagName !== "h3") return;
    const id = String(node.properties?.id ?? "");
    if (!id) return;
    out.push({
      id,
      text: hastToString(node),
      level: node.tagName === "h2" ? 2 : 3,
    });
  });
}

/**
 * A copyable address on every h2/h3. Runs after sanitising and after the
 * outline is collected, so the "#" never leaks into heading text.
 */
function rehypeHeadingAnchors() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const id = String(node.properties?.id ?? "");
      if (!id) return;
      node.children.push({
        type: "element",
        tagName: "a",
        properties: { href: `#${id}`, className: ["rd-anchor"], ariaLabel: `Link to ${hastToString(node)}` },
        children: [{ type: "text", value: "#" }],
      });
    });
  };
}

/**
 * Highlight fenced code with Shiki after sanitising. Supports an optional
 * `title=` on the info string, e.g. ```ts title=src/server.ts
 */
async function highlight(html: string): Promise<string> {
  const blocks = [...html.matchAll(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g)];
  let out = html;

  for (const [full, attrs, body] of blocks) {
    const langMatch = /language-([A-Za-z0-9+#-]+)/.exec(attrs);
    const lang = langMatch?.[1] ?? "text";
    const code = decode(body);

    let rendered: string;
    try {
      rendered = await codeToHtml(code, {
        lang,
        theme: readmeSyntaxTheme,
      });
    } catch {
      // Unknown language — fall back to plain text rather than failing the page.
      rendered = await codeToHtml(code, { lang: "text", theme: readmeSyntaxTheme });
    }

    // `lang` is limited to [A-Za-z0-9+#-] by the regex above, so it is safe to
    // interpolate. The copy button is wired up by the reader on the client.
    const label = lang === "text" ? "" : lang;
    out = out.replace(
      full,
      `<div class="code-block"><div class="code-block__bar"><span>${label}</span><button type="button" class="code-copy" data-copy>Copy</button></div>${rendered}</div>`,
    );
  }

  return out;
}

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function renderMarkdown(
  source: string,
): Promise<{ html: string; headings: Heading[] }> {
  const headings: Heading[] = [];

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkGithubAlerts)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(rehypeSanitize, schema)
    .use(() => (tree: Root) => collectHeadings(tree, headings))
    .use(rehypeHeadingAnchors)
    .use(rehypeStringify)
    .process(source);

  const html = await highlight(String(file));
  return { html, headings };
}
