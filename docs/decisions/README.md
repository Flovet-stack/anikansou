# Decision log

The product team researches and makes every product, UX, UI and architecture decision for AniKansou, and Flovet approves each one. This folder records them, so that builds and reviews follow written decisions instead of chat history.

## Rules

- **One file per decision:** `NNNN-short-name.md`, for example `0001-icon-set.md`. Copy [`0000-template.md`](0000-template.md). Numbers are never reused.
- **Research comes first.** Every decision includes the Research block from the product-team skill (Step 1): the references checked, what each does, and the sources actually opened.
- **Nothing is built on a decision that isn't approved.** A decision starts as `Proposed`. It becomes `Approved` only after Flovet explicitly approves it (in chat or on the PR); the agent then records the status and date.
- **Never edit an approved decision.** To change one, write a new decision that supersedes it, and set the old one's status to `Superseded by NNNN`. The status line and the `Specs:` back-link are the only edits allowed on an approved decision.
- **Specs link decisions; they don't repeat them.** A spec lists the decisions it implements (for example "Implements 0003, 0007"). The decision itself stays here only.
- **Reviews check against decisions.** Workflow E checks the diff against the spec and every decision the spec links. A build that makes a new decision nobody logged is a finding.
- **Log only what limits the build.** Choices of approach, design, data, scope or dependencies get an entry. Copy tweaks and lint fixes don't.
- **The brief keeps product-wide decisions only.** The brief's Decisions list has a one-line entry for each product-wide decision; everything else stays here.

## Statuses

`Proposed` → `Approved` (or `Rejected`) → optionally `Superseded by NNNN`.

Decisions made before this log existed are listed in `PROJECT_BRIEF.md` or in the decision tables of existing specs (`specs/01-catalog-import.md`, `specs/02-accounts.md`). They stay valid and count as approved; new decisions that change them get a file here.
