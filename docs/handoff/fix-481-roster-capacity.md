# fix-481 — A roster above its capacity

Issue 481. Branch `fix/roster-over-capacity`, cut from `origin/dev` at 99da9705, rebased onto c4314a63 (after #517 and #522).

## Built

- **Boundary check** in `toSnapshotInput` (`lib/sources/shared.ts`), used by both adapters:
  - When the body lists more members than its `capacity`, a member with `rank_code: null` and an empty or missing `rank_label` is left out of `members`. Under capacity, or with no `capacity`, every member is kept. A member whose body has no rank fields at all is never left out.
  - `memberCount` is `member_count` less the members left out. `totalKills` is the sum over the members kept.
  - New optional field `listed` on `AllianceSnapshotInput` (`lib/sources/types.ts`): how many members the body listed.
  - `raw` is the body as sent, so `raw_json` still holds every listed member.
- **Members tab read.** `endOfDayReads` (`lib/repo/workspace-rosters.ts`) keeps only the raw_json members whose uid is in the row's `member_uids`. It is the only read of `raw_json`'s members array; `latestRoster` already started from `member_uids`.
- **Squads queue.** No code change: `dayRosterUids` reads `member_uids`, which no longer holds the unranked member.
- **Log line** `roster.over_capacity` (`logRosterCheck`, `lib/collector-log.ts`): a `warn` with `union_id`, `members` (as listed), `capacity` and `unranked`, written only when the body lists more than `capacity`. It is called in the event collector (v1 and the internal fallback) and the daily read, both to `run_logs`, so it shows on `/admin/runs`. "Get today's details" (`lib/lookup.ts`) writes it to the console, like that file's other lines.
- **Statement card.** `allianceStatement` (`lib/queries/statement.ts`) returns `members` as at most `capacity`.
- **Docs.** New decision D138 and its README line. Dated amendments to D72, D117 and D128 that say the 101 was a tracker artefact.
- **Tests.**
  - `lib/daily-read.test.ts`, two new tests on invented bodies. A 101/100 body with one unranked member reads as 100 in the row's `member_count`, the Members tab's read, the squads queue and the statement card, with one log line `{ union_id, members: 101, capacity: 100, unranked: 1 }`. A 65/100 body with 3 unranked members keeps all 65 everywhere, with no line. A 120/120 body reads as 120 everywhere, with no line.
  - `lib/sources/v1.test.ts`: the recorded 101/100 body now leaves its unranked member out and keeps `raw` as sent. The every-fixture test checks `listed` and the kills sum over the members kept.

## Decisions

- D138 (new). D137 is taken by open PR 517, so this note is D138.
- "Unranked" means `rank_code` sent as null and `rank_label` empty or missing. A body with no rank fields (bodies from before 2026-11-16, the internal source) never counts as unranked, so those reads are unchanged.
- `raw_json` keeps the body as sent, and the read models filter by `member_uids`. I chose this over editing `raw` so the stored body stays the upstream's record, and the existing test that `raw` equals the body still holds.
- Unranked members are dropped only over capacity, and the line is written only over capacity (orchestrator, 2026-11-20, on D75). Under capacity they are most likely new members the game has not ranked yet. The first build dropped them at any count; this was changed before the PR.
- Over capacity with no unranked member: the read is kept whole and the line is written (`unranked: 0`). Nothing tells which member is the extra one, so none is dropped.
- `memberCount` subtracts only the members left out. It does not take `min(member_count, members)`, so a body with no unranked member keeps its `member_count` exactly as before.

## Deviations

- No e2e run or screenshots. Nothing on screen changes except that the statement card's count is capped, and the D128 copy is unchanged. The new tests cover the card's number through `allianceStatement`.

## Verified

- `pnpm check`: exit 0. That is Prettier, ESLint, tsc, Vitest (264 files passed, 2 skipped; 1,383 tests passed, 4 skipped), after the rebase. Before it, one run had a SIGSEGV worker crash in `lib/queries/turnout.test.ts`, which passed alone and on the rerun, drift and i18n.
- With the filter in `toSnapshotInput` removed, the 101/100 test fails (`memberCount` 101). With the filter back, it passes.
- All 27 recorded `/v1` alliance bodies have `member_count` equal to the length of `members`. Three bodies, all from the 2026-11-16 recording, have unranked members: 67111155 (101/100, 1 unranked), 67111128 (65/100, 3) and 67111040 (62/100, 6). The unranked ones in the last two are level 6–10.
- No upstream calls. The test bodies are invented: "Member 1"… and alliance "INV".

## Open issues

- The issue's wording ("more members than capacity, or a member has an empty rank") read as dropping unranked members at any count. The orchestrator narrowed it to over capacity only; the owner may want to confirm. In the 2026-11-16 recording, 3 of 65 and 6 of 62 unranked members (level 6–10) are therefore kept.
- The D132 queue adds new members from an answer's `alliance_members`, which has uids only, no rank. A tracker artefact there would still be queued. Follow-up if it is ever seen.
- Readings stored before this change (the 2026-11-16 OGs rosters, if any were stored from that body) keep 101 in `member_count` and `member_uids`. No backfill was done.
- Event snapshot pages and other public counts read `alliance_snapshots.member_count`. Those now get the ranked count from new reads; old rows are unchanged.
- `lib/workspace-features.ts` and `lib/private/member-week.ts` comments still say "101 members". They are comments on measurements; not changed.

## Next

- Model/effort: keep. The fix was one boundary function, one read model, one query and one log line, built in one round.
- What the owner must do first: merge. No migration and no environment change.
- Plan change: none. This work runs from issue 481, not from a `docs/SESSION_PLAYBOOK.md` prompt.

<adjustments>
- `AllianceSnapshotInput.members` is the ranked members only. Use `listed` for how many the body listed. Code that needs every listed member must read `raw_json` itself and must not count those members.
- A read model of `raw_json`'s members must keep only the row's `member_uids`, as `endOfDayReads` does.
- `roster.over_capacity` is a new `run_logs` code (counts only), written only when a body lists more than `capacity`. Unranked members under capacity are kept as members. The D135 status bar and `/admin` do not show it on its own; `/admin/runs` lists it with the other lines.
- Use the body's `capacity`, never 100. Some older servers allow 120.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/520
