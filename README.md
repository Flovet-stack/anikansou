# AniKansou

A Letterboxd-style site for anime, where users log, rate, review and list what they watch. Kansou (感想) means "thoughts after watching".

Accounts are in place (spec 02): email and Google sign-in, a `profiles` table and `/settings`. The anime catalog is imported into a `catalog` schema (spec 01); there are no catalog pages on top of it yet.

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

| Command                        | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `pnpm dev` / `build` / `start` | Run, build, and serve the app                            |
| `pnpm lint` / `lint:fix`       | ESLint. `next build` does not lint                       |
| `pnpm format` / `format:check` | Prettier                                                 |
| `pnpm typecheck`               | Generate route types, then run `tsc`                     |
| `pnpm test` / `test:watch`     | Vitest unit tests (offline)                              |
| `pnpm test:db`                 | Database tests (RLS, constraints) against Supabase       |
| `pnpm test:e2e`                | Playwright against a production build and Supabase       |
| `pnpm sync:catalog`            | Import the pinned dataset release (needs `DATABASE_URL`) |
| `pnpm sync:bump`               | Move the dataset pin to the newest weekly release        |

Run `pnpm exec playwright install chromium` once before the first E2E run.

`test:db` and `test:e2e` sign up throwaway users (`db-…`, `e2e-…`) in the Supabase project named in `.env.test`. Copy `.env.test.example` to `.env.test` and fill in its URL and publishable key. The project needs email confirmation off and every migration applied. Delete the test users when convenient. Once AniKansou has real users, move the tests to a separate project.

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

Title search runs on `catalog.anime_titles` (one row per title, trigram-indexed). Filter with `search_text %> $query`, which the index serves, not `$query <% search_text`. See [src/sync/README.md](src/sync/README.md#searching-titles).

### SEO

- Use `buildMetadata` from `lib/seo/metadata` on every page. Next.js merges metadata shallowly, so setting `openGraph` directly drops the shared fields.
- Never set a canonical in a layout, because children inherit it.
- Slugs are `/anime/[slug]`: lowercase, hyphenated and based on romaji. Store each slug once and never regenerate it. Break collisions with the year, then the format. A renamed slug gets a permanent redirect. External IDs never appear in URLs.
- `robots.ts` blocks everything unless `VERCEL_ENV=production`, and blocks `/search`, `/api/`, `/auth/` and `/settings` in production. Keep curated browse pages crawlable.
- Each content type gets its own sitemap, listed in `lib/seo/robots.ts`. Only set `lastModified` from a real content date.
- Output JSON-LD through `<JsonLd>`, which escapes `<`. Only use `aggregateRating` for ratings from AniKansou users, never from an outside source.

### Migrations and database types

Migrations live in `supabase/migrations/`. Never edit one that has run; add a new one. Apply each migration to the Supabase project before running the tests and before merging the PR that adds it (`pnpm dlx supabase db push`). If it was applied another way, name the file after the version recorded in `supabase_migrations.schema_migrations` so `db push` doesn't run it twice.

Regenerate the types and commit them:

```bash
pnpm dlx supabase gen types typescript --project-id <project-ref> --schema public --schema catalog > src/types/database.types.ts
```

## Accounts

| Route            | What it does                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `/auth/sign-up`  | Email + password sign-up, or Continue with Google                 |
| `/auth/login`    | Email + password log-in, or Continue with Google                  |
| `/auth/callback` | Route Handler that finishes Google sign-in (PKCE code exchange)   |
| `/auth/username` | First-sign-in step: pick a username, which can't be changed later |
| `/settings`      | Protected example page: username, email, display name and log-out |

- `src/proxy.ts` refreshes the session on `/auth/*` and `/settings/*` and does the signed-in redirects (signed out → login, no username → username step) as real HTTP redirects. Server Actions and pages check the user again with `getClaims()`.
- Every post-sign-in destination goes through `safeNext` in `features/auth/schemas.ts`. Redirect URLs are built from the request's origin, so the same build works on localhost, Vercel previews and production.
- `public.profiles` has one row per auth user, created by a trigger on sign-up. Everyone can read it; users can update only their own `username` (once) and `display_name`.

### Supabase and Google setup (per environment)

- **Site URL:** the production URL.
- **Redirect URLs:** `http://localhost:3000/**`, `<production URL>/**` and `https://<project>-*-<team-slug>.vercel.app/**` for previews (never `https://*.vercel.app/**`). A redirect URL missing from the list silently falls back to the Site URL, which shows up as a PKCE "missing code verifier" error.
- **Google:** enable the provider with a Google Cloud OAuth client whose authorized redirect URI is the Supabase callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`).
- **Email:** confirmation off, minimum password length 8.

> **Before public launch: turn email confirmation on.** While it's off, someone can sign up with another person's email and a password they choose. If the real owner later signs in with Google, Supabase links the Google identity into that account and the other person's password keeps working.

## Data source

The only anime data source is [anime-offline-database](https://github.com/cedya77/anime-offline-database), the cedya77 fork, which publishes weekly releases tagged `<year>-<week>`. No external anime APIs are used, now or planned.

**How the database is set up, updated and repaired: [supabase/README.md](supabase/README.md).**

The importer (`pnpm sync:catalog`) loads a pinned release into a separate `catalog` schema, and a weekly workflow opens a PR to move the pin. See [src/sync/README.md](src/sync/README.md) for how it works and how to run it.

**License:** the database is under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/) and its contents are under the [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).

**Attribution** must credit both projects:

> Anime data from [cedya77/anime-offline-database](https://github.com/cedya77/anime-offline-database), which continues the archived [manami-project/anime-offline-database](https://github.com/manami-project/anime-offline-database). Made available under the Open Database License 1.0, with contents under the Database Contents License 1.0.
