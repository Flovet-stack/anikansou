# 0032: PostHog server logs

- **Status:** Proposed
- **Proposed:** 2026-11-11 by the product team (roles: Tech Lead, Backend)
- **Approved:** (pending Flovet)
- **Specs:** specs/11-seo-and-analytics-foundations.md

## Context

PostHog's setup wizard (PR #24) added a server log export to PostHog through OpenTelemetry, with four dependencies. 0031 didn't include server logs, and the dependencies weren't approved (`CLAUDE.md`: ask first). While reconciling PR #24 with 0031 in spec 11, Flovet chose to keep the logs.

## Research

| Reference                     | What they do                                                                                                    | Adopt / adapt / reject | Why                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------- |
| PostHog logs for Next.js      | Standard OpenTelemetry SDK; an OTLP exporter posts to `<host>/i/v1/logs` with the project key as a bearer token | Adopt                  | No PostHog-specific package, and the key is already set |
| PostHog guide's sample        | Hard-codes the project key in `instrumentation.ts`                                                              | Reject                 | The key comes from `env`, like the browser setup        |
| The wizard's version (PR #24) | Batches records and flushes after the response; only explicit log lines are exported                            | Adopt                  | Doesn't slow responses or send console output           |

Sources: PostHog's Next.js logs guide (pasted by Flovet on 2026-11-11) and https://posthog.com/docs/libraries/next-js.

## Options

1. **Keep the log export.** Server-side visibility, such as how often poster lookups find covers. Adds four dependencies to the server bundle.
2. **Remove it.** Nothing new to maintain, and no visibility on the server.

## Decision

Option 1, with these limits:

- Logs go out only when both `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` are set, read through `src/env.ts`.
- Log lines carry counts and flags only. No user IDs, emails, usernames, titles a user rated, or review text.
- Only lines written through `src/lib/posthog-logs.ts` are exported; console output isn't.
- `src/instrumentation.ts` holds the setup, inside `src/` as Next.js requires for projects with a `src` folder.

## Consequences

- Adds `@opentelemetry/api-logs`, `@opentelemetry/exporter-logs-otlp-http`, `@opentelemetry/resources` and `@opentelemetry/sdk-logs`. Approving this decision approves them.
- Log volume counts against PostHog's free tier, so keep log lines to events worth reading.
- A review should check that each new log line holds no personal data.
