# AniKansou: agent instructions

@AGENTS.md

## Before any task

- Read `PROJECT_BRIEF.md` and the spec in `specs/` for the current task.
- Build only what that spec asks. Never work on several features at once, and never add a feature "while you're there".
- If no spec covers the task, ask before building.
- Read the decisions in `docs/decisions/` that the spec links. Build only on decisions with status `Approved`. If the task needs a decision that isn't logged and approved, stop and ask; never make it yourself.

## Commands

| Task       | Command                                         |
| ---------- | ----------------------------------------------- |
| Format     | `pnpm format` (check only: `pnpm format:check`) |
| Lint       | `pnpm lint`                                     |
| Typecheck  | `pnpm typecheck`                                |
| Unit tests | `pnpm test`                                     |
| E2E tests  | `pnpm test:e2e`                                 |
| Build      | `pnpm build`                                    |

## Always

- Run the checks above and show the evidence (command output, screenshots for UI) before saying a task is done.
- Run the `reviewer` subagent on the diff against the task's spec before opening a PR.
- After finishing any task, run /product-team Workflow E and post the review on the PR before saying done.

## Ask first

- Adding a dependency.
- Schema changes (new migrations, RLS policies).
- Auth or environment variable changes.

## Never

- Call any external anime API (AniList, MyAnimeList, Jikan, Kitsu, AniDB, TMDB, TheTVDB, etc.). The only data source is the one named in the brief.
- Edit a migration that has already run. Add a new one instead.
- Use `any` or `@ts-ignore`.
- Commit secrets (`.env.local`, keys, tokens).
- Push to `main`. Work on a branch and open a PR.
