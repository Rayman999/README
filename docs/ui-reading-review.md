# Reading experience review

> **Superseded (Oct 2026).** The sage accent and the separate "reading-first" palette described below were replaced by a single neutral system with Graphite and Paper themes, reader preferences, and reading-progress features. `theme.md` is the current reference.

Reviewed all nine page types: library, project overview, document reader, writing studio, component guide, new project, login, profile, and agent connections, plus the OAuth approval screen.

## Implemented

- Shared styling: stronger text contrast, visible keyboard focus, skip navigation, larger inputs, responsive document spacing, sage accents, and clearer heading hierarchy.
- Library: reader-oriented introduction, clearer project cards, direct access to nested projects.
- Project: prominent documentation entry point and readable page descriptions.
- Reader: estimated reading time, document-position indicator, optional outline, persistent larger-text preference, focus mode, reflection prompts, and explicit draft/deprecated guidance.
- Navigation: functional project page-title filtering; removed inactive header controls; native modal navigation for mobile keyboard containment and Escape handling.
- Studio and project creation: clearer writing guidance and workflow cues.
- Guide: live examples of the reading controls.
- Login: learning-oriented introduction.
- Profile and OAuth approval: inherited accessible shared controls and skip targets; retained permission semantics.
- Connections: expandable setup instructions to reduce the amount of information shown at once.

## Validation

TypeScript, ESLint, git diff whitespace checks, and all eight document tests passed. Browser inspection verified the guide at desktop and 390px mobile widths, including larger text and outline expansion.

The library browser walkthrough was blocked by an Invalid URL exception inside auth(). Authenticated pages have been reviewed in source but are not visually verified in this environment. No authentication configuration or permissions were changed.

## Design intent

Readers can preview structure before committing, adjust reading size, remove side navigation while focusing, and voluntarily recall or apply what they read. These features support comprehension without imposing scores, streaks, or forced interactions. Reading position indicates scrolling, not learning completion. Text-size preferences stay in this browser and are not synced to an account.
