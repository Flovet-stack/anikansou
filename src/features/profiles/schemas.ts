import { z } from "zod";

/** Keep in sync with the `profiles_username_not_reserved` check in the profiles migration. */
export const RESERVED_USERNAMES = [
  "admin",
  "anime",
  "api",
  "auth",
  "help",
  "login",
  "settings",
  "signup",
  "support",
  "u",
  "user",
  "users",
] as const;

const reserved = new Set<string>(RESERVED_USERNAMES);

export const USERNAME_HINT =
  "3–20 lowercase letters, numbers or underscores, starting with a letter.";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9_]{2,19}$/,
    "Use 3–20 letters, numbers or underscores, starting with a letter.",
  )
  .refine(
    (name) => !reserved.has(name),
    "That username is reserved. Try another one.",
  );

export const DISPLAY_NAME_MAX = 50;

/** Trimmed; empty means no display name (null). Length counts characters, not UTF-16 units. */
export const displayNameSchema = z
  .string()
  .trim()
  .refine(
    (name) => [...name].length <= DISPLAY_NAME_MAX,
    `Use ${DISPLAY_NAME_MAX} characters or fewer.`,
  )
  .transform((name) => (name === "" ? null : name));
