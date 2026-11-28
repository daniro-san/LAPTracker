# feat/793-me-kvk-squads — Me: thanks for the member's own KvK kills; their squads

Issue #793 (adopted in spike #789). D142 amended 2026-11-28.

## Built

- `ownEventReads` (`lib/repo/me.ts`): one query. It reads the member's own uid's power and kills in the Befores and Afters (no samples) of the alliance's newest public scheduled event of the last 30 days whose Start and End rows of the alliance are both fresh and not failed (D159's rule). No raw_json is read.
- `killsThanks` (`lib/private/me-parts.ts`): End − Start through `windowedStart` and `betweenSlots`, so a multi-window event counts the sum of its windows (D160), with `killsGain` (D15). It returns null with no such KvK, when the member is missing from a fresh Start, End or read between windows, or when the gain is 0 or less.
- `meView` returns `progress.thanks`. `MeProgress` shows it first under "Your progress", before the lead line and the charts, as a plain line with a compact number.
- Copy in EN, PT-BR and FR (`me.kvk.thanks`).
- D142 has a dated amendment.

## Decisions

- "Last KvK" is the newest public scheduled event of the last 30 days. The KvK recap (D159) and Me's recovery line use the same rule.
- A gain of 0 or less shows no line. A zero or a fall would read as a score (D75), so the line only ever thanks.
- No KvK or no gain means no line at all, with nothing in its place. The issue's test list asks for "no KvK → no line". The squads card keeps its existing calm line ("The tracker has not seen your squads yet."), and a pending link keeps its waiting line.

## Deviations

- Item 2 (squads with hero names, read-only) was already built on Me by PR 534 (D142 item 2: `squadsCardOf` with names from `hero_catalog`, the catalog that `lib/heroes.ts` refreshes). This branch does not change it. It adds a test that the member's own squads show their heroes' names and never another member's.
- The cache-header test was not duplicated. `proxy.test.ts` already asserts `private, no-store` on `/w/lnk/board/me`, and it passed in `pnpm check`.

## Verified

- `pnpm vitest related --run` on the changed files: 107 of 108 files passed on the first run. The one failure was the new test's seed, which was missing `status`. After the fix, `me/route.test.ts` passed 12 of 12.
- `pnpm check`: prettier, eslint, tsc, vitest (390 files, 2,121 tests), drift and i18n all passed.
- The thanks test uses a two-window event: 200K + 500K = "700K". A plain End − Start would give 1M, so the test fails if the window sum is lost.
- Not rendered in a browser. There is no local data with a two-window event.

## Open issues

- On Origin of Chaos weeks (week 4, D160 amendment b), the newest public scheduled event is Origin of Chaos, so the line says "in KvK" for it. The recovery line and the D159 recap have the same wording issue. Follow-up: name the event by kind, or limit "KvK" to the env's weekly event.
- `ownEventReads` reads every Before and After of the alliance's events in 30 days (about 5 events × up to 8 rows), then picks the newest usable one in JS. This is bounded and small, but a `limit` by event would need a second query.

## Next

- Follow-up: the Origin of Chaos wording above.

What was missing from the task prompt? That squads were already on the Me page since PR 534, so item 2 needed only a test.

PR: (added by the orchestrator)
