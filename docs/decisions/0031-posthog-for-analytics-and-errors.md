# 0031: PostHog for product analytics and errors

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Tech Lead, Frontend, Backend, Product)
- **Approved:** 2026-11-08 by Flovet
- **Supersedes:** 0029, for Vercel Web Analytics only (Search Console, Bing, IndexNow timing and SQL stay as 0029 says)
- **Specs:** specs/11-seo-and-analytics-foundations.md

## Context

Flovet asked where PostHog and Sentry fit, and whether to use both. 0029 chose Vercel Web Analytics, but on Hobby it has no custom events or UTM reports and keeps one month of history. The approved plan depends on knowing which launch post brought people and whether they rate 10 titles (0030). The repo has neither tool, no error monitoring, and no privacy page.

## Research

| Reference            | What they do                                                                                           | Adopt / adapt / reject | Why                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------- |
| PostHog              | Free tier lists 1,000,000 events, 5,000 recordings and 100,000 exceptions a month, with 1-year history | Adopt                  | Covers funnels, referrers and errors in one tool                                              |
| Sentry               | Free Developer plan: 5,000 errors, 5M spans, 50 replays, 1 user, 30-day lookback; Next.js 14 or later  | Hold                   | A dedicated error tool, but a second SDK and a build wrapper                                  |
| Vercel Web Analytics | Free on Hobby: 50,000 events, one month of history, no custom events or UTM reports                    | Reject                 | Overlaps with PostHog and can't measure activation or campaigns                               |
| PostHog cookieless   | `cookieless_mode: "always"` stores nothing in the browser and needs no banner on PostHog's account     | Adopt                  | Avoids a consent banner, if nothing else on the site needs one; confirm in the privacy review |

Sources (links actually opened):

- https://posthog.com/pricing.md
- https://posthog.com/docs/error-tracking/pricing
- https://posthog.com/docs/libraries/next-js
- https://posthog.com/docs/privacy/data-collection
- https://sentry.io/pricing/
- https://docs.sentry.io/platforms/javascript/guides/nextjs/
- https://vercel.com/docs/analytics/limits-and-pricing

Not verified: a neutral comparison of PostHog's and Sentry's error tracking (the comparison page could not be read, and PostHog wrote it), and PostHog's EU hosting terms.

## Options

1. **Vercel Web Analytics plus Sentry (0029 as is, plus errors).** Simple page views and strong errors, but no funnels or campaign reports.
2. **PostHog and Sentry together.** They work side by side: PostHog for behaviour, Sentry for errors. Two SDKs, more client JavaScript and two dashboards.
3. **PostHog alone, and add Sentry only if it falls short.** One SDK and one dashboard. Error tracking is unproven for this stack until tested.

## Decision

Option 3.

- Add `posthog-js` in Phase 0, replacing Vercel Web Analytics. Add `posthog-node` only if the server error test below needs it.
- Use cookieless mode. Keep session recording off until a privacy review. Send no email or username to PostHog.
- Track a few named events: sign-up, first rating, tenth rating, list imported, card shared.
- SQL stays the source of truth for user counts.
- Test before the 20-user gate (0030): throw one client error and one Server Component error in a preview, and confirm both show readable stack traces. If either fails, add Sentry's free plan, with no tunnel route and low trace sampling, to protect Hobby invocations.

## Consequences

- Adds a dependency and `NEXT_PUBLIC_POSTHOG_*` environment variables; approving this decision gives both approvals (`CLAUDE.md`).
- Client JavaScript grows, so a review should compare Core Web Vitals before and after.
- Blockers will hide some visitors. PostHog's free managed proxy can reduce this if the numbers look too low.
- 0029 becomes `Superseded by 0031` when this is approved, and Search Console and Bing carry over.
- A privacy page is needed before the January launch whichever tool is used. Flovet should get real legal advice on it.
