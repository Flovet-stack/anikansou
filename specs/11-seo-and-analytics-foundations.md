# 11: SEO and analytics foundations

Status: Ready (decisions approved; needs the two values from Flovet listed under Setup) · Written: 2026-11-08

Phase 0 of the growth plan (0030).

## Goal

Make indexing and visitor behaviour visible, and give search engines a clear homepage and sitemap, so later work can be measured from its first day.

## Decisions

Implements [0031](../docs/decisions/0031-posthog-for-analytics-and-errors.md), which replaces the analytics part of [0029](../docs/decisions/0029-search-and-analytics-tools.md). Serves [0030](../docs/decisions/0030-growth-sequence-and-launch.md).

## Setup (Flovet)

1. Create a Search Console **URL-prefix** property for `https://anikansou.vercel.app/` and give the builder the HTML tag's token. It isn't secret.
2. Create a free PostHog project, choosing the EU region if offered, turn on **Enable cookieless tracking**, and set its token and host as Production-only environment variables on Vercel.
3. After deploy: verify the property, submit `sitemap.xml`, and import the site into Bing Webmaster Tools.

## Acceptance criteria

### Search

1. Production HTML has the `google-site-verification` meta tag, set through the root metadata.
2. The home `<title>` is exactly `AniKansou: rate, track and remember every anime`, with no template suffix.
3. `sitemap.xml` lists the homepage and `/discover`. Filtered Discover URLs stay out and stay `noindex`.
4. `robots.txt`, canonicals and preview blocking are unchanged.
5. The README and `.env.example` no longer name `anikansou.com` as production.

### Analytics

6. `posthog-js` starts from `instrumentation-client.ts`, following the installed Next.js docs, with `cookieless_mode: "always"`.
7. Without a token, as in local, preview and test runs, nothing initializes, no request goes to PostHog and the build still passes. `NEXT_PUBLIC_POSTHOG_*` are optional in `src/env.ts` and listed in `.env.example`.
8. Page views, including client-side navigations, are captured once each.
9. Named events fire once, after the action succeeds: `sign_up`, `first_rating`, `tenth_rating`.
10. No email, username, user ID or review text goes to PostHog. Session recording is off.
11. Uncaught client errors are captured by PostHog error tracking.

## Out of scope

- Title pages, season pages and gated sitemaps (0028, next spec).
- Removing test accounts or moving e2e tests off production. Flovet hasn't decided this yet.
- `list_imported` and `card_shared` events, until those features exist.
- `posthog-node`, server error capture, Sentry and the 0031 error test, which runs before the 20-user gate.
- PostHog's reverse proxy, IndexNow, the privacy page and any consent UI.

## Edge cases

- An ad blocker stops PostHog: the app works and shows no errors.
- A rating undone and redone: `first_rating` and `tenth_rating` still fire once per milestone, and SQL stays the source of truth.

## Files and patterns

- `src/lib/seo/metadata.ts`, `src/app/(app)/page.tsx`, `src/app/sitemap.ts`, `src/env.ts`.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`, and PostHog's [Next.js guide](https://posthog.com/docs/libraries/next-js).

## Boundaries

- Always: read env through `src/env.ts`; add tests for the home title, the sitemap and the no-token case.
- Ask first: anything beyond `posthog-js` as a dependency.
- Never: send personal data to PostHog, turn on session recording, or commit tokens other than the public verification token.

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.
- Production fetched as Googlebot shows the title, the verification tag and the two sitemap URLs.
- PostHog shows a page view and the three events from a test run on production, using one real test sign-up that is deleted afterwards.
- Core Web Vitals in PageSpeed Insights for `/` and `/discover`, before and after, in the PR.
