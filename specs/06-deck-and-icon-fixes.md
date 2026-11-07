# 06: Deck shows Watched only, and icons animate on their control's hover

Status: Done (PR #14; decision 0015 approved) · Written: 2026-11-07

Brief: refines Must have #2 (swipe-to-rate deck) and #5 (rating); fixes the icon behaviour the brief's Icons section asks for ("animate on interaction only (hover, press, state change)").

## Goal

Make each deck card a quicker decision: Watched, Like and Watchlist only, and stars only once a title is marked Watched. Separately, make every animated icon play when the button or link around it is hovered or focused, not only when the pointer is over the icon itself.

## Decisions

Implements [0015](../docs/decisions/0015-deck-watched-only.md), which replaces part of [0009](../docs/decisions/0009-swipe-deck-interaction.md). Follows [0003](../docs/decisions/0003-icon-set.md) (icons animate on interaction, respect reduced motion), [0005](../docs/decisions/0005-status-and-action-colours.md) and [0007](../docs/decisions/0007-interaction-and-disclosure.md).

## Acceptance criteria

### Database (new migration; schema change approved through 0015)

1. `set_status(anime_id, null)` also clears the rating, in the same single event, and `deck_undo` of that event restores both.
2. `set_rating` with a non-null rating is refused (`check_violation`, a clear message) unless the title's status is Watched. `deck_seen(anime_id, 'watched', rating)` still saves both in one event. Existing rows are not changed.
3. Database and PGlite tests cover both rules, and the existing "rating sets Watched" test is replaced.

### Web model

4. The actions panel shows the **Watched** toggle (0005 green, check icon), **Like** and **Watchlist**. No Watching, On hold or Dropped controls.
5. The stars are visible but disabled (not focusable as active controls; `aria-disabled`) until Watched is on, with the line "Mark it watched to rate it". They enable as soon as Watched is on.
6. W toggles Watched. 1–9 and 0 rate only when Watched is on; otherwise they save nothing and announce "Mark it watched first (W)" in the live region. Backspace clears the rating.
7. Turning Watched off clears the rating in one action, with one Undo that brings both back.
8. A card already at Watching, On hold or Dropped shows that status as a read-only chip beside the Watched toggle; turning Watched on replaces it.

### Touch model

9. The rating step after "Seen it" shows the stars, the like heart, "Save without rating" and "Back", with no status row. Saving always uses Watched.

### Icons

10. Every animated icon inside a button or link starts its animation when the **control** is hovered (pointer devices) or receives keyboard focus, and stops when it leaves or blurs. This covers the nav (sidebar, rail, tab bar), account links, the theme toggle, form and error states, and every deck control.
11. One shared hook or wrapper does this (for example `useIconAnimation()` returning the icon ref and the handlers to spread on the control). The vendored icon files keep their own hover handlers, so hovering the icon directly still works.
12. Reduced motion: no animation, as today. Touch: no hover animation is triggered by a tap.

### Tests

13. Unit tests for the hook: hover and focus on the control start the icon; leave and blur stop it; nothing runs under reduced motion.
14. Unit tests for the deck controls: stars disabled until Watched; keys ignored without Watched; un-watching clears the rating.
15. E2E (`e2e/deck.spec.ts`) updated: the web flow marks Watched before rating, checks there are no Watching/On hold/Dropped controls, un-watches a rated title and undoes it. The touch flow's rating step has no status row.

## Out of scope

- The library, its edit sheet and setting Watching, On hold or Dropped (spec 07).
- Poster images (spec 08).
- Any change to deck order, eligibility, gestures or thresholds.

## Edge cases

- A title rated before this change with a status other than Watched (none exist from the deck, but possible in data): the rating shows; the stars stay disabled until Watched is on; clearing still works.
- Pressing a number key on an upcoming title: nothing happens, as today.
- Rapidly toggling Watched on and off: saves apply in order through the existing queue; the final state matches the last click.

## Files and patterns to follow

- Migration in `supabase/migrations/`, following `20261106180000_tracking_integrity.sql` (lock, then change).
- `src/features/deck/components/web-deck.tsx`, `touch-deck.tsx`, `status-picker.tsx` (keep the component for spec 07; stop using it in the deck), `rating-stars.tsx`, `src/features/deck/use-deck.ts`, `src/features/deck/logic.ts` (`controlsFor`).
- The icon hook in `src/components/ui/` or `src/hooks/`, used by `section-nav.tsx`, `account-link.tsx`, `theme-toggle.tsx`, `error-state.tsx`, `form-message.tsx`, `auth-shell.tsx` and the deck components.

## Boundaries

- **Always:** one event per action; Undo for every change; keep the 0005 colour meanings.
- **Ask first:** any dependency; any change beyond the two database rules above.
- **Never:** edit an applied migration; call an external API; use `any` or `@ts-ignore`.

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build` pass.
- Screenshots of the deck at 390 px and 1440 px (dark) with Watched off and on, and a short clip or two frames showing a nav icon animating on hover of its link.
- Workflow E review against this spec and 0003, 0005, 0007, 0009 and 0015, posted on the PR.
