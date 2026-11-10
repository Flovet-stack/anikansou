# 0026: Community contributions, validated by an admin

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Product, Database, Backend, Tech Lead, UX, Copy)
- **Approved:** 2026-11-11 by Flovet ("I approve all decisions"); this also approves the schema changes it describes
- **Specs:**

## Context

Flovet, 2026-11-08: community contribution is "now at a priority", because "we need to build our database" and "we are currently struggling" getting data from multiple sources. "We're going to have users contribute, and we're going to have the admin confirm it or validate it."

Flovet's rule on data, paraphrased: only data in our own database gets edited. Data from APIs that don't allow copying is fetched on the fly, isn't saved and isn't editable. APIs that allow copying get copied, and the copy gets edited. Nobody else's data is touched.

What exists: `catalog.overrides` (0 rows) holds corrections an import can't overwrite, for 7 fields, with no way for a user to submit. No admin role exists anywhere. The multi-source catalog decision (0023 multi-source, Proposed, in another worktree) lists community contributions last, after the dashboard. This decision moves it ahead, so the two must be reconciled before either is approved.

## Research

| Reference                       | What they do                                                                                                                                                                             | Adopt / adapt / reject                          | Why                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AniList submissions             | Users submit; a moderator approves or denies each; users provide sources, track status on a panel, and moderators can ask questions                                                      | Adopt                                           | The closest match to what Flovet described                                                                        |
| Wikipedia pending changes       | Edits by new users are held; readers keep seeing the last accepted version; reviewers do a quick check for vandalism and copyright                                                       | Adopt: readers see the old value until approved | Bad edits never reach anyone                                                                                      |
| MusicBrainz                     | Editors vote; 3 unanimous votes or 7 days applies an edit; removals get extra time; auto-editors skip the queue; voters need 2 weeks and 10 accepted edits                               | Reject for now                                  | Voting needs many active editors. Flovet chose admin validation. A good later option if the queue outgrows admins |
| OpenStreetMap contributor terms | Contributors agree to terms before contributing; their licence change was long and hard because earlier contributors hadn't agreed in advance                                            | Adopt: terms before the first submission        | Very expensive to fix later                                                                                       |
| ODbL 1.0                        | Editing an ODbL database makes a Derivative Database. If publicly used, it must be under ODbL (4.4), and we must offer the whole database or a file of the changes, free if online (4.6) | Adopt: publish a changes file                   | See "Licence" below                                                                                               |
| TMDB                            | All data user-contributed under a written rulebook; forum posts say it's applied unevenly                                                                                                | Adapt: short written rules from day one         | Anecdotal on enforcement                                                                                          |

Sources (opened):

- https://anilist2.gitbook.io/submission-manual
- https://en.wikipedia.org/wiki/Wikipedia:Pending_changes
- https://musicbrainz.org/doc/Introduction_to_Voting
- https://opendatacommons.org/licenses/odbl/1-0/

Seen only as search summaries: https://osmfoundation.org/wiki/About_The_License_Change · https://TMDb.org/bible/general

## Licence

Not legal advice; **a real lawyer should confirm this before launch of the changes file or any monetising.**

Flovet's rule is right, with one thing to add. **Our main catalog is other people's data:** it's a copy of anime-offline-database under ODbL. Copying and editing it is allowed, so the plan works. The condition is share-alike: the edited version we publicly use has to stay open.

| Data                                                     | Editable?           | Conditions                                                                                                                                                           |
| -------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataset facts in `catalog` (ODbL)                        | Yes                 | The edited database stays under ODbL. We offer a free file of the changes, and keep the credit. **So this part can never be private or exclusive to us**             |
| Wikidata, if approved (CC0)                              | Yes                 | None                                                                                                                                                                 |
| Written by our users or admins, such as a synopsis (new) | Yes                 | Contributor terms needed. Whether it must also be shared when shown beside ODbL data is the question for the lawyer. Kept in its own schema to keep our options open |
| Our users' star ratings and our rating                   | Not by contributors | Ours. Kept out of `catalog` (0025)                                                                                                                                   |
| API data shown on the fly (TMDB, AniList)                | **No**              | No edit control is shown. A human-written value can replace it on screen, but it has to be written fresh                                                             |

**Storage, settled.** Flovet, 2026-11-10: the rule covers storage too ("Storage too"): data from an API that doesn't allow copying is never stored in our database, as well as never edited. **One exception, also Flovet's:** AniList cover links stay stored as 0017 decided ("We need to keep the links"). 0022's proposed 6-month TMDB cache belongs to another worktree and should be checked against this rule there. Separately, AniList's terms bar competing trackers, which 0017's accepted risk should now be read against.

## Options

1. **Users submit, an admin validates, with a small review queue (chosen).** What Flovet asked for. Safe, and simple. One admin can become a bottleneck.
2. **Community voting.** Scales, but needs active editors we don't have.
3. **Edits apply at once and get reverted if bad.** Fastest, but vandalism and copied text are visible immediately.
4. **Wait for the full admin dashboard.** Against Flovet's priority.

## Decision

Option 1, with the smallest useful first version. **Timing (Flovet, 2026-11-10):** the admin dashboard comes later, and contributions ship with it, since admins need it to review.

### Flow

1. A signed-in user opens a title's details and chooses "Suggest a change".
2. They pick a field, enter the new value, and say where it comes from (a link or a short note).
3. Everyone keeps seeing the current value. The user sees "Waiting for review" under **My contributions**.
4. An admin sees the old and new values side by side, and approves, or rejects with a short reason.
5. On approval, the value goes live, with its history kept and undoable. It counts towards achievements (0024). A rejection costs nothing, and the reason is shown.

No notifications yet (#29): status lives on the My contributions page.

### What can be submitted first

| First version                                                                       | Later, under their own specs                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| Facts in `catalog.overrides`: title, type, episodes, status, season, year, duration | Studios, tags, relations                          |
| English and native title                                                            | Staff, cast and characters, which need new tables |
| Synopsis, in the contributor's own words                                            | Posters and uploads                               |
|                                                                                     | Adding brand-new titles                           |

### Rules for contributors, shown at the point of submitting

- **Don't paste from other sites.** Text must be your own. Links are for checking, not for copying. Lightly rewording a TMDB or MyAnimeList synopsis still counts as copying.
- First submission requires accepting contributor terms: facts under the Database Contents License, and permission for us to publish what they write.
- Admins check for copied text and spoilers. Reviewing can't catch everything, so anyone can report a live value through moderation (#22).

### Protecting the queue

- A limit on open submissions per user, starting at 20.
- A duplicate pending value for the same field and title is refused, with a clear message.
- Admins can block abusive contributors and reverse their credit.

### Admins

- A new admin role, set server-side only and never user-editable. **Auth change: Ask first.**
- A review page, as part of the admin dashboard.
- Admin edits go through the same history, so a value always shows who approved it.

### Data

The spec finalises this; migrations are **Ask first.**

- New `community` schema, outside `catalog`: `submissions` (user, title, field, proposed value, source note, status, reviewer, reason, dates) and written content such as synopses.
- Approved corrections to ODbL fields are written to `catalog.overrides`, which needs extending. Imports never overwrite them, as the data rules require.
- RLS: users read and create their own submissions; only admins review; approval runs as one transaction with its achievement award.
- A public, machine-readable changes file for ODbL fields, generated from approved rows. No contributor personal data in it.

### Brief change on approval

Under Must have:

`43. Community contributions: users suggest data changes and an admin validates them before they go live (0026)`

Plus a line in the Decisions list. `CLAUDE.md` gains nothing yet.

## Consequences

- Flovet will be the review queue at first. If submissions outrun that, the next step is trusted reviewers, and later voting, each with its own decision.
- Riskiest assumption: enough users will contribute. With about 905 tracking rows so far, the community won't fill 38,337 titles soon. Imports (0022, 0023) and in-house editing remain the main way to fill gaps for now, with contributions growing over time.
- The catalog can't become a closed, proprietary asset while built from ODbL data. If that ever matters, it needs a separate decision and legal advice.
- Must be reconciled with 0023 multi-source: its order of work, its plan to extend overrides, and its source table.
- Reviews check: pending values invisible to others; non-admins can't approve (RLS test); imports leave approved values alone; undo works; no edit control on API data; terms accepted before the first submission; changes file carries no personal data; open-submission limit enforced.
