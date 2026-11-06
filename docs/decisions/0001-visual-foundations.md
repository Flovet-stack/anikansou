# 0001: Visual foundations (colour, type, spacing, shape, motion)

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: UI, UX, Product, Frontend, Tech Lead)
- **Approved:** 2026-11-06 by Flovet (Kohaku accent, Bricolage Grotesque + Onest, type scale and palette). Amended at approval: more generous spacing; like, watchlist and status colours are split out to [0005](0005-status-and-action-colours.md).
- **Specs:** —

## Context

Every screen today uses the shadcn/ui defaults: a grayscale palette, Geist, default radius. The brief asks for "dark theme first; a single warm, vivid accent colour on near-black surfaces; bold, poster-forward cards; strong type hierarchy" and says "the product must never look like a default shadcn/ui or Tailwind template". The full reasoning is in [the design brief](../design/design-brief.md) §8. This entry fixes the token values.

## Research

| Reference                                                                                                         | What they do                                                                                                                                              | Adopt / adapt / reject | Why                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Crunchyroll (2024 rebrand)                                                                                        | Orange, black, white and taupe; custom Atyp typeface; orange kept for a few CTAs only (third-party extraction gives `#ff5e00`, `#151515`)                 | Adapt                  | Same idea (one hot accent used sparingly on near-black), but a different hue, so we don't borrow their brand colour |
| Letterboxd                                                                                                        | Near-black blue-grey base (around `#14181c`), dark-only marketing pages, small coloured accents, poster art carries the page                              | Adapt                  | Dark base lets art lead. We use a warm tint instead of a blue one                                                   |
| Duolingo                                                                                                          | Named colours with roles, rounded shapes ("pointy shapes are off-brand"), a reduced type system after the core-tabs redesign, whitespace instead of boxes | Adapt                  | Rounded, friendly shape; few type styles; fewer containers. Not their green or their bright light theme             |
| Material Design dark theme                                                                                        | `#121212` base, higher surfaces lighter via overlays, avoid bright large surfaces, accents tested for AA at every elevation                               | Adopt                  | Surface ramp instead of shadows; contrast checked at each step                                                      |
| Material 3 motion                                                                                                 | Standard and emphasized easing curves, durations tied to distance                                                                                         | Adopt                  | Proven values; saves inventing our own                                                                              |
| Atlassian foundations                                                                                             | Tokens first; separate pages for colour, type, spacing, grid, radius, elevation, iconography                                                              | Adopt (structure)      | Matches how this entry and the brief are organised                                                                  |
| Competitors' accents: MAL and AniList (blue), Crunchyroll (orange), Letterboxd (green/orange/blue), IMDb (yellow) | —                                                                                                                                                         | Avoid                  | Our accent should not be mistaken for any of them                                                                   |

Sources (opened): https://www.anitrendz.com/news/2024/07/18/crunchyroll-debuts-new-branding-logo-fonts-more-ahead-of-san-diego-comic-con-2024 · https://blog.duolingo.com/core-tabs-redesign/ · https://atlassian.design/foundations

Seen in search results only (summaries, third-party, unverified): https://www.shadcn.io/design/crunchyroll (Crunchyroll hex values) · https://blakecrosley.com/guides/design/letterboxd and https://contra.com/p/6ZPPWlRX-uiux-redesign-for-letterboxd-app (Letterboxd base colour) · https://m2.material.io/design/color/dark-theme (page didn't render; content from search summary) · https://www.canny-creative.com/brand-breakdown/brand/duolingo/ (Duolingo type and shape). The Material 3 easing values come from team knowledge; m3.material.io didn't render.

Contrast was calculated with the WCAG 2.x relative-luminance formula from the OKLCH values below (script kept out of the repo; rerun in the foundations spec as a unit test).

## Options

### Accent colour (the open choice)

| Option                             | Value                            | On bg  | Ink text on it | White text on it        | Clashes with                                                               |
| ---------------------------------- | -------------------------------- | ------ | -------------- | ----------------------- | -------------------------------------------------------------------------- |
| **A. Kohaku (amber), recommended** | `oklch(0.80 0.16 70)` `#fea92f`  | 10.2:1 | 10.2:1         | —                       | A "warning" yellow, so we drop warning as a colour                         |
| B. Tsutsuji (magenta)              | `oklch(0.66 0.24 355)` `#f83599` | 5.6:1  | 5.6:1          | 3.5:1 (large text only) | Nothing; boldest and most distinct, but less "warm" than the brief asks    |
| C. Beni (coral red)                | `oklch(0.68 0.205 15)` `#fc526e` | 6.2:1  | 6.2:1          | 3.2:1 (large text only) | Danger red (`#f84c41`): errors and the brand would look the same. Rejected |

### Font pair

1. **Bricolage Grotesque (display) + Onest (UI/body), recommended:** a characterful display face with a calm body face, both free on Google Fonts. Neither is a starter-template default.
2. Unbounded (display) + Manrope (body): wider, louder, more "poster". Unbounded gets tiring in long titles and wraps badly at 360 px.
3. Keep Geist: zero work, but it is the Next.js/shadcn starter default, the main thing that makes the app read as a template.

## Decision

Chosen: **accent A (Kohaku)** and **font pair 1**, with these tokens. Ratings are the core action and stars are naturally amber, so the accent becomes "the colour of your rating": stars, the primary button, the active nav item and the focus ring. Like, watchlist and the four statuses each get their own colour and icon, defined in [0005](0005-status-and-action-colours.md), so they can be told apart at a glance.

### Colour tokens (dark, default)

| Token         | OKLCH          | Hex       | Contrast                                                                     |
| ------------- | -------------- | --------- | ---------------------------------------------------------------------------- |
| `bg`          | 0.155 0.006 20 | `#0f0b0b` | —                                                                            |
| `surface-1`   | 0.195 0.008 20 | `#181413` | —                                                                            |
| `surface-2`   | 0.235 0.010 20 | `#231c1c` | —                                                                            |
| `surface-3`   | 0.28 0.011 20  | `#2e2727` | —                                                                            |
| `border`      | 0.34 0.012 20  | `#3e3635` | 1.7:1 on bg (decorative hairline only; never the only boundary of a control) |
| `text`        | 0.965 0.004 20 | `#f6f2f2` | 17.6:1 on bg, 15.1:1 on surface-2                                            |
| `text-muted`  | 0.76 0.012 20  | `#b9aeae` | 9.1:1 on bg, 7.8:1 on surface-2                                              |
| `text-subtle` | 0.64 0.012 20  | `#938989` | 5.8:1 on bg                                                                  |
| `accent`      | 0.80 0.16 70   | `#fea92f` | 10.2:1 on bg                                                                 |
| `on-accent`   | = `bg`         | `#0f0b0b` | 10.2:1 on accent                                                             |
| `success`     | 0.76 0.16 150  | `#58cd78` | 9.7:1 on bg                                                                  |
| `danger`      | 0.66 0.21 28   | `#f84c41` | 5.7:1 on bg                                                                  |

### Colour tokens (light)

| Token                                       | Hex                     | Contrast   |
| ------------------------------------------- | ----------------------- | ---------- |
| `bg`                                        | `#fcf9f9`               | —          |
| `surface-1`                                 | `#ffffff`               | —          |
| `text`                                      | `#1a1514`               | 17.4:1     |
| `text-muted`                                | `#5f5555`               | 6.9:1      |
| `border`                                    | `#dfd9d9`               | decorative |
| `accent` (fills)                            | `#fea92f` with ink text | 10.2:1     |
| `accent-text` (amber used as text or icons) | `#aa5f04`               | 4.6:1      |
| `danger`                                    | `#d01e1c`               | 5.2:1      |

Dark is the default theme (`defaultTheme="dark"`); light stays available through the theme toggle.

### Type

- Display: Bricolage Grotesque 700–800, tracking −1% to −2% at 31 px and up.
- UI/body: Onest 400, 500, 600.
- Scale (ratio 1.25): `caption 12` · `small 14` · `body 16` · `title-s 20` · `title-m 25` · `title-l 31` · `display-s 39` · `display-l 49` px. Line height 1.5 for body, 1.1–1.2 for display.
- Japanese: system fallback (`"Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif`) until the title-language spec.

### Spacing, radius, elevation, motion

- Spacing: Tailwind's 4 px scale, limited to 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128. Space is generous by default: when in doubt, use the next step up. Sections are separated by 64–96 px on desktop and 48–64 px on phones; card grids use 24–32 px gaps.
- Radius: `sm 6` · `md 10` · `lg 16` · `full`.
- Elevation (dark): step up the surface ramp; 1 px `border` hairline; shadow `0 12px 32px rgb(0 0 0 / 0.5)` only on floating layers.
- Motion: `fast 120ms`, `base 200ms`, `slow 320ms`; `ease-standard cubic-bezier(0.2, 0, 0, 1)`, `ease-emphasized cubic-bezier(0.05, 0.7, 0.1, 1)`; reduced motion → ≤120 ms opacity fades only.

Trade-off noted by UI vs Product: magenta (B) is more distinctive; amber (A) fits the brief's "warm" and ties the brand to ratings. Flovet chose A.

## Consequences

- `globals.css` gets new tokens mapped onto shadcn's variable names (`--primary`, `--background` …) so library components restyle without forks; extra roles (`surface-1..3`, `text-subtle`, `accent-text`) are added.
- `layout.tsx` swaps Geist for the two new fonts via `next/font/google`.
- No "warning" colour: warnings are neutral with an icon and text.
- Reviews check: no raw hex or arbitrary sizes in components; contrast unit test passes for every token pair above; default theme is dark.
