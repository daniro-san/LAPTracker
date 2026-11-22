# Errors: server source maps, lib/private reports, browser URL masking checks

Profile: light
Build: `pnpm typecheck`; `pnpm lint`
Plan: `.specs/features/errors-server-maps-private/plan.md`

11 checks in 4 slices · 1 one-way door · 0 open, of which 0 block

## Checks

### S1 - server frames readable in PostHog

**C1** - With the key, the CLI runs `sourcemap process --directory .next/static` then `--directory .next/server`, and no map is left in `.next/server` (AC 1, AC 2)
Proof: `pnpm exec vitest run scripts/sourcemaps.test.ts -t "uploads the server's maps after the browser's"`

**C2** - Without the key, no CLI run, and both directories' maps are deleted while chunks and manifests stay (AC 2)
Proof: `pnpm exec vitest run scripts/sourcemaps.test.ts -t "without the personal key"`

**C3** - A failed or timed-out run still deletes both directories' maps and the build line says which failed (AC 2)
Proof: `pnpm exec vitest run scripts/sourcemaps.test.ts -t "deletes the maps even when the upload fails|times out"`

**C4** - A server run stopped mid-rewrite leaves the server chunk exactly as Next built it; the browser's finished run keeps its rewrite (AC 3)
Proof: `pnpm exec vitest run scripts/sourcemaps.test.ts -t "never ships a chunk the CLI was stopped while rewriting"`

**C5** - The CLI's environment is PATH, HOME, POSTHOG_CLI_* and the key only, and the key is in no argument and no build line (AC 1, AC 5)
Proof: `pnpm exec vitest run scripts/sourcemaps.test.ts -t "gives the CLI only PATH, HOME|hands it to the CLI's environment only"`

**C6** - A frame in a chunk loaded with posthog-cli 0.19.0's snippet carries that chunk's `chunk_id`; every other frame carries none (AC 4)
Proof: `pnpm exec vitest run lib/analytics/server.test.ts -t "a frame in a chunk the build injected"`

### S2 - swallowed lib/private failures reach Error Tracking

**C7** - `frameReadStatus`'s failure calls `report` once with exactly `{ route: "lib/private/read-status.ts", kind: "w.read_status.failed" }` and still returns null (AC 6)
Proof: `pnpm exec vitest run lib/private/read-status.test.ts -t "reports the failure to error tracking"`

**C8** - A Discord import whose drafts' insert fails sends one `$exception` with `kind` `w.import.discord_failed`, the message cut at `params: …`, and no invented name from the read lines anywhere in the batch (AC 6, AC 7)
Proof: `pnpm exec vitest run lib/private/discord-interaction.test.ts -t "reports a failed save to error tracking"`

**C9** - `ReportContext` accepts only the listed module/code pairs, and `lib/private` imports no `lib/notify*` or `lib/discord-*` (AC 6, AC 9)
Proof: `pnpm typecheck && pnpm lint`

**C10** - The expected-failure catches named in AC 8 do not report: none of them calls `report` (AC 8)
Proof: `! grep -l "report(" lib/private/time-zones.ts lib/private/sign-in.ts lib/private/member-facts.ts lib/private/discord-interaction.ts lib/private/discord.ts lib/private/import-read.ts lib/private/notice-publish.ts`

### S3 - the browser SDK masks person keys in URLs

**C11** - On a public and a desk load, init carries `mask_personal_data_properties: true` and `custom_personal_data_properties` with `m` and `q` (AC 10)
Proof: `pnpm exec vitest run lib/analytics/posthog.test.ts -t "has the SDK mask a member's uid"`

### S4 - IP recommendation

AC 11 is a handoff paragraph, read by the owner: `docs/handoff/feat-errors-server-maps-private.md` § Decisions.

## Coverage

| Set (size)            | Member -> proof                                                                                                           | Unproven |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| map directories (2)   | `.next/static` C1, C2 · `.next/server` C1, C2, C4                                                                         | -        |
| CLI outcomes (3)      | exit 0 C1 · exit 1 C3 · timeout C3, C4                                                                                    | -        |
| reporting catches (6) | `frameReadStatus` C7 · `runJob` failure C8 · `matchOnRead` C9 · `runJob` settle C9 · webhook open C9 · invite commands C9 | -        |

The four C9 members are proven by the closed type only, not by a run-time test: one test per behaviour (CLAUDE.md), and C7 and C8 cover the behaviour.
| person query keys (2) | `m` C11 · `q` C11 | - |
| page areas at init (2) | public C11 · desk C11 | - |

## Swept

- validation: C9 - the context's type is the validation
- failure modes: C3, C4, C7, C8
- idempotency: n/a - a build step and fire-and-forget reports; nothing is retried
- authorization: n/a - no route or access rule changes
- concurrency: n/a - the two CLI runs are sequential (`spawnSync`)
- data lifecycle: n/a - nothing stored by us; symbol sets live in PostHog
- dependency failure: C3, C4 (CLI), C8 (database)
- state transitions: n/a - no state machine
- observability: C6, C7, C8

## Handoff

- **Settled mid-build:** none
- **Dispatched:** product-strategy and adversarial plan reviewers (returned, verdicts in plan.md § Plan review). Verifier: not dispatched by the builder (skill rule 5); owed by the orchestrator over `origin/dev..HEAD`
- **Boundary:** C1-C11 closed at the feature commit
- **Abandoned:** running `posthog-cli sourcemap inject` locally to see its output: it needs credentials (it resolves the release), so the snippet was read from the 0.19.0 binary instead
