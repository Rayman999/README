# Theme

The readme wiki's visual system. Read this before rendering the wiki, building any component for it, or generating UI that sits inside it.

The product exists to be read. Every rule here serves one goal: a reader should be able to open a page and keep reading — comfortably, for a long time, without the interface getting in the way. When a rule and that goal conflict, the goal wins; then update this file so the code and the spec never drift apart again.

`src/app/globals.css` implements this file. Change values here first, then there.

**Contents**
1. Direction
2. Why it reads well
3. Themes and tokens
4. Reading preferences
5. Layout
6. Depth
7. The reader
8. Momentum
9. Typography
10. Code
11. Callouts
12. Navigation and contents
13. Motion
14. Prohibited

---

## 1. Direction

> A quiet, matte reading room. Neutral greys, one softly raised page, generous space, and nothing that competes with the words.

Graphite (dark) is the default and the identity. Paper (light) is the same design printed on a light ground, for daytime reading and for readers who find light-on-dark text blurry. Both are strictly neutral — never blue-, green- or purple-tinted.

There is **no accent colour**. Emphasis is brightness, weight, size and space. If something needs to stand out, make it brighter or give it room; don't give it a hue.

---

## 2. Why it reads well

The layout is built from reading research rather than taste:

| Principle | Rule here | Why |
|---|---|---|
| Line length | ~65–75 characters (measure set in `em`) | Shorter lines break rhythm; longer ones make it hard to find the next line |
| Size and leading | 17px body, ~1.7 line-height | 16px is the floor for screen reading; tight leading makes lines blur together |
| Contrast | Off-white body text, never pure white on black | Pure white on near-black causes halation, especially with astigmatism |
| Light option | Paper theme, one click away | Light mode is faster and clearer for many readers in daylight |
| Scanning | Headings carry meaning, sit left, have more space above than below | People scan the left edge and the first words of each heading (F-pattern) |
| Orientation | Progress bar, filling contents rail, minutes left | Knowing how much is left is what keeps people reading |
| Continuation | Strong "Up next" at the end; `]` for next page | Momentum: the next step is always one action away |
| Control | Theme, typeface, size and width are the reader's choice | Comfort is personal; defaults can't fit everyone |

---

## 3. Themes and tokens

The same token names carry both themes. Components only ever use tokens.

| Token | Graphite | Paper | Use |
|---|---|---|---|
| `--bg-base` / `--bg-shell` | `#0A0A0B` | `#F2F2EF` | Page, header, side rails — one continuous flat sheet |
| `--surface-raised-top → base` | `#171719 → #111113` | `#FDFDFB → #F8F8F5` | The raised page (gradient, barely visible) |
| `--surface-inset` | `#0D0D0F` | `#F1F1EE` | Code blocks and embedded content |
| `--text-heading` | `#EDEDEE` | `#18181A` | Titles, headings |
| `--text-primary` | `#E3E3E5` | `#1F2022` | Strong text, links, UI labels |
| `--text-body` | `#C2C3C7` | `#36373A` | Reading text |
| `--text-secondary` | `#A3A5AA` | `#55575B` | Descriptions, supporting text |
| `--text-tertiary` | `#8E9096` | `#696B70` | Metadata |
| `--text-muted` | `#6E7177` | `#8A8C91` | Labels, hints |
| `--ink-rgb` | `255 255 255` | `0 0 0` | Every translucent tint and hairline |

Borders and states are ink at low alpha: `--border-faint/subtle/visible` and `--state-hover/active/selected`. In Tailwind use `bg-ink/[0.03]`, `border-ink/10` — never `white/` or `black/`, which break the other theme.

Status colours are desaturated and used only for status: `--status-warn` (amber) and `--status-danger` (rust).

Syntax colours (`--syn-*`) are muted in both themes. Nothing in a code block is brighter than body text.

Shadows: none on Graphite (nothing is darker than the shell to cast onto), a soft one on Paper (`--shadow-panel`).

---

## 4. Reading preferences

Set from the **Aa** menu in the header, stored per browser, and applied before first paint as attributes on `<html>` so there is never a flash of the wrong theme.

| Attribute | Values | Effect |
|---|---|---|
| `data-theme` | `graphite` (default), `paper`; "Auto" resolves from the system | Swaps the token set |
| `data-face` | `sans` (Inter, default), `serif` (Literata) | Body text face; headings stay sans |
| `data-size` | `s` 15.5px, `m` 17px, `l` 18.5px, `xl` 20px | `--reading-size` |
| `data-measure` | `narrow` 31em, `standard` 36em, `wide` 43em | `--measure`; in `em` so characters per line stay constant at any size |
| `.reading-focus` | on/off (`F`) | Hides both side rails |

---

## 5. Layout

```
┌──────────────────────────────────────────────────────────────┐
│  readme              [ search ]          Library  Aa  ◯  ⇥   │
├════════════════════ progress line ═══════════════════════════┤
│            │  ╭─────────────────────────────╮  │             │
│  project   │  │  crumbs                     │  │  ON THIS    │
│  tree      │  │  Title                      │  │  PAGE       │
│  ✓ read    │  │  dek                        │  │  ┃ filled   │
│  ◔ partly  │  │  3 min · Updated  [tools]   │  │  ┃ rail     │
│            │  │  ───────────────────────    │  │             │
│            │  │  body at the measure        │  │  2 min left │
│            │  │  Up next →                  │  │             │
│            │  ╰─────────────────────────────╯  │             │
└────────────┴───────────────────────────────────┴─────────────┘
```

| Region | Width | Surface |
|---|---|---|
| Header | full, 54px | flat |
| Left nav | 272px (≥1024px) | flat |
| Page | measure + 2×56px padding | raised |
| Right contents | 232px (≥1280px) | flat |

Below 1280px the contents fold into an "On this page" disclosure in the article header. Below 480px the page loses its frame and the text runs edge to edge with small margins.

---

## 6. Depth

Exactly three levels.

| Level | What | Treatment |
|---|---|---|
| 0 | Shell — header, rails, background | Flat. No card, no shadow |
| +1 | The page | Raised: large radius, faint gradient, hairline border, top highlight |
| −1 | Code, embedded content | Inset: darker than the page, small inner shadow |

Everything else — rows, buttons, callouts, cards — is a tint, not a new level.

---

## 7. The reader

Inside the page, in order:

1. **Crumbs** — project / section, 12.5px muted
2. **Title** — 30–42px, weight 650, tight tracking, balanced wrapping
3. **Dek** — the page description, ~1.14em secondary, in the reading face
4. **Meta row** — minutes to read · updated date · status chip if not stable; tools on the right (Focus, Page history, Edit)
5. **Status notice** — only for Draft or Deprecated
6. **Body** — at the measure
7. **End** — completion note, "Up next" card, previous link
8. **Page settings** — editors only, collapsed

Editor controls never sit above the content. Readers come first.

Boxed blocks (code, tables, callouts, charts) extend 18px into the page margin on wide screens, so the text inside them lines up with the paragraphs around them.

---

## 8. Momentum

These are what make the wiki pleasant to keep reading. Progress is stored only in the reader's browser.

- **Progress line** under the header, filling as the article is read.
- **Contents rail** fills down to the current section; passed sections dim, the current one is brightest; minutes left underneath.
- **Read marks**: a check beside finished pages and a small progress ring beside partly read ones, in the nav and on the project page.
- **Resume**: returning to a half-read page offers "Continue where you left off" with the section name.
- **Finish and continue**: reaching the end marks the page read and offers the next page, with its description, as the obvious next step.
- **Project progress**: "3 of 12 read" and a single "Continue reading" / "Read next" card at the top of each project.
- **Keys**: `[` and `]` for previous and next page, `F` for focus mode, `Ctrl K` for search.

---

## 9. Typography

Sans: **Inter** (with `cv05`/`cv08` so l, I and 1 are distinct). Serif option: **Literata**. Mono: **JetBrains Mono**.

| Element | Size | Weight | Colour |
|---|---|---|---|
| Title | 30–42px | 650 | heading |
| H2 | 1.42em | 650 | heading |
| H3 | 1.1em | 620 | primary |
| Body | `--reading-size` / ~1.7 | 400 | body |
| Code | max(12.5px, .78em) / 1.7 | 400 | primary |
| Labels | 11px, uppercase, .07–.08em | 600 | muted |

Rhythm: 2.4em above an H2, 1.9em above an H3, ~0.55em below either, 1.05em between paragraphs. Body text is left-aligned and ragged, with `text-wrap: pretty`; headings use `text-wrap: balance`.

Links are primary-coloured with a soft underline that strengthens on hover. Inline code is a light ink tint, not a dark box.

---

## 10. Code

Inset one level. A header bar shows the language and a **Copy** button. Highlighting uses the muted `--syn-*` tokens via CSS variables, so code follows the theme without re-rendering. Comments recede; structure is visible but nothing is loud.

---

## 11. Callouts

A slightly different tint, a hairline border, a 2px left rule, and a small uppercase label. Note, tip and important stay neutral. Warning uses `--status-warn`, caution `--status-danger` — on the rule and the label only.

---

## 12. Navigation and contents

**Left nav** — the project tree. 13.5px rows, 32px minimum height, wrapping titles. Selected row: a lighter tint plus a 2px indicator. Read marks replace the page icon.

**Right contents** — the quietest region. 10.5px uppercase label, 13px entries, H3s indented. A 1px rail fills as sections are read; the current entry gets a 2px bright segment. The active section is the last heading above 30% of the viewport, so a long section stays active until the next one starts.

---

## 13. Motion

Slow, small, deliberate: 150–250ms on `--ease`. Animate opacity, background alpha and 1–4px translations. Contents links glide to their section; route changes jump (never animate the scroll position on navigation). Respect `prefers-reduced-motion` everywhere, including programmatic scrolling.

---

## 14. Prohibited

- Any accent hue — emphasis is brightness and space
- Blue-, green- or purple-tinted neutrals
- Pure `#000` grounds or pure `#FFF` text on dark
- `white/` or `black/` utilities for tints (use `ink/`)
- Lines longer than ~80 characters
- Editor controls above the content
- Glassmorphism, glow, gloss, neon, gradients you can see
- Cards for the rails or header; a card-grid dashboard look
- More than three depth levels
- Marketing patterns — hero sections, gradient CTAs, decorative illustration

If someone asks for something on this list, build it their way — but say which rule it breaks first, so it's a decision rather than an accident.
