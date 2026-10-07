import "server-only";
import { z } from "zod";
import { BOOLEAN_PREFS, MAX_PRESETS, NUMBER_PREFS, OTHER_OPTIONS, PREF_OPTIONS, type ReadingPrefs } from "./prefs";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const number = (key: keyof typeof NUMBER_PREFS) => z.number().min(NUMBER_PREFS[key].min).max(NUMBER_PREFS[key].max);

const shape = {
  ...Object.fromEntries(Object.entries(PREF_OPTIONS).map(([key, values]) => [key, z.enum(values as unknown as [string, ...string[]])])),
  ...Object.fromEntries(Object.entries(OTHER_OPTIONS).map(([key, values]) => [key, z.enum(values as unknown as [string, ...string[]])])),
  ...Object.fromEntries(BOOLEAN_PREFS.map((key) => [key, z.boolean()])),
  wpm: number("wpm"),
  scrollSpeed: number("scrollSpeed"),
  voiceRate: number("voiceRate"),
  voice: z.string().max(200),
  dayStart: time,
  nightStart: time,
};

export const prefsSchema = z.object(shape) as unknown as z.ZodType<ReadingPrefs>;

export const presetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(40),
  // Presets carry only part of the prefs (the look); unknown keys are dropped.
  prefs: z.object(shape).partial(),
});

export const presetsSchema = z.array(presetSchema).max(MAX_PRESETS);

/** project slug → preset id */
export const projectPresetsSchema = z.record(
  z.string().regex(/^[a-z0-9-]{1,120}$/),
  z.string().regex(/^[a-z0-9-]{1,60}$/),
).refine((value) => Object.keys(value).length <= 200, "Too many project presets.");
