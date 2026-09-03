# Theme — locked

The readme wiki's visual system. Read this before rendering the wiki, building any component for it, or generating UI that sits inside it.

This is a constraint, not a starting point. The identity depends entirely on discipline: one neutral palette, three depth levels, and no colour doing work that typography and spacing should do. Every rule here exists because breaking it makes the interface look like a generic dark SaaS dashboard.

**Contents**
1. Direction
2. Tokens
3. Layout
4. Depth system
5. The ramp
6. Left navigation
7. Right table of contents
8. Header
9. Content panel
10. Code blocks
11. Callouts
12. Typography
13. Buttons and inputs
14. Motion
15. Prohibited

---

## 1. Direction

> Matte dark UI with soft elevation, low-contrast surfaces, gently raised content areas, and subtle grey-to-black gradients.

Picture the whole application as one large sheet of matte graphite. Navigation, header, and table of contents are printed directly onto that flat sheet. In the centre, the documentation area gently rises out of the material like a shallow platform — a curved ramp up, a flat top, a ramp back down. Inside that raised surface, code blocks are slightly inset.

It should feel like a real desktop application, not a marketing site. Dark, quiet, tactile, mature, and easy on the eyes for hours.

The colour temperature is neutral throughout. Black, graphite, charcoal, grey, soft white. **Never blue-tinted** — that tint is the single most common failure mode in dark interfaces and it's the fastest way to make this look like everything else.

---

## 2. Tokens

Use these verbatim.

```css
:root {
  /* Base shell — flat, nearly black */
  --bg-base:         #090A0B;
  --bg-shell:        #0B0C0E;
  --bg-shell-alt:    #0D0E10;

  /* Raised documentation panel */
  --surface-raised:      #141517;
  --surface-raised-top:  #17181A;  /* gradient top */
  --surface-raised-mid:  #141517;  /* gradient middle */
  --surface-raised-base: #111214;  /* gradient bottom */

  /* Inset surfaces — code blocks, embedded content */
  --surface-inset:   #0D0E10;
  --surface-sunken:  #0B0C0E;

  /* Text */
  --text-primary:    #E7E7E7;
  --text-heading:    #DEDEDE;
  --text-secondary:  #989A9F;
  --text-tertiary:   #8B8E94;
  --text-muted:      #64676D;

  /* Borders — barely there */
  --border-faint:    rgba(255,255,255,0.04);
  --border-subtle:   rgba(255,255,255,0.05);
  --border-visible:  rgba(255,255,255,0.07);

  /* Interactive states */
  --state-hover:     rgba(255,255,255,0.03);
  --state-active:    rgba(255,255,255,0.05);
  --state-selected:  rgba(255,255,255,0.05);

  /* Elevation */
  --shadow-panel:    0 18px 60px rgba(0,0,0,0.25);
  --shadow-ambient:  0 2px 12px rgba(0,0,0,0.18);
  --highlight-top:   inset 0 1px 0 rgba(255,255,255,0.03);
  --shadow-inset:    inset 0 1px 2px rgba(0,0,0,0.35);

  /* Radii */
  --radius-panel:    28px;   /* 24–32 range */
  --radius-code:     12px;   /* 10–14 range */
  --radius-control:  9px;    /* 8–10 range */
  --radius-input:    10px;   /* 8–12 range */

  /* Muted syntax palette */
  --syn-keyword:     #A9A3C2;  /* muted lavender-grey */
  --syn-string:      #9FB09B;  /* muted sage */
  --syn-function:    #A3B0BC;  /* soft pale blue-grey */
  --syn-variable:    #C9CACD;
  --syn-number:      #B5AFA3;
  --syn-comment:     #5B5E63;
  --syn-punctuation: #7A7D82;

  /* Motion */
  --ease:            cubic-bezier(0.4, 0.0, 0.2, 1);
  --dur-fast:        150ms;
  --dur-base:        200ms;
  --dur-slow:        250ms;
}
```

There is no accent colour. If something needs emphasis, it gets brighter text, more space, or elevation — not hue. Status colours (a `deprecated` badge, an error state) are permitted but must be desaturated to sit inside this palette; never a saturated red, green, or blue.

---

## 3. Layout

Three columns on one continuous shell, plus a minimal header.

```
┌──────────────────────────────────────────────────────────────┐
│  icon · wiki name        [ search ]      changelog · gh · ⚙  │
├────────────┬───────────────────────────────────┬─────────────┤
│            │  ╭─────────────────────────────╮  │             │
│  file      │  │                             │  │  ON THIS    │
│  tree      │  │   raised content panel      │  │  PAGE       │
│            │  │                             │  │             │
│  (flat)    │  ╰─────────────────────────────╯  │  (flat)     │
└────────────┴───────────────────────────────────┴─────────────┘
```

| Region | Width | Surface |
|---|---|---|
| Header | full | flat, `--bg-shell` |
| Left nav | 260–290px | flat, `--bg-base` |
| Content | fluid, max ~760px text measure | **raised**, `--surface-raised` |
| Right TOC | 220–240px | flat, `--bg-base` |

The header, both sidebars, and the page background must read as one continuous flat surface. The content panel is the only elevated object on the screen — that's what makes the elevation legible at all.

Content measure stays around 70–80 characters. A wide content area destroys readability regardless of how good the surface treatment is.

---

## 4. Depth system

Exactly three levels. Not four, not ten.

| Level | What | Treatment |
|---|---|---|
| **0** | Shell — header, sidebars, background | Flat. No shadow, no card, no background of its own. |
| **+1** | Documentation content panel | Softly raised. Large radius, faint gradient, very soft shadow, hairline top highlight. |
| **−1** | Code blocks, embedded content | Slightly inset. Darker than the panel, small inner shadow. |

Everything else — nav rows, buttons, search, callouts — is a surface *tint* at level 0 or +1, not a new elevation. Hover states change background alpha, never elevation.

The depth should only become obvious when you compare the panel against the surrounding shell. If it announces itself, it's too strong.

---

## 5. The ramp

The transition from flat shell into the raised panel is the signature of this design. The elevation shouldn't jump — it should slope.

```
flat shell → soft grey transition → rounded slope → raised matte platform
```

Build it by layering, not by stacking a border and a drop shadow:

```css
.doc-panel {
  position: relative;
  border-radius: var(--radius-panel);
  background: linear-gradient(
    180deg,
    var(--surface-raised-top) 0%,
    var(--surface-raised-mid) 45%,
    var(--surface-raised-base) 100%
  );
  box-shadow:
    var(--shadow-panel),
    var(--highlight-top);
  border: 1px solid var(--border-faint);
}

/* the ramp: a soft halo bleeding into the shell */
.doc-panel::before {
  content: '';
  position: absolute;
  inset: -24px;
  border-radius: calc(var(--radius-panel) + 24px);
  background: radial-gradient(
    ellipse at 50% 0%,
    rgba(255,255,255,0.020) 0%,
    rgba(255,255,255,0.008) 40%,
    transparent 72%
  );
  pointer-events: none;
  z-index: -1;
}
```

The gradient exists to communicate shape, not to be seen. If you can identify it as a gradient, halve it. Same for the shadow: it should almost disappear into the surrounding dark rather than reading as a floating card.

Top corners get the smoothest transition — that's where the eye lands first.

---

## 6. Left navigation

An IDE file tree, carved into the shell. **No card, no panel background, no strong separator.**

- Section headers: 11px, uppercase, letter-spacing ~0.06em, `--text-muted`
- Page rows: 13.5px, `--text-secondary`
- Hover: background `--state-hover`, text lifts to `--text-primary`
- Selected: background `--state-selected`, text `--text-primary`, `--radius-control`
- Optional 2px indicator bar at the row's left edge in `rgba(255,255,255,0.25)`
- Small monochrome icons at ~14px, `--text-muted`, brightening on hover
- Row height 30–32px, comfortable but dense

The selected row is a slightly lighter charcoal, never a coloured button. Colour in the sidebar would pull attention away from the content panel, which is the whole point of the layout.

Separator from the content column: `1px solid var(--border-faint)`, or nothing at all if the spacing already separates them.

---

## 7. Right table of contents

The quietest region on the screen. Sits directly on `--bg-base`. No card, no border, no background.

- Label `ON THIS PAGE`: 10.5px, uppercase, letter-spacing ~0.08em, `--text-muted`
- Entries: 12.5px, `--text-tertiary`
- `###` entries indented 12px
- Active entry: `--text-primary`, plus a 2px vertical indicator in `rgba(255,255,255,0.22)`
- Active state transitions on scroll at `--dur-slow` — it should drift, not snap

---

## 8. Header

Compact and flat. Height 52–56px, background `--bg-shell`, bottom border `--border-faint`.

Left: app icon and wiki name (13.5px, `--text-primary`). Centre: search. Right: changelog, GitHub, theme toggle, profile — all monochrome icons at `--text-muted`.

Search is a recessed input that blends into the shell:

```css
.search {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border-visible);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  height: 32px;
  box-shadow: var(--shadow-inset);
}
.search::placeholder { color: var(--text-muted); }
.search:focus {
  border-color: rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.03);
  outline: none;              /* no coloured focus ring */
}
```

---

## 9. Content panel

Inside the raised panel, in order:

1. **Breadcrumbs** — 11.5px, `--text-muted`, `/` separators in `--text-muted` at lower opacity
2. **H1** — 30–34px, semibold, `--text-heading`, tight leading
3. **Description** — 15px, `--text-secondary`
4. **Divider** — `1px solid var(--border-subtle)`, generous margin
5. **Body** — sections, code, callouts
6. **Previous / next footer** — two understated blocks, `--text-secondary` labels, `--text-primary` titles

Panel padding: 48–56px horizontal, 40–48px vertical. Space is doing real work in this design — cramping the panel undoes the elevation effect.

---

## 10. Code blocks

Inset one level below the panel.

```css
.code-block {
  background: var(--surface-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-code);
  box-shadow: var(--shadow-inset);
  font-size: 13px;
  line-height: 1.65;
  padding: 16px 18px;
}
.code-block__title {
  font-size: 11.5px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-faint);
  padding: 9px 18px;
}
```

Syntax highlighting uses the muted `--syn-*` tokens. The goal is legible structure, not colour — if the code looks colourful, the palette is wrong. Comments recede to `--syn-comment`; nothing in a code block should be brighter than `--text-primary`.

Inline code: `--surface-inset` background, 2px 6px padding, `--radius-control` at the small end, `--text-primary`, 0.92em.

---

## 11. Callouts

Subtle by design. A slightly different charcoal, a small monochrome icon, muted text — never a bright blue information box.

```css
.callout {
  background: rgba(255,255,255,0.022);
  border: 1px solid var(--border-subtle);
  border-left: 2px solid rgba(255,255,255,0.10);
  border-radius: var(--radius-code);
  padding: 14px 16px;
  color: var(--text-secondary);
  font-size: 14px;
}
```

Warning and caution variants may shift the left border to a desaturated amber (`#8A7C5E`) or muted rust (`#8A6A62`) — nothing brighter. Note and tip stay fully neutral.

---

## 12. Typography

Sans: **Inter**, with Geist, SF Pro, IBM Plex Sans, Manrope, Söhne as alternatives.
Mono: **JetBrains Mono**, with Berkeley Mono, Geist Mono, IBM Plex Mono as alternatives.

Nothing futuristic. Documentation has to stay serious and readable.

| Element | Size | Weight | Colour |
|---|---|---|---|
| H1 | 30–34px | 600 | `--text-heading` |
| H2 | 21–23px | 600 | `--text-heading` |
| H3 | 16–17px | 600 | `--text-primary` |
| Body | 15px / 1.7 | 400 | `--text-secondary` |
| Code | 13px / 1.65 | 400 | `--text-primary` |
| Labels | 11px, uppercase, 0.06em | 500 | `--text-muted` |

Headings are soft white, never `#FFFFFF`. Body text is grey, never pure white. The low contrast is deliberate — it's what makes long reading sessions comfortable, and raising it to "accessible-looking" contrast ratios breaks the entire feel. Keep body text at or above `--text-secondary`; that's the floor.

Vertical rhythm: ~32px above an H2, ~24px above an H3, ~16px between paragraphs.

---

## 13. Buttons and inputs

Understated. Dark background, subtle outline, soft grey text.

```css
.button {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-visible);
  border-radius: var(--radius-control);
  color: var(--text-primary);
  font-size: 13px;
  padding: 7px 14px;
  transition: background var(--dur-base) var(--ease);
}
.button:hover { background: rgba(255,255,255,0.055); }
.button:active { background: rgba(255,255,255,0.04); }
```

No glowing buttons. No bright primary colour unless the user explicitly asks for one. The interface stays calm even when it's interactive.

---

## 14. Motion

Slow, small, deliberate. 150–250ms on `--ease`.

Animate background alpha, opacity, and translations of 1–2px. Nothing bounces, nothing scales dramatically, nothing springs. The interface should feel stable — motion is feedback, not personality.

Respect `prefers-reduced-motion` and drop to instant transitions.

---

## 15. Prohibited

- Glassmorphism, blur-heavy panels, frosted surfaces
- Gloss, shine, reflections, metallic or plastic finishes
- Glow effects of any kind
- Neon, cyberpunk, saturated accents
- Blue-tinted greys or purple-heavy palettes
- Pure `#000000` backgrounds or pure `#FFFFFF` text
- High contrast throughout
- Cards for the sidebar, TOC, or header
- A card-grid dashboard aesthetic
- More than three depth levels
- Dramatic shadows or hard borders
- Radii below 8px or pill shapes on content surfaces
- Marketing-page patterns — hero sections, gradient CTAs, decorative illustration

If the user asks for something on this list, build it their way — but say which rule it breaks first, so it's a decision rather than an accident.
