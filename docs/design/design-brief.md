# AniKansou design brief

- **Status:** Approved (0001–0008). Nothing is built until a decision is approved.
- **Updated:** 2026-11-06, after Flovet's first review (generous space, distinct action colours, title beneath the card, hover effects, data-shaped components, hidden UI)
- **Written:** 2026-11-06 by the product team (roles: Product, UX, UI, Copy, Gamification, Frontend, Tech Lead)
- **Decisions:** [0001 visual foundations](../decisions/0001-visual-foundations.md) · [0002 app shell and navigation](../decisions/0002-app-shell-and-navigation.md) · [0003 icon set](../decisions/0003-icon-set.md) · [0004 fallback posters](../decisions/0004-placeholder-poster-art.md) · [0005 status and action colours](../decisions/0005-status-and-action-colours.md) · [0006 title card](../decisions/0006-title-card.md) · [0007 interaction and disclosure](../decisions/0007-interaction-and-disclosure.md) · [0008 poster sources](../decisions/0008-artwork-source.md)

This brief says what AniKansou should look and feel like and why. The decisions it links hold the research and the exact choices; this file explains how they fit together. `PROJECT_BRIEF.md` stays the source of truth for product scope.

## How this brief is structured

No single standard exists for design briefs; a Design Society study found little shared guidance on how to write one. So we combined the two halves that published sources agree on:

| Part                            | Borrowed from                                                                                                                                                                                                                                                       | Sections here |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| The brief (why, for whom)       | Design-brief guides: overview, problem, audience, goals and success criteria, scope and constraints, supporting context, sign-off before work                                                                                                                       | 1–5           |
| The system (what it looks like) | Atlassian Design System "Foundations" (tokens; colour, typography, spacing, grid, radius, elevation, iconography, illustration), GOV.UK Design System "Styles" (page structure, typography, visual elements), Material 3 (colour roles, motion easing and duration) | 6–9           |
| Proof and sign-off              | Every published system above ends in accessibility rules and contribution or approval rules                                                                                                                                                                         | 10–13         |

---

## 1. Overview

AniKansou is a Letterboxd-style log for anime: swipe through cards, rate, track, review and list. Today the app has six screens (home, log in, sign up, username, settings, plus 404 and error), all on the unchanged shadcn/ui look: grayscale tokens, Geist, a top header. The brief's design direction (sidebar shell, dark first, one warm accent, poster-forward, gamified) is not built anywhere yet.

## 2. Problem

The UI reads as a template. Nothing on screen says "anime", "your taste" or "quick and fun". That costs us on three fronts:

1. **Trust and identity:** fans compare us with Letterboxd, AniList and MyAnimeList, all of which have a recognisable look. A default look signals "unfinished side project".
2. **The core loop:** swipe-to-rate is our differentiator. It needs tactile, satisfying controls; default buttons and inputs feel like a settings form.
3. **Scale:** every feature after this one (deck, profile, lists, stats) will copy whatever the first screens do. Fixing the foundations now is cheaper than restyling 20 screens later.

## 3. Audience and context of use

- **Who:** anime fans, mostly 16–35, who already track somewhere (MAL, AniList, notes app) or want to start. Many are moving over from those sites.
- **Where:** mostly phones, one-handed, often at night right after an episode. Desktop for lists, reviews and stats.
- **What they bring:** strong taste and strong opinions; they are used to dark, art-heavy streaming apps (Crunchyroll, Netflix) and to Letterboxd's poster grid.
- **What they don't want:** guilt (broken-streak shaming), clutter, ads-like noise, or a UI that competes with the artwork.

## 4. Goals and success criteria

| Goal                                 | We know it worked when                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Looks like AniKansou, not a template | A Workflow E reviewer can't name the component library from a screenshot. No unchanged shadcn/Tailwind default ships.                      |
| Dark first, art first                | Every screen is designed in dark first; artwork or the poster placeholder is the loudest thing on any title screen.                        |
| Fast, satisfying actions             | Every quick action (rate, like, watchlist, status) gives visible feedback within 100 ms and can be done with one thumb on a 360 px screen. |
| Accessible by default                | WCAG 2.2 AA in both themes: text 4.5:1, large text and UI parts 3:1, visible focus, keyboard reachable, reduced motion honoured.           |
| One system                           | All colour, type, radius, spacing and motion values come from the tokens in decision 0001. No raw hex or one-off sizes in components.      |

## 5. Scope and constraints

**In scope for this brief:** design principles, personality, tokens (colour, type, spacing, radius, elevation, motion), the app shell, icon set, placeholder art, and the direction for the screens that already exist.

**Out of scope:** screens for features without a spec (deck, profile, lists, stats). The brief sets the rules they will follow; it does not design them.

**Constraints (from `PROJECT_BRIEF.md`):**

- References inspire only: never copy logos, names, icons, illustrations or exact brand colours.
- Artwork (0008): posters come from ranked sources in `catalog.anime_images`: in-house, then TMDB links added by hand, then AniList once AniList gives written permission. Dataset image URLs are never hotlinked and no image API is called. Titles with no image use the generated fallback poster (0004).
- Free fonts only (Google Fonts through `next/font`), no paid services.
- Next.js 16, Tailwind v4, shadcn/ui (base-nova style on Base UI) as behaviour and accessibility only.
- Icons: icons-animated, one set (0003), animated on interaction only.

---

## 6. Design principles

Eight rules every screen is checked against. When two conflict, the earlier one wins.

1. **The art leads, the chrome stays quiet.** Posters and titles are the loudest things on screen. Navigation, borders and labels sit back in muted tones. (Crunchyroll, Letterboxd)
2. **One thumb, one tap.** The common actions sit in the bottom third on phones, are at least 44 × 44 px, and never need a menu. (Duolingo, X mobile)
3. **Every action answers back.** Press states, a short animated icon, a count that ticks up. Feedback is immediate and small; celebrations are rare and short. (Duolingo)
4. **Your taste, front and centre.** Ratings, likes and lists are the user's voice. Ratings get the accent; like, watchlist and each status get their own colour and icon, so they scan at a glance (0005). Our own numbers (aggregate scores) never show. (Letterboxd; brief: the dataset score is never shown)
5. **Progress, never guilt.** We show what you've done, not what you missed. No red badges for skipped days, no shaming copy; even "Dropped" is grey, not red. (Brief: gamification without guilt mechanics)
6. **Space is a feature.** There's no such thing as too much space. When in doubt, use the next spacing step up; let a few large things breathe rather than packing many small ones. (Flovet, 2026-11-06)
7. **The data picks the shape.** Time becomes a timeline, progress a bar, status a badge, a person an avatar with a name, numbers a simple chart. We never show structured data as a plain list of text when a shape would read faster (0007 §4).
8. **Show what's needed, keep the rest one step away.** Every control is placed on purpose as obvious, easy or possible (0007 §1). What you can't see (menus, sheets, dialogs, filters, hidden actions) is designed as carefully as what you can.

## 7. Personality and voice

| AniKansou is                       | AniKansou is not                                            |
| ---------------------------------- | ----------------------------------------------------------- |
| A friend who's seen everything     | A database or a store                                       |
| Playful, quick, warm               | Childish, loud or meme-heavy                                |
| Confident about taste              | Snobbish about taste                                        |
| Japanese in spirit (感想, details) | Pastiche (fake brush strokes, "kawaii" stickers everywhere) |

Copy follows the Copy Expert rules in the product-team skill: sentence case, verbs on buttons, errors say how to fix. Japanese appears as a quiet detail (the 感想 mark, native titles on posters), never as decoration the user has to decode.

---

## 8. Foundations

Exact values, contrast checks and the research behind them are in [0001](../decisions/0001-visual-foundations.md). Summary:

### 8.1 Colour

- **Surfaces:** a warm near-black ramp (`bg #0f0b0b` → `surface-1 #181413` → `surface-2 #231c1c` → `surface-3 #2e2727`). Higher layers are lighter, as in Material's dark theme, instead of using shadows.
- **Text:** `text #f6f2f2` (17.6:1 on bg), `text-muted #b9aeae` (9.1:1), `text-subtle #938989` (5.8:1, still AA).
- **One accent, "Kohaku" (琥珀, amber) `#fea92f`:** the colour of a rating. Stars, the primary button, the active nav item and the focus ring. Ink text on amber is 10.2:1. Alternatives (magenta "Tsutsuji", coral "Beni") are compared in 0001.
- **State colours (0005):** like rose, watchlist violet, watched green, watching sky, on hold sand, dropped warm grey. Each has its own icon and passes 4.5:1 in both themes.
- **Semantic:** success green, danger red. No separate "warning" colour: it would sit too close to the accent, so warnings use neutral surfaces plus an icon and words.
- **Light theme:** supported (brief: dark mode is a feature), derived from the same roles, with a darker amber for text (`#aa5f04`, 4.6:1). Dark is the default.
- **Rule:** never colour alone for meaning; every state also has an icon, label or shape change.

### 8.2 Typography

- **Display: Bricolage Grotesque** (700–800). Poster titles, page titles, big numbers. Characterful, condensed when tight, with its own optical sizing.
- **UI and body: Onest** (400–600). Clean, warm, readable at 14 px. Counts and stats use tabular figures if Onest has them (to check in the foundations spec; fallback: Bricolage for numbers).
- **Native titles:** Japanese fallback stack now; a Japanese web font is a later decision with the title-language toggle.
- **Scale (1.25):** 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 px. Body is 16 px; never below 12 px. Display sizes clamp down on phones.
- Geist is retired: it is the default face of the Vercel/shadcn starter, one of the strongest "template" signals.

### 8.3 Spacing and grid

- 4 px base, Tailwind's existing scale, limited to 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128.
- Generous by default: sections 64–96 px apart on desktop, 48–64 px on phones; card grids 32 px gaps (16 px on phones).
- Phone gutter 16 px minimum, 24 px from tablet up.
- Poster grids: `repeat(auto-fill, minmax(200px, 1fr))` from 600 px up; two columns on phones; 2:3 posters (0006).

### 8.4 Shape, radius and elevation

- Radius: `sm 6px` (chips, thumbnails) · `md 10px` (inputs, posters) · `lg 16px` (cards, sheets) · `full` (buttons, tabs, avatars).
- Rounded and friendly, but posters stay crisp (10 px), so art still reads as art.
- Elevation in dark: lighter surface + 1 px hairline (`border #3e3635`), shadows only on floating layers (menus, sheets, toasts).

### 8.5 Iconography

- icons-animated, **Hugeicons** set (0003), 24 px in nav, 20 px inline, 1.5 px stroke look.
- Outline by default; when active, filled in its state colour (0005) or the accent for the current tab and ratings.
- Animate on hover, press or state change only; decorative (`aria-hidden`), the button carries the label.

### 8.6 Imagery: artwork and the fallback poster

Real cover art comes from ranked sources (0008): in-house, then TMDB, then AniList once AniList permits it. When none is available, it gets a generated fallback poster (0004): a two-colour gradient picked from the title's ID, a grain texture, the native title set large and vertically as typographic art, and a format and year chip. The title itself sits beneath the poster (0006), never on it.

### 8.7 Motion

| Token             | Value                             | Use                                         |
| ----------------- | --------------------------------- | ------------------------------------------- |
| `duration-fast`   | 120 ms                            | Press, hover, icon ticks                    |
| `duration-base`   | 200 ms                            | Toggles, tabs, small reveals                |
| `duration-slow`   | 320 ms                            | Sheets, page-level transitions, card settle |
| `ease-standard`   | `cubic-bezier(0.2, 0, 0, 1)`      | Most movement                               |
| `ease-emphasized` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Things entering the screen                  |

- Swipe cards use a spring (decided in the deck spec, not here).
- Celebrations: at most ~600 ms, never block input, never on every action.
- `prefers-reduced-motion`: movement becomes a ≤120 ms fade; no confetti, no parallax.

## 9. Layout: the app shell

Details in [0002](../decisions/0002-app-shell-and-navigation.md).

| Width        | Shell                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| < 768 px     | Slim top bar (logo, page title, one action) · full-width content · bottom tab bar (64 px + safe area) |
| 768–1023 px  | Left icon rail (72 px) · content column                                                               |
| 1024–1279 px | Left sidebar with labels (240 px) · content column                                                    |
| ≥ 1280 px    | Sidebar · content column · right rail (320 px) for progress and suggestions                           |

- Content column: 640 px for reading pages (settings, reviews), up to 960 px for grids.
- Top-level sections (planned): **Rate** (the deck), **Discover** (search and charts), **Library** (your anime, watchlist, diary), **Profile**. Settings lives under Profile and in the sidebar footer.
- **Only built sections appear.** A nav item ships with its spec; no dead links or "coming soon" tabs.
- Auth and onboarding screens use a focused layout without the nav: split screen on desktop (form left, a collage of placeholder posters right), single column on phones, with a two-step progress indicator (account → username).

## 10. Components: direction

These are design rules for when components are rebuilt; each rebuild happens in a spec.

- **Buttons:** pill-shaped. Primary is amber with ink text and a 2 px darker "lip" underneath that flattens on press, so it feels pressable. Secondary is `surface-2`. Ghost for low-emphasis actions. One primary per view.
- **Inputs:** `surface-1` fill, no heavy border, 10 px radius, amber focus ring (2 px, 3:1+), labels above, hints below, errors in danger red with an icon.
- **Containers:** no borders by default; spacing and surface steps separate them (Duolingo's core-tabs redesign moved the same way, away from boxing every section).
- **Title card (0006):** 2:3 poster, at least 200 px wide (two columns on phones); title (20 px, two lines) and a meta line (`TV · 2023 · 28 eps`) beneath it; one optional context line (progress, watch date, your rating). Only your own state sits on the art. Quick actions appear on hover or focus, or through a ⋯ button on touch.
- **Quick actions:** like, watchlist, watched. Each has its own colour when active (0005).
- **Hover (0007 §2), "tint and lift":** the button takes a faint wash of its own colour and the icon grows slightly; press scales to 0.97. Fast in, soft out. Hover styles apply only to devices with a real pointer, and focus shows the same thing.
- **Hidden UI (0007 §3):** menus become bottom sheets on phones and dropdowns on desktop; filters are chips plus a sheet on phones and an inline bar on desktop; prefer undo toasts over confirm dialogs for anything reversible.
- **Rating:** the half-star control is a custom component, amber stars, drag or tap, with the value read out (`3.5 stars`).
- **Feedback:** inline messages under the thing they're about; toasts only for actions that happen off-screen.

## 11. Existing screens: what changes

| Screen          | Direction                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Home `/`        | Signed out: a landing hero with a poster collage, one line on what AniKansou is, sign-up CTA. Signed-in home waits for the deck spec. |
| Log in, sign up | Focused auth layout (§9); Google button styled as a secondary pill; friendlier copy.                                                  |
| Username        | Step 2 of 2 with progress; live preview of how the name appears (`@name`); rules shown before errors.                                 |
| Settings        | Inside the app shell; grouped sections on `surface-1` cards; log out as a quiet secondary action.                                     |
| 404, error      | Short, on-brand copy and a placeholder poster gag ("This episode doesn't exist"), with a way home.                                    |

## 12. Accessibility

- WCAG 2.2 AA in both themes; contrast figures for every token pair are in 0001.
- Focus: 2 px amber ring with 2 px offset, never removed.
- Targets ≥ 44 × 44 px for quick actions (above the 24 px AA minimum).
- Every gesture (swipe) has a button alternative.
- Reduced motion honoured everywhere (§8.7).
- Real assistive-tech testing with users is beyond what the team can do; flag it before launch.

## 13. Approval and next steps

1. Done: 0001–0007 approved (0006 with 200 px cards and two columns on phones). 0008 approved: in-house → TMDB → AniList (off until permitted) → generated.
2. The team writes `specs/03-design-foundations.md` (tokens, fonts, icon set, shell, restyled base components) on the approved decisions.
3. A later spec restyles the existing screens (§11).

## Sources

Each decision says which of these were opened and which were seen only as search summaries. Third-party brand extractions (hex values, fonts) are unverified.

- Design Society, "Design briefs: is there a standard?": https://designsociety.org/publication/33176/design_briefs_is_there_a_standard
- Design-brief section lists: https://skillselion.com/skills/owl-listener/designer-skills/design-brief, https://windmill.digital/insights/design-brief-what-is-it-how-to-make-one-with-examples
- Atlassian Design System foundations: https://atlassian.design/foundations
- GOV.UK Design System styles: https://design-system.service.gov.uk/styles/
- Material Design dark theme: https://m2.material.io/design/color/dark-theme
- Duolingo, core tabs redesign: https://blog.duolingo.com/core-tabs-redesign/
- Duolingo brand guidelines (old URL now redirects to the blog; colour and shape details only from summaries): https://design.duolingo.com/identity/color, https://www.canny-creative.com/brand-breakdown/brand/duolingo/
- Crunchyroll 2024 rebrand: https://www.anitrendz.com/news/2024/07/18/crunchyroll-debuts-new-branding-logo-fonts-more-ahead-of-san-diego-comic-con-2024
- Letterboxd design notes (third party): https://blakecrosley.com/guides/design/letterboxd, https://contra.com/p/6ZPPWlRX-uiux-redesign-for-letterboxd-app
- X layout widths (community): https://awesome.ecosyste.ms/projects/github.com%2Fbluebirdback%2Fx-twitter-column-resizer
- icons-animated: https://github.com/ln-dev7/icons-animated
