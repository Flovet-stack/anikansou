# 04: UI refresh of the existing pages

Status: Done (PR #11) · Written: 2026-11-06

Brief: Design direction ("no generic UI", dark first, sidebar shell) and Must have #24 (dark mode). This task puts the approved design system into code and restyles the pages that exist today. It adds no new features.

## Goal

The app stops looking like a default shadcn/Next.js template. The tokens, fonts, icons and app shell from the approved design decisions are built once, and every existing page (home, log in, sign up, username, settings, 404, error) is rebuilt on them. Every later feature then inherits the system instead of restyling from scratch.

## Decisions

Implements [0001](../docs/decisions/0001-visual-foundations.md) (colour, type, spacing, radius, motion; dark tokens only), [0012](../docs/decisions/0012-dark-theme-only.md) (dark theme only for now), [0002](../docs/decisions/0002-app-shell-and-navigation.md) (app shell), [0003](../docs/decisions/0003-icon-set.md) (Hugeicons via icons-animated), [0004](../docs/decisions/0004-placeholder-poster-art.md) (generated fallback poster) and [0007](../docs/decisions/0007-interaction-and-disclosure.md) §1–2 (explicitness tiers, hover). Screen direction from [the design brief](../docs/design/design-brief.md) §11. Uses the poster-sources contract from [spec 03](03-poster-sources.md) (`resolvePosterUrls` output: an ordered list of URLs) but doesn't depend on it being merged.

## Acceptance criteria

### Foundations

1. **Tokens:** `src/app/globals.css` defines every **dark** colour role from 0001 and the dark state roles from [0005](../docs/decisions/0005-status-and-action-colours.md), and nothing else (no light values, per 0012), mapped onto shadcn's variable names (`--background`, `--primary`, `--ring` …) plus our own (`--surface-1..3`, `--text-subtle`, `--accent-text`, `--state-*`). Spacing scale, radius (`sm 6`, `md 10`, `lg 16`, `full`), motion durations and easings from 0001 are Tailwind theme values. No grayscale shadcn defaults remain.
2. **Dark only, switcher hidden** (0012): the theme provider forces dark (`forcedTheme="dark"` or the equivalent in the installed `next-themes`), so a stored "light" or "system" preference has no effect. The theme-switching logic and the `ThemeToggle` component stay in the code, restyled with the new tokens and covered by a unit test, but are **not rendered anywhere**. Turning light mode on later means adding light tokens, removing the forced theme and placing the toggle.
3. **Contrast test:** a unit test computes WCAG contrast for every dark token pair listed in 0001 and 0005 and fails if any falls below the stated ratio.
4. **Fonts:** Geist is removed. Bricolage Grotesque (display, 700–800, optical size axis) and Onest (400–600) load through `next/font/google` as `--font-display` and `--font-sans`. The Japanese fallback stack from 0001 is a `--font-jp` token.
5. **Icons:** before installing, confirm the Hugeicons set in icons-animated has the icons 0003 lists; record the result in the PR. Install only the icons this spec uses through the registry (`pnpm dlx shadcn add @icons-animated/hugeicons-<icon>`), which brings the Motion packages pinned by the library (`motion@13.1.1` and friends; dependency approved in 0003). Add the library's `LICENSE` and `THIRD_PARTY_NOTICES.md`. Icons are `aria-hidden`, animate only on hover, press or state change, and stay still under `prefers-reduced-motion`.
6. **Base components restyled, not replaced:** `Button` (primary amber with ink text and the 3 px "lip" that flattens on press; secondary `surface-2`; ghost; all pill-shaped, min height 44 px), `Input` (`surface-2` fill, 10 px radius, amber focus ring), `Label`, `FormMessage` (error in `danger` with an icon). Hover follows 0007 §2 (tint, fast in, 150 ms out) and lives only inside `@media (hover: hover) and (pointer: fine)`; press scales to 0.97 everywhere. Focus is a 2 px amber ring with 2 px offset on every interactive element.
7. **`PosterArt` component** (0004): props `animeId`, `nativeTitle?`, `romajiTitle`, `format?`, `year?`, `urls?: string[]`. Renders the first URL that loads, tries the next on error, and shows the generated poster when the list is empty, every URL fails, or while the first is still loading. Deterministic: same `animeId` gives the same gradient on server and client. All decorative text is `aria-hidden`. Unit tests cover the colour pick, the fallback order and the empty list.

### App shell (0002)

8. Route groups: `src/app/(app)/` gets the shell; `src/app/(focus)/` holds the auth pages. URLs don't change.
9. Shell per 0002's breakpoint table: bottom tab bar under 768 px, 72 px icon rail 768–1023, 240 px labelled sidebar from 1024, right rail from 1280 only on pages that fill it (none yet, so it doesn't render).
10. **Nav items:** none of the planned sections exist yet, so the shell shows only the logo (link home) and the account entry. On phones the bottom bar holds the account entry until sections ship. No theme toggle is shown (0012). The `Rate` item arrives with [spec 05](05-swipe-deck.md), not here.
11. **Account entry:** signed out, a "Log in" link plus a primary "Create account" button; signed in, a "Settings" link (profile pages don't exist yet). It still reads the session in the browser; layouts never read cookies.
12. A "Skip to content" link is the first focusable element. Focus order: skip link → nav → content. The current page's nav item has `aria-current="page"`.
13. **Dataset attribution** (ODbL credit for cedya77 and manami-project) moves from the footer to the sidebar footer on desktop and to the bottom of Settings on phones; the text is unchanged.

### Pages

14. **Home `/` (signed out and signed in, until the deck lands):** a hero with the 感想 mark, one line on what AniKansou is ("Rate, track and remember every anime you watch" or better from the copy pass), a "Create account" primary button and "Log in" secondary link, beside a collage of 6–8 generated posters (fixed sample anime ids; no network images). The hero isn't `100vh`. Keeps the WebSite JSON-LD and metadata exactly as now.
15. **Log in and sign up** in the focused layout: split screen from 1024 px (form left, poster collage right), single column below. The Google button is a secondary pill with a Google mark from the icon set, or text only if the set has none (no other icon libraries). Copy follows the Copy Expert rules. All current behaviour (errors, `next` parameter, password hint) is unchanged.
16. **Username:** a two-step indicator ("Account" done, "Username" current), the `@` prefix inside the field, the rules shown as a hint before any error, and a live preview line ("Shown as @mika"). Behaviour unchanged.
17. **Settings** inside the shell: Account and Profile sections on `surface-1` panels with generous spacing (0001), the read-only username and email as label/value pairs, the display-name form, and Log out as a secondary button at the bottom. Behaviour unchanged.
18. **404:** a generated poster with a short on-brand line ("This episode doesn't exist") and a primary "Go home" button. **Error:** the same layout with "Something went wrong" and "Try again". Both inside the shell.
19. **Spacing:** sections at least 48 px apart on phones and 64 px on desktop; no page reads as cramped at 360 px.

### Tests

20. Existing e2e tests (`e2e/smoke.spec.ts`, `e2e/accounts.spec.ts`) are updated only where visible text or structure changed, and all pass. The home `h1` test checks the new heading.
21. New e2e checks: the shell renders the right navigation at 360, 768, 1024 and 1440 px; the skip link moves focus to the content; the page is dark with a fresh profile and with a stored "light" preference, and no theme toggle is visible. The existing smoke test for the toggle is replaced by these checks.
22. Screenshots of every page at 390 px and 1440 px (dark) are attached to the PR.

## Out of scope

- The light theme: tokens, toggle placement and tests (0012).
- New pages or nav sections (Rate, Discover, Library, Profile), the right rail's content.
- `TitleCard`, `StatusBadge`, `ActionToggle`, menus, sheets and toasts: built by the first spec that needs them (spec 05).
- Fetching real posters for the home collage (spec 03 data, used by spec 05 onward).
- Copy changes to errors and validation beyond tone (rules stay the same).
- Replacing `lucide-react` everywhere: remove it only if nothing imports it after this spec.

## Edge cases

- A user who chose "light" before this change now sees dark; their stored preference is ignored, not deleted.
- Long display names and emails wrap in Settings without widening the page.
- The auth collage hides under 1024 px and never pushes the form below the fold.
- Fonts fail to load: the fallback stacks keep layout shift under CLS 0.1.
- JavaScript disabled: the shell, links and forms still work (server actions), and the theme falls back to dark.

## Files and patterns to follow

- Tokens and theme: `src/app/globals.css`, `src/components/theme/*`.
- Layout: `src/app/layout.tsx` (keep the comment about never reading cookies), new `src/components/layout/app-shell.tsx`, `focus-shell.tsx`; replace `site-header.tsx` and `site-footer.tsx`.
- Account entry: keep the browser-side session check pattern in `account-link.tsx`.
- Base components: `src/components/ui/*` (restyle in place).
- Poster: `src/components/poster/poster-art.tsx`.
- Read `node_modules/next/dist/docs/` for route groups and `next/font` in this Next.js version before writing code (AGENTS.md).

## Boundaries

- **Always:** use tokens, never raw hex or one-off sizes in components; keep every current behaviour and test meaning; WCAG 2.2 AA in the dark theme.
- **Ask first:** any dependency beyond the icons and their pinned Motion packages; any auth, proxy or schema change (none expected).
- **Never:** load images from other sites; call any external anime API; leave a shadcn or Tailwind default unrestyled; add nav items for sections that don't exist.

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build` all pass.
- Contrast unit test passes.
- Screenshots at 390 and 1440 px for every page, plus keyboard-only walkthrough notes (skip link, focus ring visible everywhere).
- Workflow E review against this spec and decisions 0001–0005 and 0007, posted on the PR.
