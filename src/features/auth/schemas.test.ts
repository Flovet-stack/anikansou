import { describe, expect, it } from "vitest";

import { logInSchema, safeNext, safePathOrNull, signUpSchema } from "./schemas";

const origin = "https://anikansou.test";

describe("safeNext", () => {
  it.each([
    "//evil.example",
    "/\\evil.example",
    "/%09/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://evil.example",
    "http://anikansou.test.evil.example/settings",
    "javascript:alert(1)",
    "/.//evil.example",
    "/x/..//evil.example",
    "/%2e//evil.example",
    "/./%2fevil.example",
    "settings",
    "",
  ])("falls back to the default for %j", (next) => {
    expect(safeNext(next, origin)).toBe("/rate");
  });

  it("falls back when next is missing", () => {
    expect(safeNext(null, origin)).toBe("/rate");
    expect(safeNext(undefined, origin)).toBe("/rate");
  });

  it("passes same-origin paths through with query and hash", () => {
    expect(safeNext("/settings?tab=x", origin)).toBe("/settings?tab=x");
    expect(safeNext("/auth/username#top", origin)).toBe("/auth/username#top");
  });

  it("accepts an absolute URL on the same origin and returns its path", () => {
    expect(safeNext(`${origin}/settings`, origin)).toBe("/settings");
  });

  it("uses the given fallback", () => {
    expect(safeNext("//evil.example", origin, "/")).toBe("/");
  });
});

describe("signUpSchema", () => {
  it("accepts an email and an 8-character password", () => {
    const result = signUpSchema.safeParse({
      email: " Fan@Example.com ",
      password: "12345678",
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("fan@example.com");
  });

  it("rejects a short password", () => {
    expect(
      signUpSchema.safeParse({ email: "fan@example.com", password: "1234567" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      signUpSchema.safeParse({ email: "not-an-email", password: "12345678" })
        .success,
    ).toBe(false);
  });
});

describe("logInSchema", () => {
  it("requires both fields", () => {
    expect(
      logInSchema.safeParse({ email: "fan@example.com", password: "" }).success,
    ).toBe(false);
    expect(
      logInSchema.safeParse({ email: "fan@example.com", password: "x" })
        .success,
    ).toBe(true);
  });
});

describe("safePathOrNull", () => {
  it("keeps safe paths and drops the rest", () => {
    expect(safePathOrNull("/settings?tab=x")).toBe("/settings?tab=x");
    expect(safePathOrNull("//evil.example")).toBeNull();
    expect(safePathOrNull("https://evil.example")).toBeNull();
    expect(safePathOrNull("/.//evil.example")).toBeNull();
    expect(safePathOrNull(undefined)).toBeNull();
  });
});
