/**
 * Database tests for `public.profiles`: RLS, column grants, constraints and the
 * sign-up trigger. They run against the Supabase project in `.env.test`
 * through the public API, as real users. Run them with `pnpm test:db`.
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

function uniqueSuffix() {
  return randomUUID().replaceAll("-", "").slice(0, 10);
}

async function signUp(metadata?: Record<string, string>) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `db-${uniqueSuffix()}@anikansou.test`,
    password: `pw-${randomUUID()}`,
    options: metadata ? { data: metadata } : undefined,
  });
  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error(
      "Sign-up returned no session. Turn email confirmation off in the Supabase project.",
    );
  }
  return { client, id: data.user.id };
}

async function readProfile(id: string) {
  const { data, error } = await newClient()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

describe("profiles", () => {
  let a: Awaited<ReturnType<typeof signUp>>;
  let b: Awaited<ReturnType<typeof signUp>>;
  let aName: string;
  let bName: string;

  beforeAll(async () => {
    if (!url || !key) {
      throw new Error("Fill in .env.test (see .env.test.example).");
    }
    [a, b] = await Promise.all([signUp(), signUp()]);
    aName = `a_${uniqueSuffix()}`;
    bName = `b_${uniqueSuffix()}`;
  });

  describe("sign-up trigger", () => {
    it("creates a profile with no username", async () => {
      const profile = await readProfile(a.id);
      expect(profile.username).toBeNull();
      expect(profile.display_name).toBeNull();
      expect(profile.created_at).toBeTruthy();
    });

    it("cuts a 60-character full_name to 50", async () => {
      const user = await signUp({ full_name: "x".repeat(60) });
      expect((await readProfile(user.id)).display_name).toBe("x".repeat(50));
    });

    it("stores a whitespace-only full_name as null", async () => {
      const user = await signUp({ full_name: "   " });
      expect((await readProfile(user.id)).display_name).toBeNull();
    });

    it("falls back to the name key and trims it", async () => {
      const user = await signUp({ name: "  Mika  " });
      expect((await readProfile(user.id)).display_name).toBe("Mika");
    });
  });

  describe("own row", () => {
    it("can set its username once", async () => {
      const { error } = await a.client
        .from("profiles")
        .update({ username: aName })
        .eq("id", a.id);
      expect(error).toBeNull();
      expect((await readProfile(a.id)).username).toBe(aName);
    });

    it("can update its display name, with the username unchanged", async () => {
      const { error } = await a.client
        .from("profiles")
        .update({ display_name: "Aki", username: aName })
        .eq("id", a.id);
      expect(error).toBeNull();
      expect((await readProfile(a.id)).display_name).toBe("Aki");
    });

    it("cannot change its username once set", async () => {
      const { error } = await a.client
        .from("profiles")
        .update({ username: `${aName}x` })
        .eq("id", a.id);
      expect(error).not.toBeNull();
      expect((await readProfile(a.id)).username).toBe(aName);
    });

    it("cannot clear its username once set", async () => {
      const { error } = await a.client
        .from("profiles")
        .update({ username: null })
        .eq("id", a.id);
      expect(error).not.toBeNull();
    });

    it("cannot change id or created_at", async () => {
      const before = await readProfile(a.id);
      const idUpdate = await a.client
        .from("profiles")
        .update({ id: randomUUID() })
        .eq("id", a.id);
      const dateUpdate = await a.client
        .from("profiles")
        .update({ created_at: "2000-01-01T00:00:00Z" })
        .eq("id", a.id);
      expect(idUpdate.error).not.toBeNull();
      expect(dateUpdate.error).not.toBeNull();
      expect(await readProfile(a.id)).toEqual(before);
    });

    it("rejects a whitespace-only display name", async () => {
      const { error } = await a.client
        .from("profiles")
        .update({ display_name: "   " })
        .eq("id", a.id);
      expect(error).not.toBeNull();
    });
  });

  describe("other users' rows", () => {
    it("cannot update another user's display name", async () => {
      const before = await readProfile(b.id);
      const { data, error } = await a.client
        .from("profiles")
        .update({ display_name: "hacked" })
        .eq("id", b.id)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect(await readProfile(b.id)).toEqual(before);
    });

    it("cannot set another user's username", async () => {
      const { data } = await a.client
        .from("profiles")
        .update({ username: `h_${uniqueSuffix()}` })
        .eq("id", b.id)
        .select();
      expect(data ?? []).toEqual([]);
      expect((await readProfile(b.id)).username).toBeNull();
    });

    it("cannot insert or delete profiles", async () => {
      const insert = await a.client
        .from("profiles")
        .insert({ id: randomUUID(), username: `i_${uniqueSuffix()}` });
      expect(insert.error).not.toBeNull();

      const ownDelete = await a.client.from("profiles").delete().eq("id", a.id);
      const otherDelete = await a.client
        .from("profiles")
        .delete()
        .eq("id", b.id);
      expect(ownDelete.error).not.toBeNull();
      expect(otherDelete.error).not.toBeNull();
      await expect(readProfile(a.id)).resolves.toBeTruthy();
      await expect(readProfile(b.id)).resolves.toBeTruthy();
    });
  });

  describe("anon", () => {
    it("can read profiles", async () => {
      const { data, error } = await newClient()
        .from("profiles")
        .select("id, username, display_name, created_at")
        .in("id", [a.id, b.id]);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it("cannot update profiles", async () => {
      const before = await readProfile(b.id);
      const { data } = await newClient()
        .from("profiles")
        .update({ display_name: "anon" })
        .eq("id", b.id)
        .select();
      expect(data ?? []).toEqual([]);
      expect(await readProfile(b.id)).toEqual(before);
    });
  });

  describe("username constraints", () => {
    it("rejects a username that is taken", async () => {
      const { error } = await b.client
        .from("profiles")
        .update({ username: aName })
        .eq("id", b.id);
      expect(error?.code).toBe("23505");
    });

    it("rejects a taken username in a different case", async () => {
      const { error } = await b.client
        .from("profiles")
        .update({ username: aName.toUpperCase() })
        .eq("id", b.id);
      expect(error).not.toBeNull();
    });

    it.each(["settings", "admin", "anime"])(
      "rejects reserved %j",
      async (name) => {
        const { error } = await b.client
          .from("profiles")
          .update({ username: name })
          .eq("id", b.id);
        expect(error).not.toBeNull();
      },
    );

    it.each(["ab", "1abc", "_abc", "ab-c", "Abc", "a".repeat(21)])(
      "rejects malformed %j",
      async (name) => {
        const { error } = await b.client
          .from("profiles")
          .update({ username: name })
          .eq("id", b.id);
        expect(error).not.toBeNull();
      },
    );

    it("still accepts a valid free username afterwards", async () => {
      const { error } = await b.client
        .from("profiles")
        .update({ username: bName })
        .eq("id", b.id);
      expect(error).toBeNull();
      expect((await readProfile(b.id)).username).toBe(bName);
    });
  });
});
