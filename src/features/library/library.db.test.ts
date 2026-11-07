/**
 * Database tests for the Library (spec 07, decision 0016) against the
 * Supabase project in `.env.test`, as real users through the public API:
 * grants, RLS and "Remove from library". Sorts, cursors and ties are covered
 * in `library.sql.test.ts`. Run with `pnpm test:db`.
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
  if (!data.session) {
    throw new Error(
      "Sign-up returned no session: turn email confirmation off.",
    );
  }
  return client;
}

async function counts(client: Client) {
  const { data, error } = await client.rpc("library_counts");
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((row) => [row.shelf, Number(row.count)]),
  );
}

describe("library", () => {
  let a: Client;
  let b: Client;
  let ids: number[];

  beforeAll(async () => {
    if (!url || !key)
      throw new Error("Fill in .env.test (see .env.test.example).");
    [a, b] = await Promise.all([signUp(), signUp()]);
    const { data, error } = await newClient()
      .schema("catalog")
      .from("anime")
      .select("id")
      .eq("status", "finished")
      .eq("type", "tv")
      .is("retired_at", null)
      .limit(3);
    if (error) throw error;
    ids = data.map((row) => row.id);
    const [x, y, z] = ids as [number, number, number];
    for (const call of [
      a.rpc("deck_seen", { p_anime_id: x, p_status: "watched", p_rating: 8 }),
      a.rpc("set_like", { p_anime_id: x, p_liked: true }),
      a.rpc("set_watchlist", { p_anime_id: y, p_on: true }),
      b.rpc("set_status", { p_anime_id: z, p_status: "dropped" }),
    ]) {
      const { error: failed } = await call;
      if (failed) throw failed;
    }
  });

  it("shows each user only their own shelves and counts", async () => {
    const watched = await a.rpc("library_page", { p_shelf: "watched" });
    expect(watched.error).toBeNull();
    expect(watched.data?.map((row) => row.anime_id)).toEqual([ids[0]]);
    expect(watched.data?.[0]).toMatchObject({
      status: "watched",
      rating: 8,
      liked: true,
    });

    const bobsDropped = await a.rpc("library_page", { p_shelf: "dropped" });
    expect(bobsDropped.data).toEqual([]);

    expect(await counts(a)).toEqual({
      watched: 1,
      watching: 0,
      on_hold: 0,
      dropped: 0,
      watchlist: 1,
      liked: 1,
    });
    expect(await counts(b)).toMatchObject({ dropped: 1, watched: 0 });
  });

  it("refuses signed-out callers", async () => {
    const anon = newClient();
    const page = await anon.rpc("library_page", { p_shelf: "watched" });
    const total = await anon.rpc("library_counts");
    const remove = await anon.rpc("library_remove", {
      p_anime_id: ids[0] ?? 0,
    });
    expect(page.error).not.toBeNull();
    expect(total.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
  });

  it("removes everything for a title in one undoable event", async () => {
    const removed = await a.rpc("library_remove", { p_anime_id: ids[0] ?? 0 });
    expect(removed.error).toBeNull();
    const result = removed.data as {
      event_id: number;
      state: Record<string, unknown>;
    };
    expect(result.state).toEqual({
      status: null,
      rating: null,
      liked: false,
      watchlisted: false,
    });
    expect(await counts(a)).toMatchObject({ watched: 0, liked: 0 });

    const undone = await a.rpc("deck_undo", { p_event_id: result.event_id });
    expect(undone.error).toBeNull();
    expect(await counts(a)).toMatchObject({ watched: 1, liked: 1 });
  });

  it("never touches another user's title", async () => {
    await a.rpc("library_remove", { p_anime_id: ids[2] ?? 0 });
    expect(await counts(b)).toMatchObject({ dropped: 1 });
  });
});
