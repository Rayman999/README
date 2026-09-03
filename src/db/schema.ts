import { sql } from "drizzle-orm";
import type { ReadmeDocument } from "@/lib/documents/schema";
import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ---------------------------------------------------------------------------
// Users + Auth.js tables
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // Auth.js expects `image`; BUILD.md names the column avatar_url — map it.
  image: text("avatar_url"),
  // bcrypt hash. Null for accounts created through GitHub, which have no
  // password of their own.
  passwordHash: text("password_hash"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // Public read is a workspace-level setting, default off (BUILD.md §11).
  publicRead: boolean("public_read").notNull().default(false),
  // When closed, only people the owner adds can join. The first person to
  // sign in bootstraps the workspace and becomes its owner.
  registrationOpen: boolean("registration_open").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(), // lowercase-kebab, immutable
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    status: text("status", {
      enum: ["active", "maintenance", "archived", "planned"],
    })
      .notNull()
      .default("active"),
    version: text("version"),
    // One level of nesting only — enforced in the application layer.
    parentId: uuid("parent_id").references((): AnyPgColumn => projects.id, {
      onDelete: "set null",
    }),
    repositoryUrl: text("repository_url"),
    stack: text("stack").array().notNull().default(sql`'{}'::text[]`),
    entrypoints: text("entrypoints").array().notNull().default(sql`'{}'::text[]`),
    conventions: text("conventions").array().notNull().default(sql`'{}'::text[]`),
    glossary: jsonb("glossary")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    openQuestions: text("open_questions").array().notNull().default(sql`'{}'::text[]`),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("projects_workspace_slug_idx").on(t.workspaceId, t.slug),
    index("projects_parent_idx").on(t.parentId),
  ],
);

export const projectLinks = pgTable(
  "project_links",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    linkedProjectId: uuid("linked_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.linkedProjectId] })],
);

// ---------------------------------------------------------------------------
// Sections + pages
// ---------------------------------------------------------------------------

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("sections_project_slug_idx").on(t.projectId, t.slug)],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => sections.id, {
      onDelete: "set null",
    }), // null = top-level page
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    body: text("body").notNull(), // legacy Markdown or derived structured-document search text
    document: jsonb("document").$type<ReadmeDocument>(),
    version: integer("version").notNull().default(1),
    status: text("status", { enum: ["draft", "stable", "deprecated"] })
      .notNull()
      .default("draft"),
    position: integer("position").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    extendsPageId: uuid("extends_page_id").references(
      (): AnyPgColumn => pages.id,
      { onDelete: "set null" },
    ), // "builds on" relationship
    authorType: text("author_type", { enum: ["human", "agent"] }).notNull(),
    // DELETE /pages/:page is a soft delete (BUILD.md §6); this is the marker.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(body, '')), 'C')
      `,
    ),
  },
  (t) => [
    uniqueIndex("pages_project_slug_idx").on(t.projectId, t.slug),
    index("pages_search_idx").using("gin", t.searchVector),
    index("pages_section_idx").on(t.sectionId),
  ],
);

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    document: jsonb("document").$type<ReadmeDocument>(),
    title: text("title").notNull(),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorType: text("author_type", { enum: ["human", "agent"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    agentConnectionId: uuid("agent_connection_id"),
  },
  (t) => [index("page_revisions_page_idx").on(t.pageId)],
);

// ---------------------------------------------------------------------------
// API tokens
// ---------------------------------------------------------------------------

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  scopes: text("scopes").array().notNull().default(sql`'{"read"}'::text[]`),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Owner-registered OAuth clients. Redirect URIs are exact matches; no public
// registration or arbitrary metadata fetching is exposed by this deployment.
export const oauthClients = pgTable("oauth_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Confidential clients (ChatGPT) authenticate with a secret at the token
  // endpoint. Public clients (Codex, and any other native/CLI app that cannot
  // keep a secret) authenticate with PKCE alone and have no secret at all --
  // hence the nullable hash. The default keeps every existing row confidential.
  clientType: text("client_type", { enum: ["confidential", "public"] }).notNull().default("confidential"),
  secretHash: text("secret_hash"),
  redirectUris: text("redirect_uris").array().notNull(),
  scopes: text("scopes").array().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthGrants = pgTable("oauth_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  rateWindow: timestamp("rate_window", { withTimezone: true }).notNull().defaultNow(),
  requestCount: integer("request_count").notNull().default(0),
  writeCount: integer("write_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("oauth_grants_user_idx").on(t.userId)]);

export const oauthCodes = pgTable("oauth_codes", {
  hash: text("hash").primaryKey(),
  grantId: uuid("grant_id").notNull().references(() => oauthGrants.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  challenge: text("challenge").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const oauthTokens = pgTable("oauth_tokens", {
  hash: text("hash").primaryKey(),
  grantId: uuid("grant_id").notNull().references(() => oauthGrants.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["access", "refresh"] }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (t) => [index("oauth_tokens_grant_idx").on(t.grantId), index("oauth_tokens_expiry_idx").on(t.expiresAt)]);
