# 0002: App shell and navigation

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: UX, UI, Product, Frontend, Tech Lead)
- **Approved:** 2026-11-06 by Flovet
- **Specs:** —

## Context

The brief: "on desktop, a fixed left sidebar for navigation, one central content column, and an optional right rail (progress, suggestions). On mobile, a bottom tab bar with the central column full width. Few top-level sections, always visible." Today there is a top header with "Log in"/"Settings" and a theme toggle. See [the design brief](../design/design-brief.md) §9.

## Research

| Reference                | What they do                                                                                                                                                                                           | Adopt / adapt / reject | Why                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| X (web)                  | Three columns: nav sidebar (about 275 px), main column (about 600 px), right rail (about 350 px) for trends and suggestions; the sidebar collapses to icons on narrower screens; bottom tabs on mobile | Adopt                  | The brief's layout reference; proven at every width               |
| Duolingo (web and app)   | Left sidebar with a few large labelled items on desktop, bottom tabs in the app, a right rail with progress (streak, quests)                                                                           | Adapt                  | Same shell. Our right rail shows progress without guilt mechanics |
| Letterboxd (app)         | Bottom tab bar, dense poster grids in the content area                                                                                                                                                 | Adopt (mobile)         | Grids need the full width on phones                               |
| NN/g, visible navigation | Visible navigation beats hidden menus for discoverability                                                                                                                                              | Adopt                  | No hamburger menu for top-level sections                          |

Sources (opened): https://blog.duolingo.com/core-tabs-redesign/

Seen in search results only, not opened: https://awesome.ecosyste.ms/projects/github.com%2Fbluebirdback%2Fx-twitter-column-resizer (X column widths, community-measured) · https://screensdesign.com/apps/letterboxd/ (Letterboxd mobile grid and bottom tabs) · https://blakecrosley.com/guides/design/letterboxd

From team knowledge, not re-checked this session: Duolingo's web sidebar and right rail, and the NN/g visible-navigation guidance. Check them on the live products before approving if they matter to you.

## Options

1. **Responsive three-part shell (recommended):** bottom tabs < 768 px; icon rail 768–1023; labelled sidebar ≥ 1024; right rail ≥ 1280.
2. **Top header everywhere (today):** simplest, but it contradicts the brief and wastes vertical space on phones.
3. **Sidebar on desktop, hamburger on mobile:** hides navigation on the device most people use.

## Decision

Proposed: option 1.

| Width        | Layout                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| < 768 px     | Top bar 56 px (logo or page title, one context action) · content full width, 16 px gutters · bottom tab bar 64 px + `env(safe-area-inset-bottom)` |
| 768–1023 px  | Left rail 72 px (icons, tooltip labels) · content                                                                                                 |
| 1024–1279 px | Left sidebar 240 px (icon + label, account and settings at the bottom) · content                                                                  |
| ≥ 1280 px    | Sidebar · content · right rail 320 px (hidden on pages with nothing to put there)                                                                 |

- Content column max width: 640 px for reading pages, 960 px for grids.
- Planned top-level sections (at most five): **Rate**, **Discover**, **Library**, **Profile** (Settings sits under Profile and in the sidebar footer).
- **A nav item ships with its feature's spec.** Until then it doesn't appear: no dead links, no "coming soon". At first the shell has only the logo, the account entry (Log in / Profile and Settings) and the theme toggle.
- Signed-out visitors see the same shell, with a "Create account" primary button where the account entry sits.
- Auth and onboarding (`/auth/*`) use a focused layout without navigation: split screen ≥ 1024 px (form + placeholder-poster collage), single column on phones, step indicator for account → username.
- The layout still never reads cookies (catalog pages must stay static); the account entry keeps reading the session in the browser, as `AccountLink` does today.

## Consequences

- `layout.tsx` gets a shell component with route groups: `(app)` with the shell and `(focus)` for auth. URLs don't change.
- The header and footer components are replaced. Dataset attribution (ODbL credit) needs a home: sidebar footer on desktop, the Settings/About page on phones.
- Reviews check the four breakpoints (360, 768, 1024, 1440 px), keyboard order (skip link → nav → content), and that the active tab has `aria-current="page"`.
