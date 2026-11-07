/**
 * Spec 09 criterion 3: ranking on the live catalog, through the public API
 * as a signed-out visitor (the Supabase project in `.env.test`). Fixture
 * rules are in `search.sql.test.ts`. Run with `pnpm test:db`.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";

const anon = createClient<Database>(
  process.env.TEST_SUPABASE_URL ?? "",
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Hit = { title: string; type: string | null; year: number | null };

async function top(query: string, count: number): Promise<Hit[]> {
  const { data, error } = await anon.rpc("search_anime", {
    p_query: query,
    p_offset: 0,
    p_limit: count,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    title: row.title,
    type: row.type,
    year: row.year,
  }));
}

describe("search_anime ranking on the live catalog (spec 09 #3)", () => {
  it("one piece → the One Piece TV series first", async () => {
    const [first] = await top("one piece", 1);
    expect(first).toMatchObject({ title: "One Piece", type: "tv", year: 1999 });
  });

  it.each(["attack on titan", "aot", "進撃の巨人"])(
    "%s → Shingeki no Kyojin (season 1) first",
    async (query) => {
      const [first] = await top(query, 1);
      expect(first).toMatchObject({ title: "Shingeki no Kyojin", year: 2013 });
    },
  );

  it.each(["frieren", "frieren beyond journeys end"])(
    "%s → Sousou no Frieren (season 1) in the top 2",
    async (query) => {
      const titles = (await top(query, 2)).map((hit) => hit.title);
      expect(titles).toContain("Sousou no Frieren");
    },
  );

  it("bebop → Cowboy Bebop first", async () => {
    const [first] = await top("bebop", 1);
    expect(first?.title).toBe("Cowboy Bebop");
  });

  it("k-on → K-On! first", async () => {
    const [first] = await top("k-on", 1);
    expect(first?.title).toBe("K-On!");
  });

  it("returns no score and no similarity", async () => {
    const { data, error } = await anon.rpc("search_anime", {
      p_query: "frieren",
    });
    if (error) throw error;
    const keys = Object.keys(data?.[0] ?? {});
    expect(keys.some((key) => /score|similar|mean|median|rank/.test(key))).toBe(
      false,
    );
  });
});
