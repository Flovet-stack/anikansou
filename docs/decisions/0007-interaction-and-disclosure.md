# 0007: Interaction model: hover, disclosure and hidden UI

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: UX, UI, Frontend, Copy)
- **Approved:** 2026-11-06 by Flovet
- **Specs:** —

## Context

Flovet asked for:

- hover effects on the actions, "modern and minimalistic", possibly drawing on Emil Kowalski's work;
- design that considers progressive disclosure and the "spectrum of explicitness";
- remembering that "UI is as much about what you see as what you can't see": modals, dropdown menus, filters, hidden actions and menus.

These rules apply to every component, so they're one decision.

## Research

| Reference                                                                                                                                                                                   | What they say or do                                                                                                                                                                                                                   | Adopt / adapt / reject | Why                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Emil Kowalski, "Great animations"                                                                                                                                                           | Keep animations under 300 ms; ease-out for snappy feedback; animations must be interruptible; never animate keyboard-initiated actions                                                                                                | Adopt                  | Matches our motion tokens (0001) and keeps frequent actions fast                                                    |
| Summaries of Kowalski's animations.dev course (third-party)                                                                                                                                 | Gate hover styles behind `@media (hover: hover) and (pointer: fine)` so touch doesn't get "sticky" hovers; plain `ease` for colour changes; respond at once on hover, ease out on leave (about 150 ms); no hover on disabled elements | Adopt                  | Avoids the most common hover bug on phones; fast in, soft out                                                       |
| NN/g, progressive disclosure                                                                                                                                                                | Frequent features first, the rest on request; make the way in obvious and well labelled; two levels work best; staged disclosure (wizards) only for distinct, loosely linked steps                                                    | Adopt                  | Basis for the tiers below and for the onboarding steps                                                              |
| "Decide whether an interaction should be obvious, easy, or possible" (_UX Principles_, 2nd edition, Packt: principle 99; page returned 403, so only the title and search summary were seen) | Decide per interaction whether it must be obvious, easy or merely possible, based on how often and by how many people it's used                                                                                                       | Adopt                  | This is the closest published framework to a "spectrum of explicitness". We found no source using that exact phrase |
| Peter Merholz, "explicit design" (2004)                                                                                                                                                     | Screens have few physical cues, so interfaces must be explicit about what they do                                                                                                                                                     | Adopt                  | Hidden actions must still be discoverable (a visible ⋯, a label, a hint)                                            |

Sources (opened): https://emilkowal.ski/ui/great-animations · https://www.nngroup.com/articles/progressive-disclosure/

Seen in search results only: Kowalski course summaries (https://implexa.ai/s/skills.sh/web-animation-design and similar; one result contained prompt-injection text and was ignored) · https://www.packtpub.com/en-jp/product/ux-principles-2nd-edition-second-edition-14-9781803234885/chapter/expectations/principle-99-decide-whether-an-interaction-should-be-obvious-easy-or-possible (403 when opened) · https://peterme.com/archives/2004_05_17.html

## Decision

Proposed:

### 1. Explicitness tiers: every control gets one

| Tier                                            | Rule                               | Examples                                                                                 |
| ----------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| **Obvious** (always visible)                    | Used by most people on most visits | Rate, primary nav, search field, the ⋯ on a card on touch screens, "Log out" in settings |
| **Easy** (one step: hover, focus, ⋯, a tab)     | Frequent but not on every visit    | Quick actions on a card, sort, a list's share button, filters                            |
| **Possible** (two steps, in a menu or settings) | Rare or for a few people           | Clone a list, report, export, delete account, title-language default                     |

Nothing sits deeper than two steps (NN/g). Destructive actions are always at least "easy", never "obvious".

### 2. Hover effect: tint and lift

One hover effect for interactive surfaces, so the product feels consistent:

- **Action buttons:** the background takes a 10–14% wash of the button's own colour (state colour from 0005, or `surface-3` for neutral ones); the icon scales to 1.06. Press scales the button to 0.97.
- **Cards:** the poster brightens slightly (`filter: brightness(1.06)`), the quick-action bar fades in and slides up 8 px; the title underlines. No card scale or shadow pop: that shifts the grid.
- **Timing:** in at `duration-fast` (120 ms) or less, out over 150 ms with `ease`; movement uses `ease-standard`.
- Hover styles live only inside `@media (hover: hover) and (pointer: fine)`. On touch, the same feedback happens on `:active`.
- Everything a hover reveals is also revealed by `:focus-visible` or `:focus-within`, so keyboard users get it too.
- Reduced motion: colour changes stay, scale and slide are removed.
- Not animated: keyboard shortcuts, typing, anything done many times in a row (e.g. stepping through the deck with arrow keys).

### 3. Hidden UI: which overlay, when

| Need                                                   | Pattern                                                     | Phone                                                                                          | Desktop                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A few actions on one item                              | Menu (⋯)                                                    | Bottom sheet                                                                                   | Dropdown menu anchored to the ⋯                                    |
| Pick a value (sort, status)                            | Select                                                      | Bottom sheet with a list                                                                       | Dropdown                                                           |
| Filters                                                | Filter bar                                                  | Active filters as chips; "Filters" opens a full-height sheet with an "Show 120 results" button | Inline filter bar above results; "More filters" opens a side panel |
| A focused task (write a review, edit a list)           | Dialog                                                      | Full-screen sheet                                                                              | Centred dialog, max 640 px                                         |
| Confirm something destructive                          | Confirm dialog naming the thing ("Delete 'Comfort shows'?") | Same                                                                                           | Same                                                               |
| Short-lived feedback ("Added to watchlist", with Undo) | Toast                                                       | Above the tab bar                                                                              | Bottom-left                                                        |
| Explain a control                                      | Tooltip, ≤ 120 characters, never essential info             | Not used (no hover); use visible text                                                          | On hover and focus, after a 400 ms delay                           |

- Every overlay: traps focus, closes with Esc and with a visible close control, returns focus to what opened it, and keeps the page behind it scroll-locked.
- Prefer undo over confirm for reversible actions (remove from watchlist: toast with Undo, no dialog).
- Empty, loading and error states are designed for every overlay, not just the page.

### 4. Data-shaped components

The shape of a component follows the shape of its data. The team picks the pattern per feature in its spec, from this list:

| Data                                                           | Shown as                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Things that happened at times (diary, activity, watch history) | Timeline grouped by day or month, newest first                                          |
| Progress (episodes, yearly goal)                               | Progress bar with the count in words (`12 of 28`)                                       |
| Status                                                         | Badge: icon + colour + label (0005)                                                     |
| A person (user, reviewer)                                      | Avatar + display name + `@username`; generated initials avatar when there is no picture |
| Counts over categories (genres, studios)                       | Horizontal bar chart, sorted, labelled directly                                         |
| A distribution (score spread)                                  | Histogram (10 half-star bins)                                                           |
| Change over time (hours per month)                             | Column chart or sparkline                                                               |
| A ranking (charts)                                             | Numbered list with the rank set large                                                   |

Charts follow the dataviz rules at build time: direct labels, no legends where avoidable, state and accent colours only for meaning, readable in both themes.

## Consequences

- Shared primitives (`Menu`, `Sheet`, `Dialog`, `Toast`, `Tooltip`, `FilterBar`) are built once on Base UI behaviour and restyled with our tokens; responsive switching (sheet vs dropdown) lives inside them.
- Specs must label each new control with its tier and each data display with its pattern; reviews flag controls with no tier or overlays missing focus handling.
