import type { ThemeRegistration } from "shiki";

// Built from the --syn-* tokens in theme.md §2. Nothing here may be brighter
// than --text-primary, and the palette stays desaturated on purpose: if the
// code looks colourful, the theme is wrong.
const SYN = {
  keyword: "#A9A3C2",
  string: "#9FB09B",
  func: "#A3B0BC",
  variable: "#C9CACD",
  number: "#B5AFA3",
  comment: "#5B5E63",
  punctuation: "#7A7D82",
  text: "#E7E7E7",
  bg: "#0D0E10",
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
