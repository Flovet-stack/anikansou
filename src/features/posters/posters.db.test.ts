/**
 * Database tests for AniList covers (spec 08, decision 0017) against the
 * Supabase project in `.env.test`, through the public API: who may call
 * `record_anilist_covers` and which links it refuses. The rest of its rules
 * are covered in `anilist-covers.sql.test.ts`. Run with `pnpm test:db`.
 */
import { randomUUID } from "node:crypto";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";

const url = process.env.TEST_SUPABASE_URL ?? "";
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "";

type Client = SupabaseClient<Database>;

function newClient(): Client {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("record_anilist_covers", () => {
  let user: Client;
  let animeId: number;

  beforeAll(async () => {
    if (!url || !key)
      throw new Error("Fill in .env.test (see .env.test.example).");
    user = newClient();
    const { data, error } = await user.auth.signUp({
      email: `db-${randomUUID().slice(0, 10)}@anikansou.test`,
      password: `pw-${randomUUID()}`,
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error(
        "Sign-up returned no session: turn email confirmation off.",
      );
    }
    const anime = await newClient()
      .schema("catalog")
      .from("anime")
      .select("id")
      .is("retired_at", null)
      .limit(1)
      .single();
    if (anime.error) throw anime.error;
    animeId = anime.data.id;
  });

  it("is switched on for readers", async () => {
    const { data, error } = await newClient()
      .schema("catalog")
      .from("image_sources")
      .select("priority, is_enabled, url_prefix")
      .eq("slug", "anilist")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      priority: 30,
      is_enabled: true,
      url_prefix: "https://s4.anilist.co/",
    });
  });

  it("can't be called by anon", async () => {
    const { error } = await newClient()
      .schema("catalog")
      .rpc("record_anilist_covers", { p_covers: [] });
    expect(error?.code).toBe("42501");
  });

  it("refuses a link from another host for signed-in users", async () => {
    const { error } = await user
      .schema("catalog")
      .rpc("record_anilist_covers", {
        p_covers: [
          { anime_id: animeId, url: "https://image.tmdb.org/t/p/w500/x.jpg" },
        ],
      });
    expect(error?.message).toMatch(/must start with/);
  });

  it("doesn't let signed-in users write the tables directly", async () => {
    const { error } = await user
      .schema("catalog")
      .from("anime_image_misses")
      .insert({ anime_id: animeId, source_id: 1 });
    expect(error?.code).toBe("42501");
  });
});
