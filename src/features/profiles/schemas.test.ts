import { describe, expect, it } from "vitest";

import {
  RESERVED_USERNAMES,
  displayNameSchema,
  usernameSchema,
} from "./schemas";

describe("usernameSchema", () => {
  it("lowercases and trims", () => {
    expect(usernameSchema.parse("  Kansou_Fan ")).toBe("kansou_fan");
  });

  it.each(["abc", "a_1", "abcdefghijklmnopqrst"])("accepts %j", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    "ab",
    "abcdefghijklmnopqrstu",
    "1abc",
    "_abc",
    "ab-c",
    "ab c",
    "ábc",
    "",
  ])("rejects %j", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  it.each([...RESERVED_USERNAMES])("rejects reserved %j", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  it("rejects reserved names in any case", () => {
    expect(usernameSchema.safeParse("Settings").success).toBe(false);
  });
});

describe("displayNameSchema", () => {
  it("trims", () => {
    expect(displayNameSchema.parse("  Mika  ")).toBe("Mika");
  });

  it("turns empty or whitespace-only into null", () => {
    expect(displayNameSchema.parse("")).toBeNull();
    expect(displayNameSchema.parse("   ")).toBeNull();
  });

  it("accepts 50 characters, counting code points", () => {
    expect(displayNameSchema.parse("a".repeat(50))).toHaveLength(50);
    expect(displayNameSchema.safeParse("感".repeat(50)).success).toBe(true);
    expect(displayNameSchema.safeParse("😀".repeat(50)).success).toBe(true);
  });

  it("rejects 51 characters", () => {
    expect(displayNameSchema.safeParse("a".repeat(51)).success).toBe(false);
  });
});
