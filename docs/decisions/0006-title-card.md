# 0006: Title card structure and information hierarchy

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: UX, UI, Product, Copy, Frontend)
- **Approved:** 2026-11-06 by Flovet, with two changes: minimum card width 200 px (not 250) and two columns on phones
- **Specs:** —

## Context

Flovet: keep the 2:3 ratio, make cards wider ("250px minimum", later set to 200 px), and put the title beneath the poster rather than on it, "that way there is more real estate for larger titles. Work on the hierarchy and the information that is shown for each anime." The card is the most repeated element in the product (grids, lists, search, profile, deck), so its structure is a decision of its own. Brief: the dataset's aggregated score is never shown.

## Research

| Reference                             | What they do                                                                                                      | Adopt / adapt / reject | Why                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Letterboxd                            | Poster-only grid; title appears on hover; your rating, like and review markers sit under the poster as tiny icons | Adapt                  | Keep the user's own state small and under or on the poster. Reject title-on-hover: touch users never see it, and anime titles are long |
| Crunchyroll                           | Poster with title and meta beneath; on desktop hover, the card expands to show a synopsis and actions             | Adapt                  | Title beneath, as asked. Actions on hover. We skip the synopsis expansion (too much movement in a grid)                                |
| NN/g, progressive disclosure          | Show what most users need first; reveal the rest on request; two levels work best                                 | Adopt                  | Card = level 1, title page = level 2. Quick actions on the card are one step away (hover or ⋯), never three                            |
| Netflix, Prime Video (team knowledge) | Text over art is often illegible and gets cut                                                                     | Adopt (lesson)         | Another reason to move the title off the art                                                                                           |

Sources (opened): https://www.nngroup.com/articles/progressive-disclosure/. Seen in search results only: https://blakecrosley.com/guides/design/letterboxd. Crunchyroll and streaming-service card behaviour is team knowledge, not re-checked this session.

## Options

1. **Poster + title block beneath, with a context line (recommended).**
2. Poster + title beneath, fixed meta only: simpler, but a "currently watching" card and a diary card need different facts.
3. Title on the poster (today's preview): rejected by Flovet.

## Decision

Proposed: option 1.

### Anatomy (top to bottom)

1. **Poster, 2:3.** Artwork (pending [0008](0008-artwork-source.md)), or the generated fallback ([0004](0004-placeholder-poster-art.md)). Radius `md`.
   - **Your state, on the poster, top-left:** one badge at most: your status (icon + state colour from [0005](0005-status-and-action-colours.md)). If you liked it, a small heart top-right. Nothing else sits on the art.
   - **Quick actions (hidden until needed):** like, watchlist, watched and ⋯ (more), in a bar along the bottom of the poster. Shown on hover or keyboard focus on pointer devices. On touch screens only a ⋯ button shows (44 × 44 px target, bottom-right), which opens a bottom sheet with the same actions plus status and rating.
2. **Title**, `title-s` (20 px) Bricolage 700, up to 2 lines, then ellipsis with the full title in the accessible name. Uses the title-language setting (romaji by default).
3. **Meta line**, `small` (14 px) `text-muted`: format · year · episodes, e.g. `TV · 2023 · 28 eps`. Movies show runtime instead of episodes when the data has it.
4. **Context line (optional, one only)**, set by where the card appears:
   - Currently watching: progress bar + `Ep 12 of 28`.
   - Diary: watch date (`Watched 3 Nov`).
   - Your lists and profile: your rating in stars.
   - Search: matched alternative title if the match wasn't on the shown title (`Also known as Frieren: Beyond Journey's End`).
   - Charts: rank number set large in the display face, left of the title.

Never on the card: the aggregate score (brief), synopsis, genres, studio. Those are on the title page.

### Size and grid

- Card width: **minimum 200 px** from 600 px up: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`, gap 32 px.
- Phones (< 600 px): **two columns** (`repeat(2, minmax(0, 1fr))`, gap 16 px, about 156 px each on a 360 px phone), with a 16 px title and 13 px meta. Chosen by Flovet over one large card per row.
- Horizontal shelves (charts, "currently watching") use the same card at a fixed 200 px width (156 px on phones) with scroll snapping.

## Consequences

- One `TitleCard` component with a `context` slot; every list in the product uses it.
- Grids get fewer, larger cards, which matches the brief's "artwork leads" and Flovet's "a lot of space".
- Reviews check: no text over artwork except the user's own state badges; card works with keyboard only (focus shows the action bar); touch shows the ⋯ button; long titles clamp to two lines; no aggregate score anywhere.
