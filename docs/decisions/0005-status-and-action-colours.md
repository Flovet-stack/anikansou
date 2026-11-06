# 0005: Status and action colours and icons

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: UI, UX, Gamification, Frontend)
- **Approved:** 2026-11-06 by Flovet
- **Extends:** [0001](0001-visual-foundations.md) (adds colour roles; the Kohaku accent stays for ratings, primary actions, active nav and focus)
- **Specs:** —

## Context

Flovet, reviewing the preview: "the like, watchlist and watched actions need different colors so they are visually distinguished when they are active, this will allow for fast scanning", and "statuses should be visually distinguished or have an icon". The brief's statuses are Watched, Watching, On hold, Dropped; watchlist is a separate toggle; like works without a rating.

## Research

| Reference                                              | What they do                                                                                                                               | Adopt / adapt / reject | Why                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Letterboxd                                             | Watched (eye), like (heart) and watchlist (clock) each turn a different colour when active (third-party descriptions: green, orange, blue) | Adopt (principle)      | Exactly the fast-scan behaviour asked for. Our hues are our own                                                                                                                      |
| X                                                      | Like turns pink, repost turns green, bookmark turns blue; each colour belongs to one action only                                           | Adopt (principle)      | One colour per action, kept consistent across the whole product                                                                                                                      |
| Tracker convention (AniList, MAL, from team knowledge) | Each list status has a colour: watching blue, completed green, paused amber/yellow, dropped red, planning purple                           | Adapt                  | Fans already read these hues, so we keep blue for watching and green for watched. But **dropped is neutral grey, not red**: red reads as failure, and the brief bans guilt mechanics |
| WCAG 1.4.1 Use of colour, 1.4.11 Non-text contrast     | Colour can't be the only signal; icons and UI parts need 3:1                                                                               | Adopt                  | Every state also has its own icon and a text label                                                                                                                                   |

Sources: team knowledge for the X, AniList and MAL conventions, not re-checked this session; Letterboxd colours from third-party write-ups seen in search results (https://blakecrosley.com/guides/design/letterboxd). Contrast calculated with the WCAG 2.x formula.

## Options

1. **One colour and one icon per state (recommended).**
2. Accent colour for every active state, with different icons only: one colour means scanning has to rely on icon shape.
3. Icons only, no colour: calmer, but slower to scan.

## Decision

Proposed: option 1. Inactive states use `text-muted` outlines; the active state turns its colour and its icon fills.

| State     | Role token                                 | Dark      | On bg  | Light     | On bg | Icon (Hugeicons, pending 0003)        |
| --------- | ------------------------------------------ | --------- | ------ | --------- | ----- | ------------------------------------- |
| Like      | `state-like` (rose)                        | `#ff6895` | 7.1:1  | `#c82462` | 5.2:1 | Heart                                 |
| Watchlist | `state-watchlist` (violet)                 | `#b298f9` | 8.1:1  | `#734dbe` | 5.7:1 | Bookmark                              |
| Watched   | `state-watched` (green, same as `success`) | `#5fd37f` | 10.4:1 | `#0a7e3a` | 4.9:1 | Check in a circle                     |
| Watching  | `state-watching` (sky)                     | `#52c1fb` | 9.6:1  | `#0070ab` | 5.1:1 | Play                                  |
| On hold   | `state-onhold` (sand)                      | `#d0bb92` | 10.5:1 | `#75603b` | 5.8:1 | Pause                                 |
| Dropped   | `state-dropped` (warm grey)                | `#a19594` | 6.8:1  | `#6a6160` | 5.8:1 | Arrow out of a box (left, not failed) |
| Rating    | `accent` (Kohaku, from 0001)               | `#fea92f` | 10.2:1 | `#aa5f04` | 4.6:1 | Star                                  |

- All pass 4.5:1 as text on `bg` and `surface-2` in both themes, so the label can be in the state colour too.
- Active fills use the state colour at about 14% opacity behind the icon, so a row of active actions stays calm.
- Rose (like) and danger red are kept apart by hue (5 vs 28) and by context: danger only appears in errors and destructive confirmations, never on cards.
- On hold (sand) and the amber accent differ in saturation and always come with a pause icon.

## Consequences

- `globals.css` gets the seven `state-*` tokens in both themes.
- A shared `StatusBadge` and `ActionToggle` own these colours; nothing else uses the state tokens, so each colour keeps one meaning.
- Reviews check: every state shows icon + colour + accessible label; no state colour used decoratively; contrast test covers all pairs above.
