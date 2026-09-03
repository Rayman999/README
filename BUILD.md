# readme — build brief

A build specification for an AI agent. Read this file completely, then read `theme.md` before writing any UI code.

---

## 0. How to use this document

Build in the phases described in section 12. Each phase has acceptance criteria — meet them before moving on. Don't scaffold the whole application at once.

Two rules that override your defaults:

**The visual design is pinned, not open.** `theme.md` is the complete visual specification. Follow it exactly. Do not substitute a component library's default styling, do not add an accent colour, do not raise the contrast because it looks low. If something in the theme seems wrong, build it as specified and raise the concern separately.

**Ask before inventing.** Where this brief leaves a decision open, it says so. Where it's silent and the decision is architectural, ask rather than guessing.

---

## 1. What this is

`readme` is a documentation wiki application. Teams create projects, write documentation pages inside them, and link projects to each other. Content lives in a database and is edited in the app.

The distinguishing feature is that it's built to be written by AI agents as much as by humans. Every project carries a structured context record that an agent can read to understand the project in one call, and there's an MCP server exposing the whole thing as tools. An agent working on a codebase can create the project, write the pages, and keep them current without a human copying markdown around.

**Primary users:** developers documenting their own projects, and AI agents writing on their behalf.

**Core loop:** a developer or agent creates a project → writes pages → the wiki renders them → the next agent reads the project context and continues where the last one stopped.

---

## 2. Non-negotiables

- Markdown is the storage format for page bodies. Not a rich-text JSON blob, not HTML. Agents write markdown; the app stores exactly what was written.
- Every project has a machine-readable context record, retrievable in one API call.
- The API and the MCP server expose the same capabilities as the UI. Nothing is UI-only.
- The visual design follows `theme.md` exactly.
- Slugs are stable. Renaming a project changes its display name, never its slug.

---

## 3. Stack

You have latitude here, but these are the defaults. Deviate only for a concrete reason, and say what it is.

| Layer | Default |
|---|---|
| Framework | Next.js 15, App Router, TypeScript, strict mode |
| Styling | Tailwind CSS with the `theme.md` tokens defined as CSS custom properties in the base layer |
| Database | PostgreSQL |
| ORM | Drizzle |
| Auth | Auth.js (GitHub + email magic link) |
| Markdown | `unified` / `remark` / `rehype` pipeline, rendered server-side |
| Syntax highlighting | Shiki, with a custom theme built from the `--syn-*` tokens |
| Editor | CodeMirror 6, markdown mode |
| Hosting | Vercel + a managed Postgres (Neon or Supabase) |
| MCP | Separate route handler in the same app, HTTP transport |

Do not add a UI component library. The design is specific enough that shadcn/Radix defaults will fight it — build the components directly. Radix primitives for accessibility behaviour only (dialog, dropdown, tooltip) are fine, styled from scratch.

---

## 4. Data model

Postgres. Adjust naming to your ORM's conventions, but keep the shape.

```sql
users
  id            uuid pk
  email         text unique not null
  name          text
  avatar_url    text
  created_at    timestamptz

workspaces                    -- one wiki instance
  id            uuid pk
  slug          text unique not null
  name          text not null
  created_at    timestamptz

workspace_members
  workspace_id  uuid fk
  user_id       uuid fk
  role          text not null      -- owner | editor | viewer
  primary key (workspace_id, user_id)

projects
  id              uuid pk
  workspace_id    uuid fk
  slug            text not null           -- lowercase-kebab, immutable
  name            text not null
  summary         text not null           -- 1–2 sentences
  status          text not null           -- active | maintenance | archived | planned
  version         text
  parent_id       uuid fk projects null   -- one level of nesting only
  repository_url  text
  stack           text[]                  -- ["Node.js 20", "Fastify 4"]
  entrypoints     text[]
  conventions     text[]                  -- project-specific rules agents must follow
  glossary        jsonb                   -- { term: definition }
  open_questions  text[]
  tags            text[]
  created_at      timestamptz
  updated_at      timestamptz
  unique (workspace_id, slug)

project_links                             -- peer relationships, non-hierarchical
  project_id       uuid fk
  linked_project_id uuid fk
  primary key (project_id, linked_project_id)

sections                                  -- nav groups within a project
  id           uuid pk
  project_id   uuid fk
  slug         text not null
  title        text not null
  position     int not null
  unique (project_id, slug)

pages
  id            uuid pk
  project_id    uuid fk
  section_id    uuid fk null              -- null = top-level page
  slug          text not null
  title         text not null
  description   text not null             -- one sentence, shown under title and in search
  body          text not null             -- markdown source
  status        text not null             -- draft | stable | deprecated
  position      int not null
  tags          text[]
  extends_page_id uuid fk pages null      -- "builds on" relationship
  author_type   text not null             -- human | agent
  created_at    timestamptz
  updated_at    timestamptz
  search_vector tsvector                  -- generated
  unique (project_id, slug)

page_revisions
  id          uuid pk
  page_id     uuid fk
  body        text not null
  title       text not null
  author_id   uuid fk users null
  author_type text not null
  created_at  timestamptz

api_tokens
  id            uuid pk
  workspace_id  uuid fk
  name          text not null
  token_hash    text not null
  scopes        text[]                    -- ["read"] | ["read","write"]
  last_used_at  timestamptz
  created_at    timestamptz
```

Notes:

**Revisions are append-only.** Write one on every page update. This is what makes agent-written docs safe — a bad automated edit is recoverable. Don't build a diff UI in v1; just store them and expose a list.

**`conventions` and `open_questions` are the highest-value fields in the schema.** They're what an agent reads to avoid repeating decisions. Make them first-class in the UI, not buried in a settings tab.

**`parent_id` is one level deep.** Enforce it — reject a project whose parent already has a parent. Deeper hierarchies break the two-level sidebar.

**Search:** a generated `tsvector` over title, description, and body, with title weighted highest. Postgres full-text is sufficient here; don't reach for an external search service.

---

## 5. Project context record

The single most important API response. `GET /api/projects/:slug/context` returns everything an agent needs to work on a project:

```json
{
  "slug": "payments-api",
  "name": "Payments API",
  "summary": "Internal service handling card capture, refunds, and payout scheduling.",
  "status": "active",
  "version": "2.4.0",
  "parent": null,
  "children": ["payments-api-webhooks"],
  "related": ["ledger-service"],
  "stack": ["Node.js 20", "Fastify 4", "PostgreSQL 15"],
  "entrypoints": ["src/server.ts"],
  "conventions": ["All money values are integer cents", "Errors follow RFC 7807"],
  "glossary": { "capture": "Moving an authorised charge to settled" },
  "open_questions": ["Retry policy for failed payouts is undecided"],
  "sections": [
    {
      "slug": "getting-started",
      "title": "Getting Started",
      "pages": [
        { "slug": "installation", "title": "Installation", "description": "Install the app and configure your first project.", "status": "stable" }
      ]
    }
  ],
  "updated_at": "2026-08-31T10:00:00Z"
}
```

Page bodies are excluded — this is the map, not the territory. An agent reads the context, then fetches the specific pages it needs.

Also expose `GET /api/projects/:slug/context.md`, the same data as a formatted markdown block for pasting into a chat. Prose summary first so a human can skim, JSON after so a machine can parse.

---

## 6. REST API

Token auth via `Authorization: Bearer <token>`, checked against `api_tokens`. Session auth for the UI.

```
GET    /api/projects                        list, filterable by tag/status/parent
POST   /api/projects                        create
GET    /api/projects/:slug                  detail
PATCH  /api/projects/:slug                  update (slug immutable)
GET    /api/projects/:slug/context          context record
GET    /api/projects/:slug/context.md       context as markdown
POST   /api/projects/:slug/links            link to a peer project (creates both directions)
DELETE /api/projects/:slug/links/:other

GET    /api/projects/:slug/pages            list (metadata only)
POST   /api/projects/:slug/pages            create
GET    /api/projects/:slug/pages/:page      full page incl. markdown body
PATCH  /api/projects/:slug/pages/:page      update, writes a revision
DELETE /api/projects/:slug/pages/:page      soft delete
GET    /api/projects/:slug/pages/:page/revisions

GET    /api/sections                        per project
POST   /api/sections
PATCH  /api/sections/:id                    rename or reorder

GET    /api/search?q=                       full-text across pages
```

Validate request bodies with Zod. Return errors as RFC 7807 `problem+json` — the schema is agent-facing and vague errors cost an agent a round trip.

`POST` and `PATCH` on pages must accept raw markdown in `body`. No transformation on write; store what was sent.

---

## 7. MCP server

An HTTP MCP endpoint at `/api/mcp`, authenticated with the same bearer tokens. This is how Claude Code and other agents connect.

Tools to expose:

| Tool | Purpose |
|---|---|
| `list_projects` | All projects with slug, name, summary, status |
| `get_project_context` | The context record for one project |
| `create_project` | New project, optionally under a parent |
| `update_project` | Update summary, conventions, open questions, stack, status |
| `list_pages` | Page metadata for a project |
| `get_page` | Full markdown body of one page |
| `create_page` | New page in a section |
| `update_page` | Replace or patch a page body |
| `link_projects` | Create a reciprocal peer link |
| `search` | Full-text search across the workspace |

Tool descriptions matter as much as the implementation — they're the agent's only documentation. Write them so an agent knows when to use each one without trial and error. `get_project_context` in particular should say plainly that it's the first call to make when starting work on a project.

Every write through MCP sets `author_type: "agent"` and creates a revision.

---

## 8. Routes and pages

```
/                                  workspace home — project grid, recent activity
/login
/p/:project                        project landing (rendered from summary + section list)
/p/:project/:section/:page         a documentation page
/p/:project/settings               project metadata, conventions, open questions, links
/p/:project/new                    create a page
/p/:project/:section/:page/edit    edit a page
/new                               create a project
/search?q=
/settings/tokens                   API token management
```

The three-column layout in `theme.md` applies to `/p/*` routes. Home, search, and settings use the same shell but may drop the right column.

---

## 9. UI specification

Read `theme.md` in full. The essentials, restated:

The application is one flat matte near-black surface. The header, left navigation, and right table of contents are carved into it — no cards, no backgrounds of their own. The centre documentation panel is the only elevated object, rising out of the shell through a soft ramp rather than sitting on it as a card. Code blocks are inset one level below the panel. Three depth levels total.

The palette is fully neutral — black, graphite, charcoal, soft white. No accent colour anywhere. **Never blue-tinted.** Emphasis comes from brightness, space, and elevation, not hue.

Components to build:

- **App shell** — header + three columns, responsive down to mobile (sidebar becomes a drawer, TOC collapses)
- **Project switcher** — dropdown in the header, lists projects with their summaries
- **File tree nav** — sections expand and collapse, current page highlighted with a charcoal row, state persisted
- **Table of contents** — generated from `##` and `###`, active entry tracked on scroll with an intersection observer, transition slow enough to drift rather than snap
- **Markdown renderer** — headings with anchors, tables, GitHub alert callouts (`> [!NOTE]` etc.), code blocks with optional `title=`, internal link resolution
- **Code block** — inset surface, muted Shiki theme, copy button revealed on hover
- **Search** — header input, `⌘K` overlay, results grouped by project
- **Editor** — see below
- **Prev/next footer** — derived from section order

The ramp effect is the hardest part of the design and the part most likely to come out wrong. It is not a card with a drop shadow. Build it with a layered radial gradient bleeding into the shell plus a very large, very faint shadow, exactly as specified in `theme.md`, and check it visually before moving on. If you can clearly identify a gradient or a shadow edge, it's too strong.

---

## 10. Editor

Split view: CodeMirror markdown source on the left, live preview on the right, using the same renderer as the published page so what you see is what ships.

- Markdown mode with syntax highlighting matching the `--syn-*` palette
- A slim toolbar: bold, italic, link, code block, table, callout. Nothing more — this is a markdown editor, not a word processor.
- Frontmatter-equivalent fields (title, description, status, tags, section, position) in a collapsible metadata panel, not in the markdown body. The body is pure content; metadata lives in columns.
- Autosave as a draft every few seconds; explicit publish writes the revision
- Unsaved-changes guard on navigation
- `⌘S` saves

Preview must render callouts, tables, and code blocks identically to the published page. A preview that diverges from the output is worse than no preview.

---

## 11. Auth and permissions

Public deployment, so this has to be real from the start.

- Auth.js with GitHub OAuth and email magic link
- Roles: `owner` (everything incl. tokens and members), `editor` (create/edit projects and pages), `viewer` (read)
- Public read is a workspace-level setting. Default off.
- API tokens are workspace-scoped, hashed at rest, shown once at creation, with `read` or `read,write` scopes
- Rate limit the API and MCP endpoints per token
- Sanitise rendered markdown — `rehype-sanitize` with a strict schema. Agent-written content is untrusted input; raw HTML in a page body must not execute.

That last point is not optional. The entire premise is that automated systems write content into this app.

---

## 12. Build phases

### Phase 1 — Foundation
Next.js + TypeScript + Tailwind. `theme.md` tokens as CSS custom properties. Database schema and migrations. Auth with GitHub and magic link.

*Done when:* a user can sign in, the schema is migrated, and the tokens are usable in components.

### Phase 2 — The shell
Header, three-column layout, flat sidebar, flat TOC, raised content panel with the ramp. Static placeholder content.

*Done when:* the shell matches `theme.md` — one flat surface, exactly one elevated panel, three depth levels, no accent colour, and the ramp reads as a slope rather than a card edge. Compare against the spec explicitly before continuing.

### Phase 3 — Content
Projects and pages CRUD. Markdown pipeline with Shiki, callouts, tables, anchors. Nav tree from real sections. TOC from real headings. Rendered pages at `/p/:project/:section/:page`.

*Done when:* a page written in markdown renders correctly with code blocks, a table, and a callout, and navigation reflects the database.

### Phase 4 — Authoring
Editor with split preview, metadata panel, autosave, revisions. Project settings page including conventions and open questions.

*Done when:* a page can be created and edited entirely in the app and revisions accumulate.

### Phase 5 — API and MCP
REST endpoints, token management, MCP server with the tools in section 7.

*Done when:* Claude Code can connect to the MCP server, call `get_project_context`, create a page, and see it rendered in the UI.

### Phase 6 — Search and relationships
Full-text search with `⌘K`. Project links, parent/child nesting, cross-project link resolution, `extends` relationships.

*Done when:* search returns weighted results and links resolve in both directions.

### Phase 7 — Deploy
Vercel, managed Postgres, migrations in CI, error tracking.

---

## 13. Seed data

Seed with one realistic project of six to eight pages, using content that actually exercises the layout: a long code block, a wide table, a heading that wraps, a page with only two sections, a page with fifteen.

Do not seed with lorem ipsum. Documentation layouts look fine with fake content and fall apart with real content, and you won't discover the failures until it's too late to fix them cheaply.

---

## 14. Out of scope for v1

Comments. Multi-workspace switching. Versioned doc sets. Real-time collaborative editing. Diff visualisation. Custom themes. Analytics. Export to PDF. Git sync.

Several of these are good ideas. None of them are the point, and each one makes the core harder to get right.

---

## 15. What good looks like

Someone opens a documentation page and it feels like a well-made desktop application rather than a website. The content panel sits slightly above a quiet dark surface, and they can't immediately tell how that effect was achieved. They read for an hour without eye strain.

An agent connects over MCP, calls one tool, and understands the project well enough to write a page that fits the existing documentation in structure, depth, and tone.

Nothing on screen is trying to get attention.
