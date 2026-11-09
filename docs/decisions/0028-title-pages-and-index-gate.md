# 0028: Public title pages with a gated search index

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Product, Tech Lead, Frontend, Database, Copy)
- **Approved:** 2026-11-08 by Flovet
- **Specs:** (filled in when a spec implements it)

## Context

AniKansou has 38,337 titles and no page for any of them: `/anime/1` returns 404 and the sitemap lists only the homepage, so search engines have nothing useful to index. The dataset has no synopses, and the brief forbids showing its score. Google's scaled content policy targets many low-value pages made mainly to rank, so publishing every title at once is a real risk.

## Research

| Reference              | What they do                                                                                             | Adopt / adapt / reject | Why                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| Google spam policies   | Scaled content abuse covers many low-value pages, however they are made                                  | Adopt                  | Index only pages with real content, and grow in steps                                    |
| Google review snippets | `AggregateRating` needs ratings sourced directly from users; `Movie` and `CreativeWorkSeries` are listed | Adopt                  | Use own users' ratings only. Test `TVSeries` in the Rich Results Test, as it isn't named |
| Letterboxd             | Film pages combine details, ratings and member reviews                                                   | Adapt                  | Same shape; our community layer starts empty, so the first pages rely on metadata        |
| Vercel Hobby limits    | 4 CPU-hours, 1,000,000 invocations, 5,000 image transformations a month                                  | Adopt                  | Title pages must be cached                                                               |

Sources (links actually opened):

- https://developers.google.com/search/docs/essentials/spam-policies
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/appearance/structured-data/review-snippet
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://vercel.com/docs/plans/hobby
- Own data, queried 2026-11-08: 8,918 TV and movie titles pass the gate below; 368 of them are from 2026 onward; 188 titles have a stored poster.

## Options

1. **Index every title.** Maximum reach, highest risk under the spam policy, and the heaviest crawl load on Hobby.
2. **Gated index that grows in steps.** Every title gets a page; only those with complete data are indexed. Slower, far lower risk.
3. **No title pages until reviews exist.** Safest, but nothing to rank for months, and reviews need visitors first.

## Decision

Option 2.

- URLs are `/anime/[id]-[slug]`, using the stable bigint ID. Merged titles redirect through `catalog.anime_redirects`.
- A page is indexable only with a score, episodes, a year, at least 3 tags and at least 1 studio. Other pages are public, carry `noindex` and stay out of the sitemap.
- The first set is the top 500 by internal score plus titles from 2026 onward, at most 868 pages. Expand when about 70% of submitted pages are indexed. The 70% is a working rule, not a Google figure.
- The score selects pages only and is never shown (brief).
- Pages show all known titles as visible text. No synopses from AniList (0017 covers images only), and no bulk AI-generated text. Hand-written takes are welcome.
- JSON-LD uses `TVSeries` or `Movie`. `AggregateRating` comes only from real users' ratings, and only after test data is gone.
- Crawler visits never trigger AniList lookups: bots get the stored poster or the generated one, keeping to 0017.
- Pages are cached. Every page carries the ODbL credit.
- Add one Winter 2027 season page. Studio pages wait for the name cleanup (0020).

## Consequences

- Search Console becomes the check for each expansion step.
- Most first-set pages will show generated posters until lookups have run. Filling posters ahead of time would need a new decision.
- Test accounts must be removed before any public count or rating ships.
- A review should check: `noindex` on ungated pages, gated URLs only in the sitemap, no AniList calls on bot requests, no dataset score in HTML or JSON-LD, and caching on title pages.
