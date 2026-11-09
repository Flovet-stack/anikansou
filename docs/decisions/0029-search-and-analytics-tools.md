# 0029: Search and analytics tools

- **Status:** Superseded by 0031
- **Proposed:** 2026-11-08 by the product team (roles: Tech Lead, Frontend, Product)
- **Approved:** 2026-11-08 by Flovet
- **Specs:** specs/11-seo-and-analytics-foundations.md

## Context

The repo has no analytics and no Search Console verification, so indexing and traffic can't be seen. The brief allows no paid services beyond hosting basics, and production runs on the Vercel URL with no DNS control.

## Research

| Reference             | What they do                                                                        | Adopt / adapt / reject | Why                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| Google Search Console | Shows indexing and queries. A URL-prefix property works without DNS                 | Adopt                  | It's the only direct view of Google's indexing                                                |
| Bing Webmaster Tools  | Reports for Bing                                                                    | Adopt                  | Low effort. Import from Search Console is reported by secondary sources; confirm during setup |
| Vercel Web Analytics  | Free on Hobby: 50,000 events a month, one month of history, no custom events or UTM | Adopt                  | Fits the hosting already in use                                                               |
| IndexNow              | Pushes changed URLs to Bing, Yandex, Naver, Seznam, Yep and Amazon, not Google      | Adapt                  | Useful later, once title pages change often                                                   |

Sources (links actually opened):

- https://vercel.com/docs/analytics/limits-and-pricing
- https://vercel.com/docs/plans/hobby
- https://developers.google.com/search/docs/fundamentals/get-started
- https://www.bing.com/indexnow/getstarted
- https://www.indexnow.org/faq

## Options

1. **Search Console, Bing and Vercel Web Analytics, with SQL for product numbers.** Free and small, with one new dependency.
2. **Add Google Analytics.** More history and events, at the cost of a heavier script and consent work.
3. **Search Console only.** No dependency, but no view of visitors or referrers.

## Decision

Option 1. Add the `@vercel/analytics` dependency, verify Search Console with a tag or file, and count real sign-ups and activation with SQL. IndexNow waits until after launch.

## Consequences

- Analytics history lasts one month on Hobby, so record monthly numbers somewhere durable.
- Collection pauses if the 50,000-event limit is exceeded.
- First confirm which Vercel account owns the project.
- The dependency needs Flovet's approval (`CLAUDE.md`); approving this decision gives it.
