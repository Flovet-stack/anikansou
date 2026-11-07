# Specs

One spec per task. A task is the smallest piece of work that can be built, reviewed and merged on its own.

## Naming

`NN-short-name.md`: a two-digit sequence number and a short kebab-case name, for example `01-auth-sign-up.md`, `02-anime-card.md`. Numbers are never reused.

## Rules

- Agents build only what the current spec asks (see `CLAUDE.md`).
- A spec never changes `PROJECT_BRIEF.md`. The product team makes decisions and Flovet approves them; they are logged in `docs/decisions/`, and the brief keeps only product-wide ones.
- A spec links the approved decisions it implements and never restates them. Agents build only on approved decisions.
- If a task has no spec, write one (or ask) before building.

## Status

Every spec starts with a status line under its title, for example `Status: Done (PR #4, merged 2026-11-06)`.

| Status        | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `Blocked`     | Written, but a decision it needs isn't approved yet. Say which one. Nobody builds it. |
| `Ready`       | Every decision it links is approved. It can be built.                                 |
| `In progress` | A builder is working on it. Add the branch or PR.                                     |
| `Done`        | Merged to `main`. Add the PR number and merge date.                                   |
| `Dropped`     | Won't be built. Say why. The number is never reused.                                  |

Update the status in the same PR that changes it: the PR that starts the work sets `In progress`, the PR that finishes it sets `Done`.

| Spec                                                 | Status  |
| ---------------------------------------------------- | ------- |
| [01: Catalog import](01-catalog-import.md)           | Done    |
| [02: Accounts](02-accounts.md)                       | Done    |
| [03: Internationalization setup](03-i18n-setup.md)   | Blocked |
| [04: UI refresh](04-ui-refresh.md)                   | Done    |
| [05: Swipe deck](05-swipe-deck.md)                   | Done    |
| [06: Deck and icon fixes](06-deck-and-icon-fixes.md) | Done    |
| [07: Library](07-library.md)                         | Done    |
| [08: AniList posters](08-anilist-posters.md)         | Ready   |

## Suggested sections

- **Status**: see above.
- **Goal**: one or two sentences.
- **Decisions**: links to the approved entries in `docs/decisions/` it implements (for example "Implements 0003, 0007").
- **Scope**: what is in, and what is explicitly out.
- **Acceptance criteria**: a checklist the reviewer agent can verify.
- **Notes**: schema, UI or data details, open questions.
