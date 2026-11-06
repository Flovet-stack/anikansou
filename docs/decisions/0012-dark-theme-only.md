# 0012: Dark theme only, for now

- **Status:** Approved
- **Proposed:** 2026-11-06 by Flovet, recorded by the product team (roles: UI, Frontend)
- **Approved:** 2026-11-06 by Flovet
- **Supersedes:** the light-theme part of [0001](0001-visual-foundations.md) (its "Colour tokens (light)" table and "light stays available through the theme toggle"). Everything else in 0001 stands.
- **Specs:** specs/04-ui-refresh.md, specs/05-swipe-deck.md

## Context

0001 defined light tokens and kept a theme toggle. Reviewing spec 04, Flovet: "for now we have only the dark theme as specified in the design brief, use only the colors there, we will not work on the light theme for now, the theme switcher logic should be there but not available for users to use."

## Research

| Reference                          | What they do                                                 | Adopt / adapt / reject | Why                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Letterboxd (design brief research) | Dark-only public pages; the dark canvas lets poster art lead | Adopt                  | Same reasoning as the brief's "dark theme first"                                                             |
| Brief, Must have #24 "Dark mode"   | Dark mode is a must-have; a light mode isn't                 | Adopt                  | Dark only still meets the brief                                                                              |
| `next-themes` (installed)          | Supports forcing one theme while keeping the switching logic | Adopt                  | Lets the toggle return later without rework (check the exact option in the installed version during spec 04) |

Sources: `PROJECT_BRIEF.md`, [the design brief](../design/design-brief.md), [0001](0001-visual-foundations.md).

## Decision

- The product ships **dark only**. Only 0001's dark tokens and 0005's dark state colours are defined in CSS; light values are not added.
- The theme provider forces dark, so stored or system preferences have no effect.
- The theme-switching logic and the `ThemeToggle` component stay in the code (restyled, tested) but are **not rendered** for users.
- Light mode returns only through a new decision that defines and tests its tokens.

## Consequences

- Less to build and test: one set of tokens, one set of screenshots, one contrast check.
- The "theme toggle switches and persists" smoke test is replaced by a "always dark, no toggle visible" check.
- 0001's light table and 0005's light column stay on record for later but aren't implemented.
- Reviews check: no light tokens in CSS; no visible toggle; a stored "light" preference still renders dark.
