import "server-only";
import { z } from "zod";
import { MAX_PRESETS, PREF_OPTIONS, type ReadingPreset, type ReadingPrefs } from "./prefs";

export const prefsSchema = z.object({
  theme: z.enum(PREF_OPTIONS.theme),
  face: z.enum(PREF_OPTIONS.face),
  size: z.enum(PREF_OPTIONS.size),
  measure: z.enum(PREF_OPTIONS.measure),
  leading: z.enum(PREF_OPTIONS.leading),
  focus: z.boolean(),
  paragraphFocus: z.boolean(),
  ruler: z.boolean(),
  autoHideHeader: z.boolean(),
}) satisfies z.ZodType<ReadingPrefs>;

export const presetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(40),
  prefs: prefsSchema,
}) satisfies z.ZodType<ReadingPreset>;

export const presetsSchema = z.array(presetSchema).max(MAX_PRESETS);
