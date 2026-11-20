# feat — the squads read as a daily queue, and every /v1/players read kept (issues 472 and 490)

## Built

- **The daily queue (#472, D132).**
  - New table `squad_queue`: one row per member, alliance and quota day, with `state`, `attempts` and `due_at`.
  - Every tick starts one batch per alliance after its answer (`scheduleSquadsBatch`). The old time window is gone.
  - A batch makes at most 25 calls and stops after 60 s. It reads the members whose turn has come, oldest first. No batch starts when it would end after 00:00 UTC.
  - Each call's outcome is saved in one transaction, under the batch's claim: the day's counts and the member's queue row (`saveCall`).
  - A 5xx, no answer, or a call the deadline cut goes to the back of the queue, 15 minutes later. After 3 attempts the member is `failed` for the day. Any other failure is `failed` at once.
  - A 429, or on a workspace key a 401 or 403, stops the day. D124's key marking is unchanged.
  - The KvK reserve now waits (`reason: quota`, the row stays `running`) instead of skipping the day.
  - On `LAP_API_KEY`, nothing runs during the event's Before/After window. A workspace key is not paused there.
  - New members are queued from an answer's `alliance_members` uids, when the tracker updated that alliance after the day's roster read.
  - The cap of 120 calls a day is unchanged, and no `fresh` is sent.
  - The /admin press (#482) and `POST /api/squads-read` run the same queue.
- **Every read kept (#490, D132).**
  - `player_reads`: one row per answer. `raw_json` is the body less `alliance_members`. The extracted columns are `shielding`, `shield_type`, `map_updated_at`, `last_seen_at`, `language`, `power`, `kills`, `player_union_id`, `sid`, `home_sid` and `vip`.
  - `player_history`: one row per `(union_id, uid, t)`, from `history[].observed_at`. Insert on conflict do nothing.
  - `member_squads.troops`, and `honor` on each stored hero.
  - Once a day, after the first daily read (next to D125's job), `raw_json` older than 90 days is set to null. The log line `players.raw_cleared` holds a count.
  - The adapter reads the new fields leniently: a field of another type becomes null.
- **Export and delete (D125).**
  - `player-reads.csv` (its columns, without `raw_json`) and `player-history.csv` are in the download. `squad_queue` is deleted with the workspace and never downloaded.
- **Progress.**
  - /admin's Squads read section: "Squads today: N of M read · R waiting to retry · F not read · quota left Q", plus "Next try at HH:MM server time." When everyone left waits for a later try, the state line reads "N waiting to try again · next try at HH:MM ST" instead of "More to read.", and the "Run the next batch" button is hidden (a press would find nobody due).
  - Alliance settings, under the tracker key, in EN, PT-BR and FR: "Squads today: N of M read · R waiting to try again · next try at HH:MM ST".
- **Review of PR 505, fixed.**
  - A failed write of a player read carries no body field: `storePlayerRead` rethrows it as `player_reads.write_failed <class> <Postgres code>`, with no cause. So nothing of the body reaches `app_errors` or `console.error`.
  - The download leaves `raw_json` out of `player-reads.csv`. About 90 days of raw bodies would pass the 4.4 MB limit. The columns and the history rows stay in it.
  - A stopped day shows why, with no "next try". In Settings (EN, PT-BR, FR) it reads "Squads today: N of M read · stopped: the tracker refused the key", "… the limit is reached until 00:00 UTC" or "… today’s 120 reads are used". On /admin it reads "Stopped: the tracker refused the key." and similar. The words come from one rule, `stopKind` in `lib/squads.ts`.
  - A 401 or a 403 on `LAP_API_KEY` stops the day after that one call, as on a workspace key. Before, each member failed alone until the cap.
- **Migration** `0053_squads_queue_player_reads` (`pnpm db:generate`). It drops `squad_reads.after_uid` and `retry_uids`.
- **Docs.** New decision D132. Dated amendments to D117 and D125. The ARCHITECTURE entry is updated.

## Decisions

- `player_history` is keyed by `(union_id, uid, t)`, not `(uid, t)`. Two workspaces that read the same player each keep their own rows, so neither reads, keeps or deletes the other's.
- `t` is the history row's `observed_at`. The real body has no `t` key: its keys were checked by type only, from the 2026-11-19 sample notes.
- A 401 on a workspace key marks it `invalid`, as D124 and the issue say (confirmed by the orchestrator). In D124, `reenter` is only for a changed master key.
- The decision is D132: D131 was taken on dev by the sign-in chooser (#504) while this branch was open.
- `honor` is left out of the "unchanged squad" comparison, so squads stored before this change do not all count as changed.
- A batch that makes no call and ends nothing writes no `squads.batch` line. Otherwise 96 ticks a day would each write one.
- Newcomers are found in the answers' `alliance_members` uids. That is the only roster source between daily reads that costs no extra call. A cached body older than the day's roster adds nobody.
- The press still refuses during the event window for every workspace, as before (#482).

## Deviations

- No `squad_queue` export file. Like `squad_reads`, it holds counts and state, not alliance data.
- `manual-event` and `rehearsal` route tests now stub `after`, because every tick now schedules a batch.

## Verified

- `pnpm check`: see the commit report.
- Tests, stubs only (no upstream call, no `/api/quota`):
  - `lib/squads-read.test.ts` (12 tests): batches, the cap, the reserve wait and the event pause, a 429, a 401 or 403 on our own key stopping the day after one call, a 502 tried 3 times, newcomers, the claim, the deadline, troops and honor, one player read per answer.
  - `lib/squads-read-press.test.ts` (2 tests).
  - `lib/repo/player-reads.test.ts` (3 tests): history rows once per alliance and member; a forced insert failure (an out-of-range `sid`) whose error, and what `app_errors` would keep of it, holds no body field; the 90-day clear.
  - `lib/private/squads-today.test.ts` (2 tests): a running day gives the next try; a stopped day gives the reason and no next try.
  - The export test checks that `player-reads.csv` has its columns and no `raw_json`.
  - `lib/sources/v1-player.test.ts`: the facts, the history, the body less `alliance_members`, and lenient fields.
  - `lib/queries/squads-progress.test.ts`, the admin press route and the tick route.
  - The D125 seed now covers the new tables: the export holds no private marker; the purge and the cross-workspace export check include the new tables.
  - The #471 suite (`lib/workspace-keys.test.ts`): two workspaces' answers are stored under their own alliances.
- All 54 migrations applied to an empty local Postgres 18.
- **Local e2e.** Production build, local Postgres, an invented OGs workspace with 101 invented members, and a queue at 98 of 101 with 3 waiting. **52 of 52 checks pass**:
  - Alliance settings at 360 and 1280, light and dark, EN and PT, plus FR at 360: the line's text, no sideways scroll, no private field in the HTML.
  - /admin at 360 and 1280, light and dark: the same checks.
  - Screenshots are in the scratchpad's `472-shots/`.
- Size, measured on PGlite through the real write path with a synthetic body of the measured shape:
  - The body is 53.7 KB, or 12.2 KB without `alliance_members`. Stored `raw_json` averages about 2.5 KB.
  - `player_reads` grows about 320 KB a day for 100 members, about 29 MB once the 90-day clear runs.
  - `player_history` takes 690 KB on the first day, then about 90 KB a day (about 33 MB a year).
- Expected calls a day for OGs: about 106–107 (101 members plus about 5 % retries). The cap is 120. A normal night is done in about 4 ticks, about an hour.
- No name from the 323 in the fixture rosters appears in the added lines.

## Open issues

- The size estimate is synthetic. Measure it on the first real day with the query in D132.
- A `squad_reads` row left `running` by the old code at deploy time gets its queue from the roster. Members that row had already read that day can be read once more.
- Follow-up: when a workspace key's start-of-day `/quota` call fails with a 5xx, the whole day is still skipped (`quota_unknown`), as before. Under the queue it could be tried again on the next tick. Not built here.
- Left by the review of PR 505 for a follow-up the orchestrator files: the Settings page's own copy of the running rule (`READING`), the newcomer test that passes without proving the stale roster adds nobody, the purge test, a partial index for the queue's waiting rows, and re-queuing the roster after every answer.
- The local e2e (52 of 52) ran before the review fixes. The stopped-day lines are covered by `squads-today.test.ts` and the typecheck, not by new screenshots.
- Nothing reads `player_reads` or `player_history` yet. #474, #461, #487 and #489 add readers in `lib/private` after `requireWorkspace`.

## Next

- Model and effort: keep. The desk status bar (#478) is UI over the counts this PR adds (`queueCounts`, `squadsToday`).
- What the owner must do first: merge, then let one real night run. After that night, run D132's size query and `select state, count(*) from squad_queue group by 1`.
- The plan itself needs no change.

<adjustments>
- #478 can read today's progress from `lib/private/squads-today.ts` (`squadsToday`), with the workspace taken from the session. It returns `started`, `read`, `members`, `retrying`, `nextAt` and `stopped` (`key`, `limit`, `cap` or null). Do not write another query.
- #474's Friday 23:30 ST burst: the queue's batch is 25 calls in 60 s. A burst of the whole alliance needs its own loop (a press-like run of several batches) on the same queue. The shield fields are already stored per read (`player_reads.shielding`, `shield_type`, `map_updated_at`).
- #461, #487 and #489: the previous alliances and the might and kills timeline are in `player_history` (`union_abbr`, `player_union_id`, `power`, `kills`, `t`). It is keyed per workspace alliance.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/505
