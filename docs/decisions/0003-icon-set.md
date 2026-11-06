# 0003: Icon set from icons-animated

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: UI, Frontend, Tech Lead)
- **Approved:** 2026-11-06 by Flovet (this also approves adding the pinned Motion packages the set needs)
- **Specs:** —

## Context

The brief picks icons-animated (MIT, Motion-based) and asks for one set: Hugeicons, Tabler, Phosphor or Heroicons. The project currently depends on `lucide-react` through shadcn (`components.json` → `"iconLibrary": "lucide"`).

## Research

| Set       | What it is                                                                                             | Adopt / adapt / reject  | Why                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hugeicons | 4,000+ icons, rounded stroke style                                                                     | **Adopt (recommended)** | Largest set, so we're unlikely to run out (stars, half stars, bookmarks, tv, calendar, chart); rounded ends match the rounded shape language (design brief §8.4); less common on the web than Lucide or Tabler |
| Phosphor  | Large family; in icons-animated the regular icons are filled SVG paths, so stroke width can't be tuned | Fallback                | Good shapes, but we can't match stroke weight to type                                                                                                                                                          |
| Tabler    | 2 px stroke, very large                                                                                | Reject                  | Visually close to Lucide, the shadcn default: reads as template                                                                                                                                                |
| Heroicons | Tailwind Labs' set, small                                                                              | Reject                  | Smallest set and the most "Tailwind" look                                                                                                                                                                      |

Sources (opened): https://github.com/ln-dev7/icons-animated (README: sets, shadcn registry install, Motion pin `motion@13.1.1`, MIT and `THIRD_PARTY_NOTICES.md`). https://icons.lndev.me/ only loads with JavaScript, so per-icon availability is checked in the foundations spec.

## Options

1. Hugeicons (recommended)
2. Phosphor
3. Tabler or Heroicons (rejected above)

## Decision

Proposed: **Hugeicons**, installed per icon through the registry (`pnpm dlx shadcn add @icons-animated/hugeicons-<icon>`), which brings Motion at the pinned versions.

Before install, the foundations spec confirms the set has the icons we need first: home, search, star, star-half (or a way to clip one), heart (outline and filled state), bookmark (outline and filled), user, settings, plus, check, close, chevrons, sun and moon. If more than two are missing, fall back to Phosphor and log the change.

## Consequences

- **New dependencies:** Motion packages at pinned versions. This needs Flovet's OK under CLAUDE.md "Ask first: adding a dependency"; approving this decision counts as that OK.
- `components.json` `iconLibrary` and the shadcn components using lucide move to Hugeicons over time; `lucide-react` is removed when no file imports it.
- Keep the library's `LICENSE` and `THIRD_PARTY_NOTICES.md` in the repo.
- Reviews check: one set only, icons `aria-hidden`, animation only on interaction, reduced motion honoured.
