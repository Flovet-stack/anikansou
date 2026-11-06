# 0004: Generated fallback posters

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: UI, Product, Frontend, Database)
- **Approved:** 2026-11-06 by Flovet (as the fallback when a title has no image)
- **Specs:** —

## Context

The brief: "dataset image URLs point to other sites; do not hotlink. Use designed placeholder cards until an artwork decision is made." The style direction is "poster-forward cards … artwork leads". So the placeholder is the artwork for now, on every card, grid and deck, and needs designing before those features are built.

Update 2026-11-06: Flovet wants real artwork for all titles ([0008](0008-artwork-source.md), blocked) with this poster as the **fallback** when a title has no image. The title also moves beneath the poster ([0006](0006-title-card.md)), so the fallback no longer carries the romaji title.

## Research

| Reference                                                     | What they do                                                                       | Adopt / adapt / reject | Why                                                                                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Letterboxd                                                    | 2:3 poster grid as the main pattern; films are shown as poster art, not text lists | Adopt                  | Same ratio and grid, so real art can drop in later                                                                      |
| Crunchyroll (2024 rebrand)                                    | A large set of anime- and manga-inspired glyphs used as a graphic system           | Adapt                  | Shows a brand can carry personality through its own graphic system when art isn't the point. We don't copy their glyphs |
| Generic grey box with a film icon                             | Common fallback                                                                    | Reject                 | Hundreds of identical grey boxes make a deck feel broken                                                                |
| Spotify-style generated covers (title text on a colour field) | Typographic covers when there's no image                                           | Adopt (idea)           | Every item gets a distinct, legible cover with no external images                                                       |

Sources (opened): https://www.anitrendz.com/news/2024/07/18/crunchyroll-debuts-new-branding-logo-fonts-more-ahead-of-san-diego-comic-con-2024

Seen in search results only: https://blakecrosley.com/guides/design/letterboxd. The "generated covers" row comes from team knowledge and wasn't researched this session.

## Options

1. **Generated typographic poster (recommended):** pure CSS/SVG, no network, deterministic per title.
2. Grey box with icon: least work, worst feel.
3. Pre-rendered images stored in Supabase Storage: costs storage and a build pipeline for something replaced later.

## Decision

Proposed: option 1, as the fallback layer of a `PosterArt` component.

- **Ratio 2:3**, radius `md` (10 px).
- **Colour:** two hues picked from the anime's own ID with a hash, mapped onto a curated set of about 12 dark-friendly gradient pairs (so no ugly combinations). The decorative type sits on a darkened area, so the format chip always passes 4.5:1.
- **Texture:** a subtle grain or halftone (inline SVG, a few hundred bytes).
- **Type, as art:** the native title set vertically (`writing-mode: vertical-rl`) and large in the display weight, at partial opacity, as the poster's main graphic; titles without a native title use the first word of the romaji title instead. A small chip shows the format and year. All of it is `aria-hidden`: the title beneath the card is the accessible name.
- **Same output on server and client:** no randomness at render, so it's static-friendly and has no hydration mismatch.
- **Fallback order:** artwork (when 0008 allows it) → generated poster when the image is missing, fails to load or is still loading on a slow connection. Callers never choose; `PosterArt` decides.

## Consequences

- No external image requests at all (privacy, performance, licence).
- Titles with very long names need truncation rules; tested with the longest titles in the catalog.
- Reviews check: deterministic output for a given ID, text contrast ≥ 4.5:1 on every gradient pair, renders at 110 px wide in a grid without overflow.
