# 0001: Internationalization approach

- **Status:** Proposed
- **Proposed:** 2026-11-06 by the product team (roles: Tech Lead, PM, Product, UX, UI, Copy, Database, Frontend, Backend)
- **Approved:** (pending)
- **Supersedes:** none
- **Specs:** (filled in when a spec implements it)

## Context

Flovet wants AniKansou available in more than one language. Nothing in the brief covers interface languages yet. Related scope that already exists:

- Brief, feature 10: "Title language toggle (English, romaji, native)". This is about anime titles, not the interface.
- Brief, feature 39 (can wait): "Auto-translated reviews and comments".
- Brief, constraints: "No paid APIs or services beyond hosting basics"; "WCAG 2.2 AA; mobile first".
- `src/app/layout.tsx`: the root layout must never read cookies or headers, so catalog pages stay fully static.
- `catalog.anime_titles.lang` exists but is empty (spec 01). Tags and genres come from the dataset as English strings (3,139 distinct tags).

So "internationalization" has three separate layers, and this decision covers only the first:

1. **Interface text** (buttons, labels, errors, emails, SEO metadata, dates, numbers): this decision.
2. **Catalog content** (titles, tags): already covered by feature 10 for titles; tags are discussed under Consequences.
3. **User content** (reviews, comments): stays in the language it was written in; translating it is feature 39, later.

## Research

| Reference                                                                                 | What they do                                                                                                                                                                                                                                                                                                                                                                                                           | Adopt / adapt / reject                                                                                | Why                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crunchyroll (web, checked 2026-11-06)                                                     | 16 interface languages. Locale is a path prefix: `/fr/`, `/de/`, `/es/` (Latin America), `/es-es/` (Spain), `/pt-br/`, `/pt-pt/`, `/ar/`, `/hi/`, `/zh-tw/` and so on. English has **no prefix**. The selector shows each language as "English name / native name". `<html lang>` follows the locale (`fr` on `/fr/...`). Content IDs and slugs stay the same in every locale (`/fr/series/GRDV0019R/jujutsu-kaisen`). | **Adopt** prefix routing, unprefixed English, "native name" selector, same slugs across locales.      | Shareable, crawlable URLs per language; the locale is in the URL, so pages stay static. Same slugs mean no per-language slug table.                                     |
| Crunchyroll language list                                                                 | English, Indonesian, German, Spanish (LatAm), Spanish (Spain), French, Italian, Portuguese (Brazil), Portuguese (Portugal), Russian, Arabic, Hindi, Korean, Polish, Thai, Chinese (Traditional).                                                                                                                                                                                                                       | **Adapt** as our long-term candidate list.                                                            | It's the best signal we have for where anime fans outside Japan are, from the largest anime-only service. We can't afford 16 languages of copy at launch.               |
| Crunchyroll localized metadata                                                            | Titles and synopses are translated per locale by licensors.                                                                                                                                                                                                                                                                                                                                                            | **Reject** for now.                                                                                   | Our dataset has no language-tagged titles or synopses, and we can't call external APIs to get them. Feature 10 (romaji / English / native) covers titles instead.       |
| Letterboxd (web, checked 2026-11-06)                                                      | Interface is **English only** (`<html lang="en">`, no hreflang, no language setting). Film pages show the English title with the **original title** beneath it (Spirited Away shows 千と千尋の神隠し). Reviews stay in whatever language the user wrote them in. Fans fill the gap with third-party browser extensions.                                                                                                | **Adopt** "user content stays as written" and "show the original title too". **Reject** English-only. | Letterboxd proves the product works globally in English, but the extension ecosystem shows real demand for translation.                                                 |
| MyAnimeList, AniList                                                                      | English interface (assumption: based on general knowledge, not verified in a browser this session). Both offer a **title language** preference (romaji / English / native) separate from the interface.                                                                                                                                                                                                                | **Adopt** keeping title language and interface language as two independent settings.                  | A French user may still want romaji titles. Mixing the two would break feature 10.                                                                                      |
| Next.js 16 guide (`node_modules/next/dist/docs/01-app/02-guides/internationalization.md`) | Recommends a `[lang]` segment under `app/`, locale detection from `Accept-Language` in `proxy.ts`, and server-only dictionaries loaded per locale.                                                                                                                                                                                                                                                                     | **Adopt** the routing shape.                                                                          | It's the framework's official pattern for the installed version.                                                                                                        |
| next-intl (next-intl.dev, routing/middleware docs)                                        | Supports Next 16 `proxy.ts`. Detects the locale from the path prefix, then a cookie, then `Accept-Language`, then the default. Supports prefix modes, ICU messages (plurals, select), and date/number formatting in Server Components. Documents composing with other proxy logic.                                                                                                                                     | **Adopt** (new dependency, needs Flovet's approval).                                                  | Plurals are the hard part: "1 like / 2 likes" has 2 forms in English, 3 in Polish and Russian, 6 in Arabic. ICU messages handle this; hand-rolled dictionaries don't.   |
| WCAG 2.2 SC 3.1.1 / 3.1.2                                                                 | Page language must be set in `lang`, and passages in another language should be marked.                                                                                                                                                                                                                                                                                                                                | **Adopt.**                                                                                            | Brief requires WCAG 2.2 AA. Screen readers need `lang` to pronounce text correctly. Native titles (Japanese) should get `lang="ja"` once `anime_titles.lang` is filled. |

Sources (links actually opened):

- https://www.crunchyroll.com/ (language selector read in the browser) and https://www.crunchyroll.com/fr/series/GRDV0019R/jujutsu-kaisen
- https://help.crunchyroll.com/hc/en-us/articles/43236641369748-What-languages-does-Crunchyroll-Support-offer (support languages: EN, FR, DE, IT, PT, ES; AR and RU by email)
- https://letterboxd.com/ and https://letterboxd.com/film/spirited-away/ (read in the browser)
- https://en.wikipedia.org/wiki/Letterboxd ("Available in: English")
- https://next-intl.dev/docs/routing/middleware
- `node_modules/next/dist/docs/01-app/02-guides/internationalization.md` (Next 16.4.4)
- https://www.gem-standard.com/p/en/185 (GEM Partners Anime Global White Paper: high anime viewing in China, India, Indonesia, Brazil, Mexico and others; country figures not read in full)

## Options

### Routing

1. **Path prefix, English unprefixed (Crunchyroll model):** `/anime/123` is English, `/fr/anime/123` is French. Pros: static pages per locale, crawlable, shareable, matches the reference. Cons: the proxy must run on public pages to redirect first-time visitors, which spec 02 avoided on purpose.
2. **Prefix on every locale, including `/en/`:** same pros, but every existing URL changes. Rejected: Crunchyroll doesn't do it and it breaks links already in production.
3. **Cookie only, no prefix:** clean URLs. Rejected: reading cookies in the layout breaks static rendering (layout rule), and search engines only ever see English.

### Translation library

1. **next-intl:** ICU plurals, formatting, typed keys, proxy helper. Cost: one dependency.
2. **Next.js's built-in dictionary pattern:** no dependency. Cost: we'd hand-write plural rules, interpolation and typing, which is exactly where bugs hide.

### First languages

1. **English + one language** to prove the setup, then add languages in small batches.
2. **Crunchyroll's top tier at once** (EN, ES-419, PT-BR, FR, DE). Five languages of copy to write and review before the setup is proven.

## Decision

The team proposes:

1. **Routing: path prefix with English unprefixed** (option 1). `[locale]` segment under `src/app/`, static params per locale, `<html lang>` and `dir` set from the locale, `hreflang` alternates and a per-locale canonical on every page.
2. **Detection:** on a first visit to an unprefixed page, the proxy reads the `NEXT_LOCALE` cookie, then `Accept-Language`, and redirects only if a supported non-English match exists. Choosing a language in the selector sets the cookie. No IP geolocation (language is not country). Crawlers that send no `Accept-Language` always get English.
3. **Library: next-intl** (needs Flovet's approval as a new dependency). Messages in `messages/<locale>.json`, ICU syntax, keys typed against `en.json`, the build fails on a missing key.
4. **Language codes:** BCP 47 as Crunchyroll uses them: `en`, `fr`, `es` (Latin America), `pt-br`, and so on. Spain Spanish and Portugal Portuguese only get their own codes if we ever add them as separate languages.
5. **Interface language and title language stay separate settings.** Changing the interface to French doesn't change romaji titles (feature 10).
6. **Formatting** of dates, numbers and the 0.5–5 star scale goes through `Intl` with the active locale (for example "4,5" in French).
7. **Rollout:** English plus **one** second language in the first spec, to prove routing, detection, SEO and plurals end to end. Then add languages in batches, in this order (based on Crunchyroll's list and fan-market data): **Spanish (LatAm), Portuguese (Brazil), French, German**, then Italian, Indonesian, Arabic (RTL) and the rest of Crunchyroll's list. Flovet picks the second language.
8. **Translation workflow:** no paid services (brief). Drafts can be AI-assisted, but every language needs a fluent human reviewer before it ships, and the selector only lists languages that are 100% translated. The copy expert keeps a glossary of terms that never get translated (Kansou, anime, romaji, sub/dub as the community uses them per language).

**Where roles disagreed:**

- **Backend vs Frontend on the proxy:** spec 02 kept public pages out of the proxy so crawler traffic never runs it. Detection needs the proxy on public pages. Trade-off accepted: the locale step is cheap (no network call), and the Supabase session refresh stays on the existing `/auth` and `/settings` allowlist only, so public pages never touch Supabase in the proxy.
- **Product vs PM on languages:** Product wanted the top five at once to reach LatAm and Brazil sooner. PM held to one language first, because review is the bottleneck and the setup has to be proven before copy multiplies. The Tech Lead sided with PM.

## Consequences

- **Every route moves under `src/app/[locale]/`.** Existing English URLs stay the same. Every visible string in existing components (auth, settings, header, footer, errors, metadata, OG image) moves into messages. This is a refactor of everything built so far, so the first spec does only this plus one language, nothing else.
- **Proxy matcher changes** to cover public pages for locale detection (excluding `_next`, static files and `api`). A review checks the Supabase refresh still runs only on its allowlist.
- **RTL readiness now, RTL later:** from now on, components use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) instead of left/right ones, so Arabic is cheap to add later. A review flags any new `ml-`/`mr-`/`left-`/`right-`.
- **Fonts:** Geist is loaded with the `latin` subset only. Languages with other scripts (Arabic, Hindi, Thai, Korean, Chinese, Russian) need a font decision before they're added. Japanese native titles already show this gap.
- **No schema change in the first spec.** The choice lives in the cookie. A saved per-account preference (so it follows the user across devices) would need a migration and must **not** go on `public.profiles`, because every column there is public. That's a separate, later decision.
- **Emails:** Supabase Auth emails stay English in the first spec. Localized auth emails are a separate later task.
- **Tags and genres:** the dataset's 3,139 tags stay in English. A later decision can translate a curated set of top genres through messages. Raw tags are never machine-translated in the database.
- **Native titles** get `lang="ja"` (or the right code) once `anime_titles.lang` is filled; until then, no `lang` on them.
- **User content** (reviews, lists, display names) is never translated or tagged by the interface locale. Feature 39 handles translation later.
- **Ruled out:** IP-based language, per-language slugs, cookie-only locale, translating catalog data in the database, paid translation services.
- **A review checks:** `<html lang>` matches the URL; `hreflang` and canonical are present; no hard-coded strings in changed components; pages are still static (`next build` output); plurals work in the second language; the selector shows native names; keyboard and screen-reader access to the selector; 360 px layout with longer translated strings (German and French run around 30% longer than English).
