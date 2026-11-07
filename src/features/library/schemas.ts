import { z } from "zod";

import { SHELVES, SORTS } from "./types";

export const shelfSchema = z.enum(SHELVES);
export const sortSchema = z.enum(SORTS);

/** The keyset cursor `library_page` returns with each row. */
export const cursorSchema = z.object({
  sort: sortSchema,
  id: z.number().int().positive(),
  key: z.union([z.string().max(1000), z.number().int()]),
});
