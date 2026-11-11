# 08zu-dev-papercuts

Issue 126, session 1 of 2. Six small fixes from the owner's decision of 2026-11-06.

## Built

1. Former name. `formerlyOf(history, tag, name)` in `app/_ui/event-rows.ts` sorts the name history by `firstSeen`, finds the entry for the (tag, name) the row shows, and returns the entry before it. It returns null for the first name, for an empty or missing history, and for a name not in the history. `comparisonRows` passes the row's own tag and name. One test added in `app/_ui/event-rows.test.ts`.
2. Seed ranks. `BaseMember` has `rankCode` and `rankLabel`; `loadBase` reads `rank_code` and `rank_label` from the fixtures (null when absent); `insertAlliance` writes both to `member_snapshots`.
3. `agentRules: false` in `next.config.ts`.
4. `scripts/check-drift.ts` runs `drizzle-kit generate` with stdin ignored, a 120 s timeout, and stderr captured and echoed. A nonzero exit, a timeout, or an `Error` line on stderr ends in the drift message, with `drizzle/` put back.
5. Image routes. `fetchImage` (`lib/images.ts`) returns the image, or `{ http_status }`, or `{ error }` (the error's class name). `logImageFailure` writes `console.warn("image.fetch_failed", { route, id, http_status | error })`. Both routes call it on failure. A missing stored photo, a bad uid, and a badge id outside 101-110 return before the fetch and log nothing. An upstream response that is OK but not a usable image (wrong type, over 1 MB, no body) logs `error: "UnusableImage"`.
6. `docs/brand/DRAWING.md`: render inputs of the Discord avatars beside the `GAIN` bullet. `docs/DECISIONS.md` D22: one dated amendment line (2026-11-11).

Dropped by the owner:
- No failure count on `/admin`: it needs storage, and `app_errors` rows would raise the hourly Discord alert on every photo-host outage.
- No rasterise script: the two PNGs are set once on the Discord webhooks, and a committed script would need `playwright-core` (a new dependency) or a headless-Chrome call that is not byte-reproducible.

## Decisions

- Item 1 tie rule: entries are ordered by `firstSeen`. The Before and After of one event carry the same time, so two names first seen at the same instant keep the order the sort leaves them in (history order, a stable sort). A name that comes back (A, B, A) is one entry, so a row showing A returns null even when B came between. This is the direct reading of "newest name seen before the name the row shows" over distinct (tag, name) entries.
- Item 4: `execFileSync` was replaced by `spawnSync`, because a timeout and a failed run must not throw. Failure also counts when stderr has a line starting with `Error`, because drizzle-kit 0.31.11 does not exit 1 without a TTY (see Deviations).
- Item 5: the failure value is the return value of `fetchImage` (`"body" in result` tells the two apart), so no callback and no shared state.
- Comments under `app/` and `lib/` say "issue 126", with no hash sign.

## Deviations

- Item 4: the plan said drizzle-kit rejects a prompt without a TTY and exits 1. It prints `Error: Interactive prompts require a TTY terminal ...` and exits 0 (checked with `pnpm exec drizzle-kit generate </dev/null; echo $?` and with `node node_modules/drizzle-kit/bin.cjs generate`, both 0). With only stdin ignored and a timeout, a rename would have passed the gate, because no file is written and `drizzle-kit check` is happy. The script therefore also reads stderr for an `Error` line. This is a change from the task text; without it the failure path did not reach the drift message.
- The drift message now reads "has changes with no migration in drizzle/, or drizzle-kit generate did not finish", and says "wrote nothing" when no file was written.

## Verified

- `pnpm check` green (prettier, eslint, tsc, vitest 246 passed and 1 skipped, drift, i18n).
- Item 2 (one-off vitest file in the scratchpad, PGlite, `seed(db, {})`, then a query of `member_snapshots`):
  `SEED RANKS [{"rank_code":103,"rank_label":"R3","n":5825},{"rank_code":102,"rank_label":"R2","n":2318},{"rank_code":101,"rank_label":"R1","n":1580},{"rank_code":104,"rank_label":"R4","n":381},{"rank_code":104,"rank_label":"R4 · Recruiter","n":119},{"rank_code":104,"rank_label":"R4 · Overseer","n":119},{"rank_code":104,"rank_label":"R4 · Militarist","n":119},{"rank_code":105,"rank_label":"R5","n":119}]` and `NULL rank rows [{"n":0}]`.
- Item 5 (same one-off file; both route handlers called with `testContext` and a replaced `ctx.fetch`; `console.warn` captured):
  - HTTP 503 (body text contained a URL): `["image.fetch_failed",{"route":"/img/avatar","id":"340024664389","http_status":503}]` and `["image.fetch_failed",{"route":"/img/badge","id":"101","http_status":503}]`; both responses 404.
  - Thrown `TypeError` (message and cause contained a URL): `["image.fetch_failed",{"route":"/img/avatar","id":"340024664389","error":"TypeError"}]` and the same for the badge with `"id":"101"`.
  - The captured lines matched against `/https?:|secret|globallap|site\.test/`: no match.
  - A uid with no stored photo and badge id 999: 0 warn calls.
- Item 4: copied `lib/schema.ts` to the scratchpad, changed `text("rank_label")` to `text("rank_label_x")` (a rename), ran `pnpm exec tsx scripts/check-drift.ts </dev/null`. Output: `Error: Interactive prompts require a TTY terminal ...`, then `Migration drift: lib/schema.ts has changes with no migration in drizzle/, or drizzle-kit generate did not finish.` and `drizzle-kit generate wrote nothing; removed again.`; exit 1; `drizzle/` still 14 entries. Copied the scratchpad file back: `grep -c rank_label_x lib/schema.ts` gives 0. Clean path: same command prints `No schema changes, nothing to migrate` and `Everything's fine`, exit 0. The 120 s timeout was not exercised.
- Item 3: no `AGENTS.md` before; started `next dev -p 3917` with placeholder env values inline, waited 10 s, made no request, killed the process by port (nothing left listening); no `AGENTS.md` afterwards, `git status` shows none. I did not run it with `agentRules` removed, so this shows the file is not written, not that it would have been written without the option. The log showed `Invalid environment: SERVER_TZ ... EVENT_WEEKDAY ... EVENT_TIME ... SNAPSHOT_BEFORE ...` for the variables I left out; the server stayed up.
- Item 1: the new test passes; `comparisonRows` tests still pass.

## Open issues

- `seed-data.ts` moves members between alliances and they keep their rank fields, so a seeded alliance does not show one leader and four officers in every snapshot (R5 appears in 119 rows, R4 in 738). Titles not rewritten.
- `scripts/seed.ts` is about 312 lines after this change; ESLint's limit is 300 lines of code, and `pnpm check` is green, so it counts under the limit. A later seed change may need a split.
- Behavior of `drizzle-kit generate` (exit 0 on an error) is a property of 0.31.11; a later drizzle-kit may exit 1, which the script also handles.
- `fetchImage` has no unit test; its failure values are covered only by the one-off check, as the owner decided.

## Next

Session: 08zv-local-postgres.

Model / effort: keep (opus · medium). It adds one dependency, a Postgres cluster, a bridge and a preload, and ends with four pages checked on a running dev server. This session's code was small (about 10 changed files) and needed one medium-effort pass, so there is no measured reason to raise or lower it.

Owner must do first (the four questions of the triage comment of 2026-11-11):
1. Preload for `pnpm dev`: wrap `globalThis.WebSocket` in the preload (recommended: `lib/db.ts` and `next.config.ts` stay untouched), or add the driver to `serverExternalPackages`? Note `next.config.ts` is now touched by this session (`agentRules`), so "untouched" no longer holds for it; the preload recommendation does not depend on that.
2. Local steps go in CONTRIBUTING.md, not README (recommended), yes?
3. Is an empty member history page locally acceptable for `Closes #126` (recommended: yes, say so in the handoff), or should the seed fill `daily_rosters` first?
4. Session 1 committed only the item 1 test; item 5's no-URL rule has a one-off check, no committed test. Say so if you want one test per image route.
Also: merge this PR into `dev` first.

Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md`. `docs/DECISIONS.md` D22 got one amendment line here; D47 is still free for session 2.

<adjustments>
- `next.config.ts` has `agentRules: false` now. The task text for 08zv says `lib/db.ts` and `scripts/migrate.ts` stay untouched; it does not require `next.config.ts` untouched, so no conflict, but check `git diff --stat` against those two files only.
- `drizzle-kit generate` exits 0 when it cannot prompt. If 08zv runs drizzle-kit anywhere, do not rely on its exit code.
- Seed ranks now exist: after `pnpm db:seed`, `member_snapshots.rank_code` is filled for every row (0 nulls on PGlite), so the Leadership section has data to render. Skip adding rank fields to the seed.
- `next dev` with only the Neon variables set logs `Invalid environment` for `SERVER_TZ`, `EVENT_WEEKDAY`, `EVENT_TIME`, `SNAPSHOT_BEFORE` and the rest of the schedule variables, so the CONTRIBUTING placeholders must include those (a working set is in `lib/app-context.test-helpers.ts`, `TEST_ENV`).
- Both image routes now log `image.fetch_failed` on a failed upstream fetch. With the upstream base URLs pointed at `127.0.0.1:9`, a local page that shows a badge or photo will log these lines; that is expected, not a bug.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/216
