import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { highlights, pages, projects, readerProfiles, readingProgress, sections } from "@/db/schema";
import type { ReadingPreset, ReadingPrefs } from "./prefs";

// Every query here is scoped by the signed-in user's id. Reading data is
// personal: there is deliberately no way to read someone else's.

export async function getReaderProfile(userId: string) {
  const row = await db.query.readerProfiles.findFirst({ where: eq(readerProfiles.userId, userId) });
  return row ? { prefs: row.prefs, presets: row.presets } : null;
}

export async function saveReaderProfile(
  userId: string,
  patch: { prefs?: ReadingPrefs; presets?: ReadingPreset[] },
  fallbackPrefs: ReadingPrefs,
) {
  await db
    .insert(readerProfiles)
    .values({ userId, prefs: patch.prefs ?? fallbackPrefs, presets: patch.presets ?? [] })
    .onConflictDoUpdate({
      target: readerProfiles.userId,
      set: {
        ...(patch.prefs ? { prefs: patch.prefs } : {}),
        ...(patch.presets ? { presets: patch.presets } : {}),
        updatedAt: new Date(),
      },
    });
}

export type ProgressRecord = { progress: number; y: number; done: boolean; at: number };

export async function getProgressForProject(userId: string, projectId: string) {
  const rows = await db
    .select({
      pageId: readingProgress.pageId,
      progress: readingProgress.progress,
      y: readingProgress.scrollY,
      done: readingProgress.done,
      at: readingProgress.updatedAt,
    })
    .from(readingProgress)
    .innerJoin(pages, eq(readingProgress.pageId, pages.id))
    .where(and(eq(readingProgress.userId, userId), eq(pages.projectId, projectId)));
  return Object.fromEntries(
    rows.map((row) => [row.pageId, { progress: row.progress, y: row.y, done: row.done, at: row.at.getTime() }]),
  ) as Record<string, ProgressRecord>;
}

export async function saveProgress(userId: string, pageId: string, input: { progress: number; y: number; done: boolean }) {
  // Progress only ever moves forward and "done" is sticky; the scroll offset
  // is simply the latest position.
  await db
    .insert(readingProgress)
    .values({ userId, pageId, progress: input.progress, scrollY: input.y, done: input.done })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.pageId],
      set: {
        progress: sql`greatest(${readingProgress.progress}, excluded.progress)`,
        scrollY: sql`excluded.scroll_y`,
        done: sql`${readingProgress.done} or excluded.done`,
        updatedAt: new Date(),
      },
    });
}

/** A live page in this workspace, or null. */
export async function findReadablePage(workspaceId: string, pageId: string) {
  const [row] = await db
    .select({ id: pages.id })
    .from(pages)
    .innerJoin(projects, eq(pages.projectId, projects.id))
    .where(and(eq(pages.id, pageId), eq(projects.workspaceId, workspaceId), isNull(pages.deletedAt)))
    .limit(1);
  return row ?? null;
}

export type Highlight = { id: string; quote: string; prefix: string; suffix: string; note: string | null; createdAt: string };

const highlightColumns = {
  id: highlights.id,
  quote: highlights.quote,
  prefix: highlights.prefix,
  suffix: highlights.suffix,
  note: highlights.note,
  createdAt: highlights.createdAt,
};

export async function listHighlightsForPage(userId: string, pageId: string): Promise<Highlight[]> {
  const rows = await db
    .select(highlightColumns)
    .from(highlights)
    .where(and(eq(highlights.userId, userId), eq(highlights.pageId, pageId)))
    .orderBy(highlights.createdAt);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function listAllHighlights(userId: string, workspaceId: string, projectId?: string) {
  return db
    .select({
      ...highlightColumns,
      pageTitle: pages.title,
      pageSlug: pages.slug,
      sectionSlug: sections.slug,
      projectName: projects.name,
      projectSlug: projects.slug,
    })
    .from(highlights)
    .innerJoin(pages, eq(highlights.pageId, pages.id))
    .innerJoin(projects, eq(pages.projectId, projects.id))
    .leftJoin(sections, eq(pages.sectionId, sections.id))
    .where(and(
      eq(highlights.userId, userId),
      eq(projects.workspaceId, workspaceId),
      isNull(pages.deletedAt),
      projectId ? eq(projects.id, projectId) : undefined,
    ))
    .orderBy(desc(highlights.createdAt));
}

export async function createHighlight(userId: string, pageId: string, input: { quote: string; prefix: string; suffix: string; note?: string | null }) {
  const [row] = await db
    .insert(highlights)
    .values({ userId, pageId, quote: input.quote, prefix: input.prefix, suffix: input.suffix, note: input.note || null })
    .returning(highlightColumns);
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function updateHighlightNote(userId: string, id: string, note: string | null) {
  const [row] = await db
    .update(highlights)
    .set({ note: note || null, updatedAt: new Date() })
    .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
    .returning({ id: highlights.id });
  return row ?? null;
}

export async function deleteHighlight(userId: string, id: string) {
  const [row] = await db
    .delete(highlights)
    .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
    .returning({ id: highlights.id });
  return row ?? null;
}
