# 03: Internationalization setup

Status: Blocked (waiting on approval of [0001](../docs/decisions/0001-internationalization.md), the `next-intl` dependency, and the choice of the second language) · Written: 2026-11-06

Nobody builds this spec until its status is `Ready`. When 0001 is approved, replace `<second>` below with the chosen language code, set the status to `Ready`, and fill in 0001's `Specs:` line.

## Goal

Make the interface translatable, and prove it end to end with English plus one second language (`<second>`). Every page built so far moves under a locale segment and every visible string moves into message files, so each later feature ships translated from day one. English URLs don't change.

This task is the foundation only. It adds no new features and no languages beyond `<second>`.

## Decisions

Implements [0001](../docs/decisions/0001-internationalization.md): path-prefix routing with English unprefixed, cookie then `Accept-Language` detection, `next-intl`, BCP 47 codes, interface language separate from title language, `Intl` formatting, one second language first, human review of every translation.

## Acceptance criteria

### Routing

- [ ] `next-intl` added (the only new dependency), configured per its docs for the installed Next.js 16 version.
- [ ] Locales `en` (default) and `<second>`. English has no prefix; `<second>` pages live at `/<second>/...`.
- [ ] Every existing route moves under `src/app/[locale]/` (home, `/auth/*`, `/settings`, `error`, `not-found`, OG image). `robots.ts`, `sitemap.ts` and `/auth/callback` keep working at their current URLs.
- [ ] Every existing English URL returns the same page as before (no redirect, no 404).
- [ ] An unknown locale prefix (`/xx/settings`) gets a 404, not a crash.
- [ ] Pages that were static before are still static per locale (`generateStaticParams` returns both locales). Layouts still never read cookies or headers.

### Detection and switching

- [ ] First visit to an unprefixed page with no `NEXT_LOCALE` cookie and `Accept-Language` preferring `<second>`: redirected to the `<second>` page.
- [ ] No `Accept-Language` header (crawlers) or an unsupported language: English, no redirect.
- [ ] The `NEXT_LOCALE` cookie wins over `Accept-Language`.
- [ ] A language selector (in the footer) lists each language by its native name, keeps the user on the same page and query string, and sets the cookie. It works with the keyboard and has an accessible label.
- [ ] Choosing English after `<second>` sticks: the user isn't redirected back on the next visit.

### Proxy

- [ ] `src/proxy.ts` runs locale handling on public pages, excluding `_next`, static files, `robots.txt`, `sitemap.xml`, the icon and `/auth/callback`.
- [ ] The Supabase session refresh and the auth redirects in `src/lib/supabase/proxy.ts` run only on `/auth/*` and `/settings/*`, in both locales (`/<second>/settings` is protected too). Public pages never call Supabase in the proxy.
- [ ] The signed-out redirect keeps the locale: `/<second>/settings` → `/<second>/auth/login?next=%2F<second>%2Fsettings`. `safeNext` still rejects every unsafe value from spec 02.

### Messages

- [ ] Messages in `messages/en.json` and `messages/<second>.json`, ICU syntax, grouped by feature (`auth`, `settings`, `layout`, `errors`, `metadata`).
- [ ] Message keys are typed from `en.json`: a missing or misspelled key fails `pnpm typecheck`.
- [ ] A unit test fails if `<second>.json` is missing any key from `en.json`, or has extra keys.
- [ ] No hard-coded user-facing text left in `src/app` or `src/components` or `src/features` (including form errors from Zod schemas, button labels, `aria-label`s and page metadata).
- [ ] At least one plural message is used and tested in both languages (for example a character counter in the display name field).
- [ ] The `<second>` translation is reviewed by a fluent speaker before merge; the PR names who reviewed it.

### Page and SEO

- [ ] `<html lang>` matches the locale (`en` or `<second>`) and `dir="ltr"` is set from the locale config, not hard-coded.
- [ ] `buildMetadata` outputs a canonical for the current locale and `hreflang` alternates for both locales plus `x-default` (English).
- [ ] `sitemap.ts` lists both locale versions of each public URL.
- [ ] Dates and numbers shown anywhere go through `next-intl` formatting with the active locale.

### Styling

- [ ] Changed components use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) instead of left/right ones.
- [ ] No layout breaks at 360 px in `<second>` (translated strings are often longer).

## Out of scope

- Any language other than English and `<second>`.
- RTL languages and fonts for non-Latin scripts.
- Saving the language on the account (needs a migration and a separate decision; never on `public.profiles`).
- Translated Supabase Auth emails.
- Translating tags, genres or any catalog data; the title language toggle (feature 10).
- Translating user content (feature 39).
- IP-based detection, per-language slugs, a language banner or prompt.
- Any new feature or page.

## Edge cases

- `/<second>` alone (no trailing path) renders the `<second>` home page.
- `/en/settings` (explicit default prefix) redirects to `/settings`, so there's one URL per page.
- A signed-out user on `/<second>/settings` logs in and lands back on `/<second>/settings`, not the English page.
- A message with a variable (`{username}`) receives a username containing ICU-looking characters (`{`, `}`): shown literally, never parsed.
- `Accept-Language: <second>-XX;q=0.9, en;q=0.8` (a regional variant) matches `<second>`.
- The OG image still renders for both locales.

## Files and patterns to follow

- Read the installed Next.js docs first: `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`, plus the `proxy.ts`, `generateStaticParams` and `layout` references. Then the current `next-intl` docs for App Router with `proxy.ts`.
- Routing config in one place (`src/i18n/routing.ts`), request config in `src/i18n/request.ts`; use `next-intl`'s navigation helpers (`Link`, `redirect`, `usePathname`) instead of `next/link` for internal links.
- Keep `src/proxy.ts` as the single entry point: locale handling first, then hand `/auth/*` and `/settings/*` to the existing `updateSession` in `src/lib/supabase/proxy.ts`. Don't create new Supabase client factories.
- Features keep their structure from spec 02 (`src/features/auth`, `src/features/profiles`); Zod schemas return message keys, and components translate them.
- SEO stays in `src/lib/seo/` (`metadata.ts`, `robots.ts`, `site.ts`); extend `buildMetadata`, don't bypass it.
- The selector is a custom component on our tokens, not a default shadcn look (brief: no generic UI).
- Update `e2e/smoke.spec.ts` and the auth e2e tests to run in both locales instead of duplicating them.
- README: how to add a message, how to add a language, and the translation review rule.

## Boundaries

- **Always:** run all checks and show the output; screenshots of the home page and `/settings` in both languages at 390 px and 1440 px, light and dark; run the `reviewer` subagent against this spec before opening the PR; Workflow E review on the PR.
- **Ask first:** any dependency other than `next-intl`; any change to `src/lib/supabase/server.ts` or `browser.ts`; any new variable in `src/env.ts`.
- **Never:** read cookies or headers in a layout; let public pages call Supabase in the proxy; machine-translate without a fluent reviewer; add a migration; build anything listed in Out of scope.

## Check

Commands that must pass: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build`.

End-to-end proof:

1. **Build output:** `pnpm build` shows the home page as static for both `en` and `<second>`.
2. **E2E, detection:** request `/` with `Accept-Language: <second>` and no cookie → 307 to `/<second>`; with no header → 200 in English; with `NEXT_LOCALE=en` and `Accept-Language: <second>` → 200 in English.
3. **E2E, selector:** on `/auth/login`, choose `<second>` → URL becomes `/<second>/auth/login`, `<html lang>` is `<second>`, and the heading is translated; reload keeps `<second>`.
4. **E2E, auth in `<second>`:** the spec 02 sign-up → username → settings → log-out flow passes under `/<second>`, and the signed-out redirect keeps the locale (checked on the response).
5. **Unit:** message files have identical keys; the plural message renders correctly for 0, 1 and 2 in both languages.
6. **SEO:** the home page HTML contains a canonical, `hreflang` for `en`, `<second>` and `x-default`.
7. **Grep:** no left/right Tailwind classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`) in changed files.
