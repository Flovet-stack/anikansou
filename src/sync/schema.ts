import { z } from "zod";

/**
 * Mirrors `schemas/anime-offline-database.jsonl.schema.json` from the dataset
 * repo at the pinned tag. `score` is not in that schema but is present on most
 * entries, so it is validated here as optional.
 */

const url = z.url();
const set = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((items) => new Set(items).size === items.length, {
    message: "items must be unique",
  });

export const DATASET_REPOSITORY =
  "https://github.com/cedya77/anime-offline-database";

export const metadataSchema = z.object({
  $schema: z.string(),
  license: z.object({ name: z.string(), url: z.string() }),
  repository: z.string(),
  lastUpdate: z.string(),
});

export const entrySchema = z.object({
  // Entries are identified only by their sources, so an entry without one is invalid.
  sources: set(url).min(1),
  title: z.string().min(1),
  type: z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "UNKNOWN"]),
  episodes: z.number().int().min(0),
  status: z.enum(["FINISHED", "ONGOING", "UPCOMING", "UNKNOWN"]),
  animeSeason: z.object({
    season: z.enum(["SPRING", "SUMMER", "FALL", "WINTER", "UNDEFINED"]),
    year: z.number().int().min(1907).optional(),
  }),
  picture: url,
  thumbnail: url,
  duration: z
    .object({ value: z.number().min(1), unit: z.literal("SECONDS") })
    .optional(),
  score: z
    .object({
      arithmeticGeometricMean: z.number(),
      arithmeticMean: z.number(),
      median: z.number(),
    })
    .optional(),
  synonyms: set(z.string()),
  studios: set(z.string()),
  producers: set(z.string()),
  relatedAnime: set(url),
  tags: set(z.string()),
});

export type Metadata = z.infer<typeof metadataSchema>;
export type Entry = z.infer<typeof entrySchema>;
