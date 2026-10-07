import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { highlights, pages, projects, readerProfiles, readingDays, readingProgress, sections } from "@/db/schema";
import type { ReadingPreset, ReadingPrefs } from "./prefs";

// Every query here is scoped by the signed-in user's id. Reading data is
// personal: there is deliberately no way to read someone else's.

export async function getReaderProfile(userId: string) {
  const row = await db.query.readerProfiles.findFirst({ where: eq(readerProfiles.userId, userId) });
  return row ? { prefs: row.prefs, presets: row.presets, projectPresets: row.projectPresets ?? {} } : null;
}

export async function saveReaderProfile(
  userId: string,
  patch: { prefs?: ReadingPrefs; presets?: ReadingPreset[]; projectPresets?: Record<string, string> },
  fallbackPrefs: ReadingPrefs,
) {
  await db
    .insert(readerProfiles)
    .values({ userId, prefs: patch.prefs ?? fallbackPrefs, presets: patch.presets ?? [], projectPresets: patch.projectPresets ?? {} })
    .onConflictDoUpdate({
      target: readerProfiles.userId,
      set: {
        ...(patch.prefs ? { prefs: patch.prefs } : {}),
        ...(patch.presets ? { presets: patch.presets } : {}),
        ...(patch.projectPresets ? { projectPresets: patch.projectPresets } : {}),
        updatedAt: new Date(),
      },
    });
}

/** Adds active reading time (and a finished page) to the reader's local day. */
export async function recordActivity(userId: string, day: string, seconds: number, finished: number) {
  await db
    .insert(readingDays)
    .values({ userId, day, seconds, pagesFinished: finished })
    .onConflictDoUpdate({
      target: [readingDays.userId, readingDays.day],
      set: {
        // Cap a day at 24h however the client misbehaves.
        seconds: sql`least(${readingDays.seconds} + excluded.seconds, 86400)`,
        pagesFinished: sql`${readingDays.pagesFinished} + excluded.pages_finished`,
      },
    });
}

export type ReadingStats = {
  week: { day: string; seconds: number; pages: number }[];
  weekSeconds: number;
  weekPages: number;
  streak: number;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The last seven days ending on `today` (the reader's local date), and the
 * streak: consecutive days with at least a minute of reading, ending today —
 * or yesterday, so a streak isn't "lost" before you've read today.
 */
export async function getReadingStats(userId: string, today: string): Promise<ReadingStats> {
  const rows = await db
    .select({ day: readingDays.day, seconds: readingDays.seconds, pages: readingDays.pagesFinished })
    .from(readingDays)
    .where(and(eq(readingDays.userId, userId), sql`${readingDays.day} > (${today}::date - 400)`))
    .orderBy(desc(readingDays.day));
  const byDay = new Map(rows.map((row) => [String(row.day), row]));
  const end = new Date(`${today}T00:00:00Z`);
  const back = (n: number) => iso(new Date(end.getTime() - n * 86_400_000));

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = back(6 - i);
    const row = byDay.get(day);
    return { day, seconds: row?.seconds ?? 0, pages: row?.pages ?? 0 };
  });

  const active = (day: string) => (byDay.get(day)?.seconds ?? 0) >= 60;
  let start = active(back(0)) ? 0 : active(back(1)) ? 1 : -1;
  let streak = 0;
  if (start >= 0) while (active(back(start++))) streak += 1;

  return {
    week,
    weekSeconds: week.reduce((sum, entry) => sum + entry.seconds, 0),
    weekPages: week.reduce((sum, entry) => sum + entry.pages, 0),
    streak,
  };
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
