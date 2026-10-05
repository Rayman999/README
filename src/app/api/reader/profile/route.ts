import { z } from "zod";
import { requireSession } from "@/lib/api/context";
import { badRequest, unauthorized } from "@/lib/api/problem";
import { readJson } from "@/lib/api/read-json";
import { DEFAULT_PREFS } from "@/lib/reading/prefs";
import { prefsSchema, presetsSchema } from "@/lib/reading/prefs-schema";
import { getReaderProfile, saveReaderProfile } from "@/lib/reading/server";

const putSchema = z
  .object({
    prefs: prefsSchema.optional(),
    presets: presetsSchema.optional(),
  })
  .refine((body) => body.prefs || body.presets, "Send prefs, presets, or both.");

export async function GET() {
  const session = await requireSession();
  if (!session?.user.id) return unauthorized("Sign in to load your reading settings.");
  return Response.json((await getReaderProfile(session.user.id)) ?? { prefs: DEFAULT_PREFS, presets: [] });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  if (!session?.user.id) return unauthorized("Sign in to save your reading settings.");
  const parsed = putSchema.safeParse(await readJson(req, 32 * 1024).catch(() => null));
  if (!parsed.success) {
    return badRequest("Reading settings did not match the expected shape.", { errors: parsed.error.issues });
  }
  await saveReaderProfile(session.user.id, parsed.data, DEFAULT_PREFS);
  return new Response(null, { status: 204 });
}
