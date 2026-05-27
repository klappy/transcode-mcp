import { z } from "zod";

// Parses the comma-separated `key=value` options segment into a flat record.
// Values stay strings here; MediaOptionsSchema coerces them.
export const RawOptionsSchema = z.string().transform((raw) => {
  const out: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    out[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  return out;
});

export const MediaOptionsSchema = z.object({
  media_type: z.enum(["image", "audio"]),
  w: z.coerce.number().int().positive().optional(),
  h: z.coerce.number().int().positive().optional(),
  q: z.enum(["low", "medium", "high"]).optional(),
  f: z.enum(["auto", "avif", "webp", "jpeg"]).optional(),
  preset: z.string().optional(),
});

export type MediaOptions = z.infer<typeof MediaOptionsSchema>;
