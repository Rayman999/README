import type { ThemeRegistration } from "shiki";

// Colours are CSS variables, so highlighted code follows the reader's theme
// (Graphite or Paper) without re-rendering. Values live in globals.css.
const SYN = {
  keyword: "var(--syn-keyword)",
  string: "var(--syn-string)",
  func: "var(--syn-function)",
  variable: "var(--syn-variable)",
  number: "var(--syn-number)",
  comment: "var(--syn-comment)",
  punctuation: "var(--syn-punctuation)",
  text: "var(--syn-text)",
  bg: "transparent",
};

export const readmeSyntaxTheme: ThemeRegistration = {
  name: "readme-muted",
  type: "dark",
  colors: {
    "editor.background": SYN.bg,
    "editor.foreground": SYN.text,
  },
  settings: [
    { settings: { foreground: SYN.text, background: SYN.bg } },
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: SYN.comment, fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "keyword.control",
        "keyword.operator.new",
        "variable.language",
        "constant.language",
      ],
      settings: { foreground: SYN.keyword },
    },
    {
      scope: ["string", "string.quoted", "constant.other.symbol"],
      settings: { foreground: SYN.string },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call",
        "entity.name.tag",
      ],
      settings: { foreground: SYN.func },
    },
    {
      scope: ["variable", "meta.definition.variable", "support.variable"],
      settings: { foreground: SYN.variable },
    },
    {
      scope: ["constant.numeric", "constant.language.boolean", "constant"],
      settings: { foreground: SYN.number },
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "keyword.operator",
        "punctuation.separator",
      ],
      settings: { foreground: SYN.punctuation },
    },
    {
      scope: ["entity.name.type", "support.type", "entity.other.attribute-name"],
      settings: { foreground: SYN.func },
    },
  ],
};
