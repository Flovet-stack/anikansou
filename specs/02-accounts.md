# 02: Accounts

Brief: Must have #1, "Accounts: sign up, log in, profile". This spec covers the account itself and the smallest profile record. Public profile pages come later.

## Goal

Let a fan create an AniKansou account with Google or with email and password, pick a username, and sign out again. Every later per-user feature (tracking, ratings, lists) hangs off the `profiles` row this task creates, so it has to be correct, safe under RLS and identical on localhost, Vercel previews and production.

## Decisions taken for this spec

| Topic            | Decision                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in methods  | Google (OAuth, server-side PKCE via `@supabase/ssr`) and email + password. Email confirmation is **off** for now, and must be turned on before public launch (see Edge cases).                                                                                                                                           |
| Routes           | `/auth/login`, `/auth/sign-up`, `/auth/callback` (Route Handler), `/auth/username` (first-sign-in step), `/settings` (protected example). All sit under the existing `proxy.ts` matcher (`/auth/:path*`, `/settings/:path*`) and the production `robots.ts` blocks.                                                      |
| Username         | 3–20 characters, `a–z`, `0–9`, `_`, must start with a letter. Stored lowercase; unique case-insensitively. A small reserved list (at least: `admin`, `anime`, `api`, `auth`, `help`, `login`, `settings`, `signup`, `support`, `u`, `user`, `users`) is rejected. Rules are enforced in the database, not only the form. |
| Username changes | Not in this spec. Once set, the database refuses to change it and `/settings` shows it read-only.                                                                                                                                                                                                                        |
| Display name     | Optional, 1–50 characters after trimming; empty or whitespace-only means null. Prefilled from the Google profile name when there is one; never derived from the email address. Editable on `/settings`. Where it's null, the UI shows the username.                                                                      |
| Header           | A small Client Component in the header: "Log in" when signed out, "Settings" when signed in. No avatar, no dropdown. Layouts still never read cookies.                                                                                                                                                                   |
| Test database    | Local Supabase via the Supabase CLI (Docker, devDependency approved), for both e2e and RLS tests.                                                                                                                                                                                                                        |

## Acceptance criteria

### Database

- [ ] One new migration creates `public.profiles`:
  - `id uuid` primary key, references `auth.users(id)` with `on delete cascade`.
  - `username text`, nullable until the username step is done; unique case-insensitively (unique index on `lower(username)`, or store lowercase plus a check); format and length enforced by a check constraint; reserved names rejected in the database.
  - `display_name text`, nullable, check: trimmed length 1–50.
  - `created_at timestamptz not null default now()`.
- [ ] **Column privileges**, because RLS can't restrict columns: revoke all on `public.profiles` from `anon` and `authenticated`, then grant `select` to both and `update (username, display_name)` to `authenticated` only. No client can write `id` or `created_at`, insert or delete.
- [ ] **RLS** is enabled in the same migration. Policies name their roles and use `(select auth.uid())`:
  - `anon` and `authenticated` can `select` all rows. Every column on this table is public; email stays in `auth.users`.
  - `authenticated` can `update` only the row where `id = (select auth.uid())` (both `using` and `with check`).
  - No `insert` or `delete` policies.
- [ ] **Username is set once:** a `before update` trigger raises when `old.username is not null and new.username is distinct from old.username`. Use `is distinct from`, so an update that leaves the username as it was (for example saving the display name) still succeeds.
- [ ] **Sign-up trigger:** an `after insert` trigger on `auth.users` creates the matching `profiles` row with `username` null. It reads the display name from `raw_user_meta_data` keys `full_name`, then `name`; trims it, turns empty into null and cuts it to 50 characters before inserting, so no metadata value (including whatever an email sign-up sends in `options.data`) can break the check and fail the sign-up. The function is `security definer`, `set search_path = ''`, uses fully qualified names, and has `execute` revoked from `public`, `anon` and `authenticated` (or lives in a schema the API doesn't expose).
- [ ] `src/types/database.types.ts` is regenerated with `supabase gen types typescript --local`, not hand-edited.

### Auth flows

- [ ] **Sign up (email):** `/auth/sign-up` takes email and password (minimum 8 characters, stated in the field hint), creates the account, signs the user in and sends them to `/auth/username`. If the email already has an account, show "An account with this email already exists. Log in instead." with a link to log in. (This reveals that the email is registered; accepted for now, since Supabase returns `user_already_exists` with confirmation off.)
- [ ] **Log in (email):** `/auth/login` takes email and password. Wrong credentials show one generic message that doesn't reveal whether the email exists.
- [ ] **Google:** a "Continue with Google" button on both pages starts the OAuth flow with PKCE. `/auth/callback` exchanges the code for a session on the server, then redirects. A missing code, a failed exchange or an `error` parameter from Google (user cancelled) lands on `/auth/login` with a readable message, never a raw stack or a blank page.
- [ ] **Username step:** after any sign-in, a user whose profile has no username is sent to `/auth/username` before reaching any protected page. A taken, reserved or malformed name shows an inline error that says how to fix it. On success the user continues to `next` (default `/settings`).
- [ ] **Sign out:** a "Log out" button on `/settings` signs out on the server and returns the user to `/` as signed out. The header shows "Log in" afterwards without a manual reload (either the header subscribes to `onAuthStateChange` and re-checks on navigation, or log-out ends with a full page load).

### Proxy rules

The proxy (`src/lib/supabase/proxy.ts`, called from `src/proxy.ts`) does these redirects, so they are real HTTP redirects and not client-side redirects inside a streamed 200 (Cache Components is on). It may read the current user's profile row for the username check.

| Request                        | State                  | Result                            |
| ------------------------------ | ---------------------- | --------------------------------- |
| `/settings/**`                 | signed out             | `/auth/login?next=<path>`         |
| `/settings/**`                 | signed in, no username | `/auth/username?next=<path>`      |
| `/auth/login`, `/auth/sign-up` | signed in, no username | `/auth/username`                  |
| `/auth/login`, `/auth/sign-up` | signed in, username    | `/settings`                       |
| `/auth/username`               | signed out             | `/auth/login?next=/auth/username` |
| `/auth/username`               | username already set   | `/settings`                       |
| `/auth/callback`               | any                    | never redirected by the proxy     |

- [ ] Every redirect response the proxy returns carries the cookies refreshed by `setAll` (copy them onto the redirect), so a token refresh is never lost.
- [ ] `/settings` itself also verifies the user with `supabase.auth.getClaims()` and treats a missing user as signed out; it doesn't rely on the proxy alone.

### Protected page

- [ ] `/settings` is rendered per request. It shows the username (read-only), the email, a form to edit the display name, and the log-out button.
- [ ] Saving an empty or whitespace-only display name clears it to null; more than 50 characters shows an inline error and saves nothing.

### Redirects across environments

- [ ] Every redirect target (OAuth `redirectTo`, post-login, post-callback) is built from the incoming request's origin, not `NEXT_PUBLIC_SITE_URL`, so the same build works on localhost, any Vercel preview URL and the production Vercel URL. In Route Handlers and the proxy use `request.nextUrl.origin`; in Server Actions use the `host` and `x-forwarded-proto` request headers. On Vercel these are set by Vercel's edge and can be trusted. The origin never comes from a form field, query parameter or client code.
- [ ] **One shared `safeNext(next, origin)` helper** in `src/features/auth/` decides every post-auth destination. It rejects values containing backslashes or control characters, resolves `new URL(next, origin)`, requires the result's origin to equal `origin`, and returns `pathname + search + hash`; anything else returns the default. Every reader of `next` uses it: the login and sign-up actions, `/auth/callback`, the username action and the proxy.
- [ ] The PR description has a setup checklist for Flovet (the agent doesn't change dashboard settings itself):
  - Supabase Auth Site URL = the production Vercel URL.
  - Redirect URLs allowlist: `http://localhost:3000/**`, `<production Vercel URL>/**`, and the preview pattern `https://<project>-*-<team-slug>.vercel.app/**` (never `https://*.vercel.app/**`). Note: a redirect URL missing from the list silently falls back to the Site URL, which shows up as a PKCE "missing code verifier" error.
  - Google provider enabled with the Google Cloud OAuth client; in Google Cloud the authorized redirect URI is the Supabase callback URL.
  - Email confirmation off; server-side minimum password length 8.
  - Apply the migration to the hosted project (`supabase db push`) before merging, or production `/settings` breaks.
  - Reminder: turn email confirmation on before public launch (see Edge cases).

### Copy and UI

- [ ] Forms use existing shadcn/ui components and tokens; work at 360 px wide; every field has a visible label; keyboard-only completion works with visible focus; errors are announced to screen readers.
- [ ] Buttons start with a verb ("Log in", "Create account", "Continue with Google", "Save username", "Save", "Log out"). Errors say what happened and how to fix it, without "invalid" (for example "That username is taken. Try another one.").
- [ ] Every new page uses `buildMetadata`.

## Out of scope

- `user_anime`, ratings, statuses, watchlist, likes, or any other per-user data.
- Public profile pages (`/u/<username>`), avatars, bios, top 4, "currently watching".
- Password reset and any other auth emails; email confirmation (stays off).
- Changing username, changing email or password, linking or unlinking identities from the UI.
- Account deletion.
- Other OAuth providers, magic links, MFA, CAPTCHA.
- A full navigation sidebar or user menu (only the one header link above).
- CI setup (there is no CI workflow yet; tests run locally).

## Edge cases

- **Account pre-hijacking while confirmation is off.** Email + password accounts are auto-confirmed, so someone can sign up with another person's email and a password they choose. When the real owner later signs in with Google, Supabase links the Google identity into that existing account, and the attacker's password keeps working. Nothing to build here; the README and the PR checklist state that email confirmation **must** be on before public launch.
- Two users race for the same username: the unique index decides; the loser sees "That username is taken".
- Username submitted in mixed case (`Kansou_Fan`) is stored and shown as `kansou_fan`.
- Google returns no name, a whitespace-only name or a name over 50 characters: sign-up still succeeds; the display name is null or cut to 50 characters.
- User closes the tab on the username step and returns later: the proxy sends them back to it on the next `/settings` visit.
- Expired or tampered session cookie on `/settings`: treated as signed out (redirect to login), no crash.
- `next` values like `//evil.example`, `/\evil.example`, `/%09/evil.example`, `https://evil.example` and `javascript:alert(1)` fall back to the default.

## Files and patterns to follow

- Supabase clients: use `src/lib/supabase/server.ts` (Server Actions, Route Handlers, `/settings`), `src/lib/supabase/browser.ts` (header) and `src/lib/supabase/proxy.ts` (session refresh and the proxy rules above). Don't create new client factories.
- ESLint only lets `src/proxy.ts`, `src/lib/supabase/**`, and `features/*/queries.ts`, `queries.client.ts` and `actions.ts` import Supabase clients. So:
  - auth-flow code goes in `src/features/auth/` (`actions.ts`, `queries.client.ts`, `schemas.ts` for `safeNext` and form schemas, `components/`);
  - profile code goes in `src/features/profiles/` (`queries.ts`, `actions.ts`, `schemas.ts`, `components/`);
  - the code exchange used by `src/app/auth/callback/route.ts` lives in a `features/auth` data-access file that is **not** a `"use server"` module, so it isn't exposed as a callable action; the route only calls it;
  - the header link reads auth state through `src/features/auth/queries.client.ts`.
- Pages under `src/app/auth/...` and `src/app/settings/` are routing only.
- Header link: extend `src/components/layout/site-header.tsx` with a Client Component, as its comment already says.
- Migrations in `supabase/migrations/`; add `supabase/config.toml` from `supabase init`, with `additional_redirect_urls` covering the local e2e port. Follow the RLS conventions in `README.md` (Data access).
- Read the installed Next.js 16 docs in `node_modules/next/dist/docs/` for Route Handlers, Server Actions, `redirect` and `proxy.ts` before writing code, and the current `@supabase/ssr` docs for the Next.js server-side PKCE flow.
- Test wiring: `supabase start` must already be running. Tests read the local URL and keys from `supabase status` through a Playwright/Vitest global setup or an uncommitted `.env.test`; nothing is hard-coded in app code. The existing smoke tests keep passing.
- `e2e/smoke.spec.ts` currently expects `/settings` to 404; change that test to expect the new redirect rather than deleting the proxy check.
- README: document the local Supabase setup and test commands, the new routes, the `--local` type generation command, the dashboard checklist and the pre-launch email confirmation gate.

## Boundaries

- **Always:** verify users on the server with `getClaims()`; RLS and column grants in the first migration; run all checks and show the output; run the `reviewer` subagent against this spec before opening the PR.
- **Ask first:** any dependency beyond the Supabase CLI devDependency; any new variable in `src/env.ts` (local test keys belong in test setup, not app env); any change to `src/lib/supabase/server.ts` or `browser.ts`.
- **Never:** call `auth.getSession()` on the server or trust its user; read cookies or headers in a layout; use the service-role or secret key in app code; commit `.env.local`, `.env.test` or keys; edit a migration that has already run; build anything listed in Out of scope.

## Check

Commands that must pass (with `supabase start` running): `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.

End-to-end proof:

1. **E2E (Playwright, local Supabase):** a new user signs up with email and password → lands on `/auth/username` → sets a username → reaches `/settings` and sees it → logs out → lands on `/` and the header shows "Log in". Screenshot of `/settings` attached to the PR.
2. **E2E:** a signed-out request to `/settings` gets an HTTP 307 to `/auth/login?next=%2Fsettings` (checked on the response, not only the final URL).
3. **Unit:** `safeNext` returns the default for every `next` value listed in Edge cases, and passes `/settings?tab=x` through.
4. **RLS test (against local Supabase):** users A and B exist. Signed in as A:
   - updating B's `display_name` affects 0 rows and B's row is unchanged;
   - updating A's own `display_name` succeeds, and so does saving it again with the username unchanged;
   - changing A's username once set is rejected;
   - updating A's `id` or `created_at` is rejected;
   - inserting or deleting a `profiles` row is rejected;
   - as `anon`, selecting profiles returns rows and any update affects 0 rows.
5. **DB constraints:** a duplicate username in different case, a reserved name and a malformed name are each rejected by the database.
6. **Sign-up trigger:** email sign-ups sending a 60-character `full_name` and a whitespace-only `full_name` both succeed, with display names cut to 50 characters and null.
7. **Display name:** saving whitespace clears it to null; 51 characters shows an error and saves nothing.
8. **Manual (Flovet):** Google sign-in works on the PR's Vercel preview URL, including the username step for a new Google account and returning to `/settings` afterwards.
