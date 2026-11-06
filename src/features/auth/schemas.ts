import { z } from "zod";

/**
 * Where users go after signing in when no safe `next` is given: the deck,
 * since the core loop is "sign up, swipe" (decision 0009, spec 05).
 */
export const DEFAULT_NEXT = "/rate";

// Backslashes and control characters: browsers treat `/\` like `//` and strip
// tabs and newlines, so either can turn a path into another origin.
const UNSAFE_CHARACTERS = /[\\\u0000-\u001f\u007f]/;

/** No backslashes, control characters or leading `//`, raw or decoded. */
function isSafePath(
  value: string,
  origin: string,
  { allowAbsolute = false } = {},
): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  for (const candidate of [value, decoded]) {
    if (UNSAFE_CHARACTERS.test(candidate) || candidate.startsWith("//")) {
      return false;
    }
  }
  if (allowAbsolute) return true;
  try {
    return new URL(value, origin).origin === origin;
  } catch {
    return false;
  }
}

/**
 * The only way to turn a user-supplied `next` value into a redirect target.
 * Returns a same-origin path (with query and hash), or `fallback`.
 */
export function safeNext(
  next: string | null | undefined,
  origin: string,
  fallback: string = DEFAULT_NEXT,
): string {
  if (!next) return fallback;

  if (!isSafePath(next, origin, { allowAbsolute: true })) return fallback;

  // Only paths, or absolute URLs that already point at this origin.
  if (!next.startsWith("/") && !next.startsWith(`${origin}/`)) return fallback;

  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin) return fallback;

  // Check what we return, not only what we got: dot segments such as
  // `/.//evil.example` normalise to `//evil.example`, another origin.
  const path = `${url.pathname}${url.search}${url.hash}`;
  return isSafePath(path, origin) ? path : fallback;
}

/**
 * For pages, which don't know the request origin: returns a safe path to pass
 * on to a form, or null. The actions check it again with safeNext.
 */
export function safePathOrNull(next: string | null | undefined): string | null {
  const internal = "http://internal.invalid";
  return safeNext(next, internal, "") || null;
}

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter an email address, like name@example.com."));

export const signUpSchema = z.object({
  email,
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

export const logInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
