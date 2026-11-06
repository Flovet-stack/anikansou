# Specs

One spec per task. A task is the smallest piece of work that can be built, reviewed and merged on its own.

## Naming

`NN-short-name.md`: a two-digit sequence number and a short kebab-case name, for example `01-auth-sign-up.md`, `02-anime-card.md`. Numbers are never reused.

## Rules

- Agents build only what the current spec asks (see `CLAUDE.md`).
- A spec never changes `PROJECT_BRIEF.md`. The product team makes decisions and Flovet approves them; they are logged in `docs/decisions/`, and the brief keeps only product-wide ones.
- A spec links the approved decisions it implements and never restates them. Agents build only on approved decisions.
- If a task has no spec, write one (or ask) before building.

## Suggested sections

- **Goal**: one or two sentences.
- **Decisions**: links to the approved entries in `docs/decisions/` it implements (for example "Implements 0003, 0007").
- **Scope**: what is in, and what is explicitly out.
- **Acceptance criteria**: a checklist the reviewer agent can verify.
- **Notes**: schema, UI or data details, open questions.
