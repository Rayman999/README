import { z } from "zod";
import { requireSession } from "@/lib/api/context";
import { badRequest, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { getReadingStats, recordActivity } from "@/lib/reading/server";

// The client sends its own local date so "today" and streaks follow the
// reader's clock, not the server's. A single report is capped at ten minutes.
const postSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seconds: z.number().int().min(0).max(600),
  finished: z.number().int().min(0).max(5),
});

/** This week's reading and the current streak, relative to the reader's local `day`. */
export async function GET(req: Request) {
  const session = await requireSession();
  if (!session?.user.id) return unauthorized("Sign in to see reading stats.");
  const day = new URL(req.url).searchParams.get("day") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return badRequest("Pass ?day=YYYY-MM-DD (your local date).");
  return Response.json(await getReadingStats(session.user.id, day));
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session?.user.id) return unauthorized("Sign in to record reading time.");
  const parsed = postSchema.safeParse(await readJson(req, 1024).catch(() => null));
  if (!parsed.success) return badRequest("Activity did not match the expected shape.", { errors: parsed.error.issues });
  const { day, seconds, finished } = parsed.data;
  // Reject dates far from now; a client clock can be off by a day, not more.
  const delta = Math.abs(new Date(`${day}T12:00:00Z`).getTime() - Date.now());
  if (Number.isNaN(delta) || delta > 2 * 86_400_000) return badRequest("That date is too far from today.");
  if (seconds > 0 || finished > 0) await recordActivity(session.user.id, day, seconds, finished);
  return new Response(null, { status: 204 });
}
