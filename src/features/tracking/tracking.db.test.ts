/**
 * Database tests for tracking (spec 05, decision 0011) against the Supabase
 * project in `.env.test`, as real users through the public API: RLS, grants
 * and the deck. The function logic (eligibility, undo, 30-day skips) is
 * covered in `deck.sql.test.ts`. Run with `pnpm test:db`.
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

async function signUp() {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `db-${randomUUID().slice(0, 10)}@anikansou.test`,
    password: `pw-${randomUUID()}`,
  });
  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error(
      "Sign-up returned no session: turn email confirmation off.",
    );
  }
  return { client, id: data.user.id };
}

describe("tracking", () => {
  let a: Awaited<ReturnType<typeof signUp>>;
  let b: Awaited<ReturnType<typeof signUp>>;
  let aired: number;
  let upcoming: number;

  beforeAll(async () => {
    if (!url || !key)
      throw new Error("Fill in .env.test (see .env.test.example).");
    [a, b] = await Promise.all([signUp(), signUp()]);
    const catalog = newClient().schema("catalog");
    const finished = await catalog
      .from("anime")
      .select("id")
      .eq("status", "finished")
      .eq("type", "tv")
      .is("retired_at", null)
      .limit(1)
      .single();
    const notAired = await catalog
      .from("anime")
      .select("id")
      .eq("status", "upcoming")
      .is("retired_at", null)
      .limit(1)
      .single();
    if (finished.error) throw finished.error;
    if (notAired.error) throw notAired.error;
    aired = finished.data.id;
    upcoming = notAired.data.id;
  });

  it("lets a user rate and read back their own state", async () => {
    const { error } = await a.client.rpc("deck_seen", {
      p_anime_id: aired,
      p_status: "watched",
      p_rating: 9,
    });
    expect(error).toBeNull();
    const { data } = await a.client
      .from("user_anime")
      .select("status, rating")
      .eq("anime_id", aired);
    expect(data).toEqual([{ status: "watched", rating: 9 }]);
  });

  it("hides one user's tracking and history from another", async () => {
    const rows = await b.client
      .from("user_anime")
      .select("*")
      .eq("user_id", a.id);
    const history = await b.client
      .from("user_anime_events")
      .select("*")
      .eq("user_id", a.id);
    expect(rows.data).toEqual([]);
    expect(history.data).toEqual([]);
  });

  it("refuses writes to another user's rows", async () => {
    const update = await b.client
      .from("user_anime")
      .update({ rating: 1 })
      .eq("user_id", a.id)
      .select();
    expect(update.data ?? []).toEqual([]);
    const insert = await b.client
      .from("user_anime")
      .insert({ user_id: a.id, anime_id: aired, liked: true });
    expect(insert.error).not.toBeNull();
    const own = await a.client
      .from("user_anime")
      .select("rating")
      .eq("anime_id", aired)
      .single();
    expect(own.data?.rating).toBe(9);
  });

  it("keeps history append-only", async () => {
    const del = await a.client
      .from("user_anime_events")
      .delete()
      .eq("user_id", a.id)
      .select();
    expect(
      del.error ?? (del.data?.length === 0 ? "nothing deleted" : null),
    ).not.toBeNull();
    const { count } = await a.client
      .from("user_anime_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", a.id);
    expect(count).toBeGreaterThan(0);
  });

  it("refuses ratings out of range and statuses for unaired anime", async () => {
    const tooHigh = await a.client.rpc("set_rating", {
      p_anime_id: aired,
      p_rating: 11,
    });
    expect(tooHigh.error).not.toBeNull();
    const early = await a.client.rpc("set_status", {
      p_anime_id: upcoming,
      p_status: "watched",
    });
    expect(early.error?.message).toMatch(/aired/);
  });

  it("refuses a rating without Watched, through the functions and the table (0015)", async () => {
    const { error: listed } = await b.client.rpc("set_status", {
      p_anime_id: aired,
      p_status: "watching",
    });
    expect(listed).toBeNull();
    const viaFunction = await b.client.rpc("set_rating", {
      p_anime_id: aired,
      p_rating: 6,
    });
    expect(viaFunction.error?.message).toMatch(/watched to rate/);
    const viaTable = await b.client
      .from("user_anime")
      .update({ rating: 6 })
      .eq("user_id", b.id)
      .eq("anime_id", aired)
      .select();
    expect(viaTable.error?.message).toMatch(/watched to rate/);
  });

  it("serves a deck without scores and without the user's rated anime", async () => {
    const { data, error } = await a.client.rpc("deck_next", {
      p_page_size: 20,
    });
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    for (const card of data ?? []) {
      expect(Object.keys(card).join(",")).not.toMatch(/score|mean|median/);
      expect(card.type).not.toBe("special");
      expect(card.anime_id).not.toBe(aired);
    }
  });

  it("keeps the deck order and its helpers out of the API (0014)", async () => {
    const order = await a.client.from("deck_order").select("*").limit(1);
    const state = await a.client.from("deck_order_state").select("*").limit(1);
    expect(order.error ?? (order.data?.length ? null : "empty")).not.toBeNull();
    expect(order.data ?? []).toEqual([]);
    expect(state.data ?? []).toEqual([]);
    for (const fn of ["deck_order_refresh_if_stale"] as const) {
      expect((await a.client.rpc(fn)).error).not.toBeNull();
    }
    expect(
      (await a.client.rpc("deck_excluded", { p_user: a.id, p_anime_id: aired }))
        .error,
    ).not.toBeNull();
    expect(
      (await a.client.schema("catalog").rpc("is_adult", { p_anime_id: aired }))
        .error,
    ).not.toBeNull();
  });

  it("refuses signed-out callers", async () => {
    const anon = newClient();
    expect((await anon.rpc("deck_next", {})).error).not.toBeNull();
    expect(
      (await anon.rpc("set_like", { p_anime_id: aired, p_liked: true })).error,
    ).not.toBeNull();
  });
});
