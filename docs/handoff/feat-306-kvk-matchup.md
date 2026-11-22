# feat/306-kvk-matchup — KvK matchup, slice 1 (#306)

## Built

- **Opponent on /admin.** A "KvK opponent" card (`app/_ui/admin/KvkCard.tsx`, `KvkForm.tsx`) to pick the next scheduled event or one of the 4 before it, save a server and up to 15 tags, and set the result (Won, Lost, Not set; admin-only). The route is `POST /api/admin/kvk-opponent` (PIN). The card lists each tag's Start and End outcome.
- **Tables** (migration `0069_kvk_opponents`): `kvk_opponents` is keyed by the war time (`event_at`). `kvk_reads` holds one row per call sent, with the members as uid, might and kills arrays: no names, no raw body.
- **Reads** (`lib/collector-opponent.ts`). After our own Start or End reads, inside the same run: one call per opponent alliance, no retry, on `LAP_API_KEY`.
  - Start: by tag (`GET /v1/alliances/{server}/{tag}?fresh=1`, new `V1Source.fetchAllianceByTag`), before the war only.
  - End: by the Start's `union_id`.
  - At most 15 + 15 calls per KvK, ever.
  - Identity checks: wrong server, duplicate, wrong alliance by id or by roster.
  - Our snapshot's status never changes.
- **Reserves.** `sampleQuota(n, k)` keeps the opponent's End reads. `eventReserve` (squads, lookups, Raid Shield checks) and the daily read's event term count 15 more alliances.
- **Event page** (`app/_ui/Matchup.tsx`, flag `kvk-matchup`): "KvK matchup" with both sides' top n at the Start, then "Start to End" over the members in both readings, and "Alliance by alliance".
- **End picture**: a block "vs server {s} · {a} v {b} alliances", then might and kills per side (`lib/event-image-kvk.tsx`).
- **Translations.** 17 Haiku translators. I changed five languages (sv, pl, uk, ru, vi, plus tr's glossary) back to "1B" and "60M": they had spelled out the number words, and D78 keeps K, M and B in every language, as the figures beside them show.
- **Docs.** D152, with amendments to D69 and D132. Glossary entries for opponent, matchup and damage report. Plan and validation in `.specs/features/306-kvk-matchup/plan.md`.

## Decisions

- **Separate tables, not `alliance_snapshots` rows.** About 37 readers of a phase would each need a filter. `raw_json` would also store another server's blocked roster keys.
- **One attempt per call, and rows never deleted.** This makes "about 30 calls" a hard 30.
- **No re-read of an error row** (unlike D62 for ours). A corrected tag is read on a later Start run before the war.
- **Opponent reads run after our run's deadline race, with their own hook.** A cap, a 429 or the time limit cannot touch our status (adversarial blocker 2).
- **The comparison uses equal sets fixed at the Start.** Nulls are left out, kills falls count as none, and only readings taken before the war are used (data-honesty review).
- **UI words.** "KvK matchup" and "Start to End"; "damage report" stays the code and glossary term. The officers and the designer both said "damage report" overclaims.
- **The result picker is kept** in this slice. The task prompt folds in #286. Product strategy had asked to defer it.

## Deviations

- **The Discord line is a block: a heading and two lines.** The owner asked for one line. The officers and the data-honesty review asked for kills and the per-side counts, which do not fit one line at 360 px.
- **No day-before tag check.** The issue's 2026-11-16 adversarial review recommended one. It costs about 15 more calls per KvK, past the approval. The /admin card shows each tag's Start outcome instead.
- **The opponent seed runs in `e2e/global-setup.ts` as a second transaction** (`e2e/fixtures/seed-kvk.ts`), because `seed.ts` is at the 300-line limit. The e2e env turns `kvk-matchup` on in `LOCAL_FLAGS`.

## Verified

- `pnpm vitest related --run` on the changed source files: 213 files, 1,200 passed, 1 skipped.
- `pnpm check`: exit 0 (prettier, eslint, tsc, Vitest, drift, i18n with 17 languages up to date).
- New tests:
  - `lib/collector-opponent.test.ts` (10)
  - `lib/kvk.test.ts` (6, including fast-check)
  - `lib/queries/kvk.test.ts` (6, PGlite, with a positive-controlled no-uid/no-blocked-key check)
  - `app/api/admin/kvk-opponent/route.test.ts` (4)
  - `lib/sources/v1-tag.test.ts` (2)
  - the picture's KvK block height (1)
  - `lib/budget.test.ts` (1)
- Tests changed with the behaviour: the daily read's quota numbers, the squads reserve, internal's `sid` shape, and the route inventory.
- `pnpm test:e2e` (full suite, with `next build`), locally on its own database `lap_e2e_k306` (dropped afterwards) and ports 3577/54477, so another worktree's e2e database was not touched: 53 passed, 3 skipped. The new matchup test passes on phone and wide.
- Screenshots at 360 px and wide, light and dark, reviewed by a designer persona: ship with changes, all six adopted.
- No upstream quota spent. No `pnpm fixture:record`. Invented data only.

## Review fixes (PR 679, deep review, 2026-11-22)

- **Finding 1 and finding 7 (critical): the reserves.**
  - `eventReserve`, `squadsReserve` and `dailyReadQuota` take `opponentCalls`, the opponent's calls still due. Each read at the Start still due counts 2 (it is read again at the End); each read at the End still due counts 1.
  - `opponentReserve` (`lib/kvk-reserve.ts`) gives it only on the KvK's quota day (`eventOnQuotaDay`, the condition `eventReserve` already used) and only with an opponent saved. On any other day it makes no query.
  - It is passed in by the squads read, lookups and the Raid Shield checks. The tick and /admin's Retry pass it to the daily read.
  - With no opponent saved, every reserve is as before D152. A test checks this, and the dev tests' old numbers are back unchanged.
- **Finding 5: the cap is hard.**
  - Each call first claims its row (error `sent: no answer stored`), then the answer replaces it. A run that dies in between never sends that tag again.
  - Workers are awaited with `Promise.allSettled`, and one worker's failure stops the others before their next call.
  - Found while writing the tests: each call is now counted against `MAX_UPSTREAM_CALLS` in the same synchronous step as the check. Before, four workers could pass the cap together, because each awaited its claim between the check and the call.
- **Finding 4:** a 429 sets the stop flag before the log write.
- **Finding 6:** a sample's opponent count (`opponentEndsDue`) is guarded. A failure is logged as `opponent.failed` and counts 0, so the opponent never changes our sample's outcome. With no opponent, the reads query is not made.
  - The review suggested falling back to 15. I used 0, because the orchestrator asked that an opponent failure never change our sample. The cost: if that query fails, a sample does not keep room for the opponent's End reads. The End's own quota check still never lets the opponent's reads take ours.
- **Finding 3:** new tests in `lib/collector-opponent-limits.test.ts`:
  - the 5 s floor;
  - `MAX_UPSTREAM_CALLS` with four workers;
  - a crash between the call and its stored answer, with no re-send;
  - an End answer from another alliance id;
  - `opponent.failed` keeping our Start complete and our sample read.
  - `lib/kvk-reserve.test.ts` checks that the reserves are unchanged with no opponent, are 2 per Start read before the Start, make no query on another day, and count only End reads once the Start has read. `lib/squads.test.ts` and `lib/daily-read.test.ts` have one test each for `opponentCalls`.
- **Finding 3 (docs):** D152, the D132 amendment and the plan say the reserve applies only on the KvK's quota day with an opponent saved. D152 also describes the claim-first rows and the sample guard.

- **Verified after the fixes:** `pnpm vitest related --run` on the changed files: 200 files, 1,136 passed, 1 skipped. `pnpm check`: exit 0. `pnpm test:e2e` (full suite, with `next build`, own database `lap_e2e_k306`, dropped afterwards, ports 3577/54477): 53 passed, 3 skipped.

## Open issues

- **No owner reply on the plan itself.** It rests on the owner's 2026-11-19 comment on #306 (quota, privacy, views) and the standing approval. One-way doors for the owner to see:
  1. Two new tables (additive).
  2. Up to 30 more `/v1` calls per KvK.
  3. Another server's member uids, might and kills stored, kept like every roster (D2).
  4. A new public section and Discord block behind a flag.
  5. The reserves outside the run (squads read, lookups, Raid Shield checks, daily read) keep the opponent's calls still due, at most 30, only on the KvK's quota day and only while an opponent is saved.
- **A failed tag at a complete Start stays unread for that KvK**, unless the owner forces a Start re-run. A forced re-run also reads our 20 again (about 20 calls).
- **A Start that already ran before the opponent was saved reads no opponent.** The owner must save it before Saturday 10:00 ST.

## Next

Follow-ups:

- the public "suggest the next opponent" form;
- tag discovery from the opponent's ranks board (needs a decision on `internal.ts`);
- a "read the opponent now" press;
- the D69 `*` member-change mark on Start to End rows;
- an admin Discord line listing tags that failed at the Start;
- review of PR 679, left for later:
  - finding 2: move the tag rule, the save-or-result branching and the offered-KvK check from the route handler into lib. The Start read could then check the tags it reads back too.
  - finding 8: test the `manual = false` condition of `opponentFor`; today's test seeds a rehearsal only.
  - finding 10: test the End picture block's flag and phase gate, its read failure, and the event page with the flag off.
  - finding 11: add the kvk modules and their edges to `docs/ARCHITECTURE.md`'s module map.
  - finding 12: derive the e2e expected strings (server 325, the labels) from seed and copy exports instead of literals.
  - finding 13: use `HEAVY_MIGHT` in the SQL instead of `60000000`.
  - finding 14: `opponentReads` for /admin selects the member arrays it does not need.

Owner question (review finding 9): a past KvK with no opponent saved before its war cannot get one now. The route refuses a server or tag change at or after the war, and the result needs an opponent row. Should a past KvK, such as the 2026-11-14 one, be recordable after the fact, with its server and result only (no tags, no reads)? Today it cannot.

Owner steps before 2026-11-28:

1. Create the `kvk-matchup` flag in PostHog project 741657 (off until the numbers are checked).
2. Release this with migration 0069 before Saturday's Start.
3. Save server and tags on /admin by Saturday 10:00 ST.
4. After the Start, check the card's per-tag outcomes. Turn the flag on when the numbers look right.

Add a patch-notes entry (`lib/patch-notes.ts`) at release.

What was missing from the task prompt? Whether the result should be public (settled: admin-only, per #286's closing comment) and whether the Discord "one line" could become a short block.

PR: https://github.com/daniro-san/LAPTracker/pull/679
