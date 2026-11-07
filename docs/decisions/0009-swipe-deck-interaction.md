# 0009: Swipe deck interaction

- **Status:** Approved; the deck's status controls and the rule that a rating sets Watched are superseded by [0015](0015-deck-watched-only.md)
- **Proposed:** 2026-11-06 by the product team (roles: UX, UI, Gamification, Product, Frontend)
- **Approved:** 2026-11-06 by Flovet, with one amendment: passed titles stay reviewable and editable for the rest of the session
- **Revised:** 2026-11-06 after Flovet's review: the gesture model is for touch screens only; on the web, swiping just moves between anime and every action is an explicit control.
- **Specs:** specs/05-swipe-deck.md

## Context

Brief, core loop: "sign up, swipe through anime cards, rate, set status, add to watchlist, like". Differentiator: "a fast, gamified swipe-to-rate experience". Must have #2: "Swipe-to-rate deck: move between anime cards with quick actions". Brief §8.7 of the design brief left the swipe spring to the deck spec. This entry decides what each gesture means, how rating fits into a swipe, undo, keyboard use, and the light gamification around it.

Flovet, reviewing the first version: "The proposed experience works well for mobile but what about web? Let's make it simple: on the web users can swipe in order to switch between anime but they have actions for the status, like, rating, watchlist etc."

## Research

| Reference                                                            | What they do                                                                                                                                      | Adopt / adapt / reject | Why                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene it (swipe app for films, books, games)                         | Right = "seen it": rate it (0–10 slider with a haptic tick every 0.5) and optionally review; left = "haven't seen it": goes straight to your list | Adapt                  | Splitting by "seen / not seen" matches our data exactly. But not every unseen title belongs on a watchlist, so left only skips here and watchlist gets its own gesture |
| Slate (film app, via search summary)                                 | Swiping no longer forces a rating or a watchlist add just to move on                                                                              | Adopt                  | Moving on must never cost a decision                                                                                                                                   |
| Tastefinder                                                          | Four reactions: like, super-like, dislike, skip                                                                                                   | Reject                 | "Dislike" overlaps with a low rating; four directions are hard to learn                                                                                                |
| Tinder                                                               | Right, left and up; rewind is a paid, one-step feature; up-swipes are often triggered by accident while scrolling                                 | Adapt                  | Three directions are learnable, but up needs a stricter threshold. Undo is free and several steps deep (no guilt or paywall mechanics)                                 |
| Queue (onboarding teardown)                                          | A 30-second cap on the onboarding swipe exercise may increase swipes                                                                              | Adapt                  | Short sessions with visible progress; no timer pressure in the main deck                                                                                               |
| WCAG 2.2: 2.5.1 Pointer gestures (A), 2.5.7 Dragging movements (AA)  | Swipes need a single-tap alternative; a swipe-only carousel fails                                                                                 | Adopt                  | Every gesture has a visible button and a keyboard key                                                                                                                  |
| Gesture discoverability write-ups (LogRocket and others)             | Hidden gestures need hints on first use and visible alternatives                                                                                  | Adopt                  | Buttons are always visible; a one-time hint animates the first card                                                                                                    |
| Letterboxd film page on the web (team knowledge, not re-checked)     | Poster on one side; on the other, explicit controls: watched, like, watchlist, half-star rating, all visible at once                              | Adopt (web)            | Exactly the "actions on the page, not in the gesture" model Flovet asked for; a mouse can reach every control in one click                                             |
| Desktop carousels with arrows (Netflix, Crunchyroll; team knowledge) | Arrows and keys move between items; dragging is optional                                                                                          | Adopt (web)            | Moving between anime is navigation, so it should look and behave like navigation                                                                                       |
| Emil Kowalski, "Great animations"                                    | Under 300 ms, ease-out, interruptible; never animate keyboard-initiated actions                                                                   | Adopt                  | Fly-out and spring tuned to this; keyboard actions skip the throw animation                                                                                            |

Sources (opened): https://apps.apple.com/app/id6760948516 (Scene it) · https://builtformars.com/company/queue · https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures · https://emilkowal.ski/ui/great-animations

Seen in search results only: Slate release notes and Tastefinder listing (https://www.producthunt.com/products/tastefinder-swipe-movies-tv-shows/reviews?page=2) · Tinder up-swipe and rewind behaviour (https://www.techjunkie.com/?p=8035, https://pub.dev/packages/swipe_cards) · https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements · https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers

## Options

1. **Two models by input type (recommended, revised):** touch screens use Seen / Not seen / Want to watch gestures with a one-tap rating after "Seen"; pointer devices (web) use swipe, arrows or keys only to move between anime, with explicit controls for every action.
2. The touch gesture model everywhere (the first version): fine on phones, awkward with a mouse. Rejected by Flovet.
3. Rate directly on the card, then swipe right to save: one step fewer when rating, but a swipe without a rating becomes ambiguous.
4. Like / dislike (Tinder style): doesn't capture "haven't seen it", which is the most common answer for most of the catalog.

## Decision

Proposed: option 1.

### Which model a user gets

- **Touch model** when the device's main pointer is coarse (`(pointer: coarse)`): phones and most tablets.
- **Web model** when it's fine and can hover (`(hover: hover) and (pointer: fine)`): laptops and desktops.
- Decided by input type, not screen width, so a large tablet still gets the gestures and a narrow desktop window still gets the controls. The page re-checks if the input type changes (e.g. a tablet docked to a keyboard and trackpad).

## Web model

Swiping only moves between anime; nothing is saved by moving.

### Layout

- Inside the content column (960 px max): the poster on the left (about 360 px wide, 2:3), and on the right the title, meta line, studio and season, tags, then the **actions panel**.
- Previous and Next arrow buttons at the sides of the poster, a position counter above ("12 of this session"), and on screens of 1280 px and up the progress ring in the right rail.

### Moving between anime

| Input                                             | Effect                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Drag the poster left or right (mouse or trackpad) | Next or previous anime; commits past 30% of the poster width or a fast flick, else springs back |
| Next / Previous buttons                           | Same                                                                                            |
| → / ← keys, or J / K                              | Same, with no slide animation (keyboard actions don't animate)                                  |

- **Moving forward past an anime without any action records a "passed" event**, so it doesn't come straight back in the next session; it returns after 30 days, like "Not seen" on touch.
- **Passed titles stay fully reviewable for the rest of the session** (Flovet, 2026-11-06): Previous goes back through every anime seen this session, passed ones included, with all controls active. Acting on a passed anime (rating, status, like or watchlist) saves normally and clears its "passed" record, so it's treated as acted on, not skipped. Going back and forward again without acting keeps it passed.
- Previous shows whatever was saved in the controls, so changing your mind needs no undo.

### The actions panel (all visible, one click each, saved immediately)

| Control   | Behaviour                                                                                                                         | Keys                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Rating    | Half-star control; click to rate, click the same value again to clear. Setting a rating with no status sets the status to Watched | 1–9, 0 (½ to 5 stars), Backspace clears     |
| Status    | Four options with 0005 icons and colours: Watched, Watching, On hold, Dropped; click the active one again to clear                | W (Watched), shown in tooltips for the rest |
| Like      | Heart toggle (rose when on)                                                                                                       | L                                           |
| Watchlist | Bookmark toggle (violet when on)                                                                                                  | A ("add")                                   |

- Each control follows 0005 (colour, icon, label) and 0007 §2 (tint-and-lift hover).
- Nothing auto-advances on the web: the user moves on when they're ready. A subtle "Next" hint pulses once after the first action on the first visit only.
- A toast confirms each save with Undo (0007 §3); Ctrl/Cmd+Z undoes the last action.

## Touch model

### Gestures and their buttons

| Gesture     | Button (always visible) | Key             | Meaning                                            | Drag label (colour, icon from 0005) |
| ----------- | ----------------------- | --------------- | -------------------------------------------------- | ----------------------------------- |
| Swipe right | "Seen it"               | →               | Opens the rating step (below)                      | "Seen it" (watched green, check)    |
| Swipe left  | "Not seen"              | ←               | Skips the card; it doesn't come back for 30 days   | "Not seen" (warm grey, arrow)       |
| Swipe up    | "Want to watch"         | ↑               | Adds to the watchlist and moves on                 | "Watchlist" (violet, bookmark)      |
| —           | Heart on the card       | L               | Toggles like (works without a rating; brief)       | —                                   |
| —           | "Undo"                  | Z or Ctrl/Cmd+Z | Reverses the last card's action and brings it back | —                                   |

- **Thresholds:** left and right commit at 30% of the card width or a flick faster than 500 px/s. Up commits only when the drag is mostly vertical (within 30° of straight up) and past 25% of the card height, to avoid accidental watchlist adds. Below the threshold the card springs back.
- **Labels fade in** with drag distance, so the user sees what will happen before letting go.
- **Down is unused:** it would clash with page scroll.

### The rating step (after "Seen it")

- The card stays and the bottom of the deck turns into a rating panel: five large half-star targets (the same control as elsewhere), a status row (Watched selected; Watching, On hold, Dropped one tap away, with 0005 icons and colours) and the like heart.
- **Tapping a star saves the rating with the selected status and moves to the next card at once.** One swipe plus one tap.
- "Save without rating" saves the status only and moves on. "Back" returns the card to the deck with nothing saved.
- Keys: 1–9 and 0 set 0.5–5 stars (1 = ½, 0 = 5), Enter saves without rating, Esc goes back.

### Undo (touch)

- Free, no limit within the session, last action first. Undo reverses what was saved (rating, status, watchlist, skip) and puts the card back on top. A toast confirms each action with an Undo button too (0007 §3).

### Motion and feel (both models)

- Touch: the card follows the finger 1:1 with a slight rotation (max 8°). On commit it flies out in the gesture's direction in under 250 ms with ease-out; the next card scales up from 0.96 to 1 underneath. Spring-back on release below the threshold.
- Keyboard and button actions don't throw the card: it fades and the next appears (Kowalski: never animate keyboard-initiated actions).
- Reduced motion: no drag rotation or fly-out; cards cross-fade in 120 ms. Dragging still works.
- Web: dragging slides the poster horizontally with no rotation; the next poster slides in from the side in under 250 ms.
- Touch: a one-time hint on the first card ever: it nudges right and left once, with the button labels highlighted. Shown again only if the user hasn't swiped after 5 seconds on their first visit.

### Unaired titles (both models)

Titles that haven't aired yet appear in the deck ([0010](0010-deck-content-and-order.md)) but can't be rated or marked Watched (or Watching, On hold, Dropped):

- **Web:** the rating control and the status options are replaced by a quiet line ("Not aired yet"); like and watchlist stay.
- **Touch:** "Seen it" is hidden and swiping right springs back with the label "Not aired yet"; "Not seen" (left) and "Want to watch" (up) work as usual, and so does the heart.
- An "Upcoming" badge sits on the poster, using neutral colours (not a state colour).

### Entry point

- The deck lives at `/rate`, the first nav item. It needs an account (ratings are saved per user); signed-out visitors are sent to log in.
- New users land on the deck right after choosing a username, and signed-in users who open the log-in or sign-up page go to the deck, instead of Settings (spec 02's default). An explicit `next` still wins. The brief's core loop starts with "sign up, swipe", so the first screen after sign-up is the swipe.

### Progress and celebration (light, no guilt)

- A session counter ("12 rated") and a slim progress ring toward the next milestone at 10, 25, 50 and 100 ratings in total.
- Reaching a milestone: a short (≤ 600 ms) burst in the accent colour and a one-line message ("25 ratings. Your taste is taking shape."). Never blocks input. Off under reduced motion (the message stays).
- No streaks, timers, daily goals or "you missed" messages.

## Consequences

- Touch: one swipe for "not seen" and "want to watch", swipe + tap for a rating. Web: every action is one click and visible, and moving between anime is plain navigation.
- Two input models means two sets of tests; both share the same data actions, card content and undo stack.
- Needs a gesture and spring implementation: Motion (approved with 0003) covers drag, springs and exit animations, so no new dependency.
- Reviews check: the right model per input type; every gesture has a button and a key; thresholds as above; undo restores data exactly; keyboard actions don't animate; reduced motion honoured; screen-reader users can rate a card without any gesture.
