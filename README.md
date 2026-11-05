# AniKansou

A Letterboxd-style site for anime, where users log, rate, review and list what they watch. Kansou (感想) means "thoughts after watching".

This is the project foundation. There are no product features, database tables or data sync yet.

**Stack:** Next.js (App Router, Cache Components), TypeScript (strict), Tailwind CSS, shadcn/ui, Supabase and Vercel. There is no separate backend, ORM or Redis.

## Setup

Requires Node.js 20.9+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev                     # http://localhost:3000
```

You need a Supabase project for the URL and publishable key (Project Settings > API). The build fails if a variable is missing or malformed. Add new variables to [src/env.ts](src/env.ts) and `.env.example`, and read them through `env`, not `process.env`.

On Vercel, set the same three variables, with `NEXT_PUBLIC_SITE_URL=https://anikansou.com` in production.

## Scripts

| Command                        | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `pnpm dev` / `build` / `start` | Run, build, and serve the app                                |
| `pnpm lint` / `lint:fix`       | ESLint. `next build` does not lint                           |
| `pnpm format` / `format:check` | Prettier                                                     |
| `pnpm typecheck`               | Generate route types, then run `tsc`                         |
| `pnpm test` / `test:watch`     | Vitest unit tests                                            |
| `pnpm test:e2e`                | Playwright against a production build, using placeholder env |

Run `pnpm exec playwright install chromium` once before the first E2E run.

Git hooks: pre-commit runs ESLint and Prettier on staged files, and pre-push runs the typecheck and unit tests.

## Structure

```text
src/
├─ app/                  Routing only: pages, layouts, robots, sitemap, OG image
├─ components/
│  ├─ ui/                shadcn components (add with: pnpm dlx shadcn@latest add <name>)
│  ├─ layout/            Header and footer
│  └─ theme/             Theme provider and dark mode toggle
├─ features/             One folder per domain, created with its first file
├─ lib/
│  ├─ supabase/          browser, server, public and proxy clients
│  └─ seo/               Site config, metadata helper, JSON-LD, robots rules
├─ sync/                 Dataset importer, placeholder (see Data source)
├─ types/                Generated database types
├─ env.ts                Validated environment variables
└─ proxy.ts              Session refresh for signed-in areas
supabase/migrations/     Database migrations
e2e/                     Playwright tests
```

The planned features are `catalog`, `search`, `tracking`, `reviews`, `lists`, `stats`, `social` and `profiles`. A feature folder will hold `queries.ts` (server reads), `queries.client.ts` (browser reads of per-user data), `actions.ts` (mutations), `schemas.ts` (validation) and `components/`. Don't add barrel `index.ts` files.

Unit tests sit beside the code as `*.test.ts` and run in Node. Tests for client components start with `// @vitest-environment jsdom`. Async Server Components are covered by Playwright, because Vitest can't render them.

## Conventions

### Data access

- Only `features/*/queries.ts`, `queries.client.ts` and `actions.ts` use Supabase clients. ESLint enforces this, and application code cannot import `@/sync`.
- Pick the client by context:

| Client                 | Use for                                        | Notes                                          |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `lib/supabase/public`  | Public reads, including inside `use cache`     | No cookies. Runs as `anon`, so RLS applies     |
| `lib/supabase/server`  | Server Actions, Route Handlers, uncached reads | Acts as the user. **Fails inside `use cache`** |
| `lib/supabase/browser` | Client Components                              | Per-user state on public pages                 |

- On the server, verify users with `auth.getClaims()`. Never trust `auth.getSession()`.
- Every table has RLS from its first migration. Index the columns policies filter on, write `(select auth.uid())` so it is evaluated once, and name the roles a policy applies to.

### Rendering and caching

- Server Components by default. Use client components only for interactive parts.
- **Layouts never read cookies or headers.** Catalog pages are fully static, and that requirement extends to every layout above them. Load the user menu and other per-user state in the browser.
- Catalog pages use `use cache` with an explicit `cacheLife` and `cacheTag`, and export `ensureStatic = 'navigation'`. Prerender popular titles with `generateStaticParams` and let the rest generate on first visit. It must return at least one param.
- Don't rely on `use cache` at runtime for dynamic routes such as search. On serverless its entries generally don't survive between requests, so search speed has to come from Postgres indexes.
- Deploys start with an empty cache, so avoid `new Date()` or `Math.random()` in cached output, which also cause needless ISR writes.
- Call `notFound()` before any `<Suspense>`. Once streaming starts, the status is locked at 200.
- `proxy.ts` is an allowlist of signed-in areas. Add a route only if its server code needs a fresh session.

### Search

Use a generated `tsvector` column with a GIN index and the `simple` config, plus `pg_trgm` for typos, and keyset pagination. Test against real Japanese titles before relying on it.

### SEO

- Use `buildMetadata` from `lib/seo/metadata` on every page. Next.js merges metadata shallowly, so setting `openGraph` directly drops the shared fields.
- Never set a canonical in a layout, because children inherit it.
- Slugs are `/anime/[slug]`: lowercase, hyphenated and based on romaji. Store each slug once and never regenerate it. Break collisions with the year, then the format. A renamed slug gets a permanent redirect. External IDs never appear in URLs.
- `robots.ts` blocks everything unless `VERCEL_ENV=production`, and blocks `/search`, `/api/`, `/auth/` and `/settings` in production. Keep curated browse pages crawlable.
- Each content type gets its own sitemap, listed in `lib/seo/robots.ts`. Only set `lastModified` from a real content date.
- Output JSON-LD through `<JsonLd>`, which escapes `<`. Only use `aggregateRating` for ratings from AniKansou users, never from an outside source.

### Database types

Once migrations exist, regenerate the types and commit them:

```bash
pnpm dlx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.types.ts
```

## Data source

The only anime data source is [anime-offline-database](https://github.com/cedya77/anime-offline-database), the cedya77 fork, which publishes weekly releases tagged `<year>-<week>`. No external anime APIs are used, now or planned.

**The importer is the next step for the catalog.** It will load a pinned release into a separate `catalog` schema. See [src/sync/README.md](src/sync/README.md) for the design.

**License:** the database is under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/) and its contents are under the [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).

**Attribution** must credit both projects:

> Anime data from [cedya77/anime-offline-database](https://github.com/cedya77/anime-offline-database), which continues the archived [manami-project/anime-offline-database](https://github.com/manami-project/anime-offline-database). Made available under the Open Database License 1.0, with contents under the Database Contents License 1.0.
