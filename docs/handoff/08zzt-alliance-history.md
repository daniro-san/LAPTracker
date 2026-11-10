# 08zzt — Daily roster read and member history (#197, option C)

Owner, 2026-11-10, on spike 08zzr (PR #203): "lets go with the option C, you can do it now already, if possible have a button where we can copy just the data to a spreadsheet as well, like names, might and kill".

## Built
- **Migration 0012** (`drizzle/0012_young_mephisto.sql`) adds two tables (`lib/schema.ts`):
  - `daily_reads`: one row per server day (`day` primary key, status, `calls_used`, `quota_remaining_before`, error).
  - `daily_rosters`: one row per alliance and day, with the members as four arrays (`member_uids`, `member_names`, `member_power`, `member_kills`) and no `raw_json`. Unique `(read_day, union_id)`, index on `union_id`.
- **`lib/daily-read.ts` `runDailyRead`.** Steps:
  1. Claims the day.
  2. Makes one `/v1/quota` call and continues only if `remaining ≥ dailyReadQuota(k, 20)`.
  3. Reads the rosters, 4 at a time, through the existing v1 adapter. A failed alliance gets an error row.
  4. Closes the day as `complete`, `partial` or `failed`.

  Bounds as for snapshots: `MAX_UPSTREAM_CALLS`, the 100 s deadline, a 429 stops the read. No internal fallback.
- `lib/repo/daily-reads.ts` (claim, insert, finish); `lib/budget.ts` `dailyReadQuota`; `config/alliances.ts` `DAILY_ROSTER_IDS` (every tracked alliance).
- `lib/env.ts` `DAILY_ROSTER_AT` (default `06:00` server); `lib/schedule.ts` `dailyReadDue`.
- **`lib/tick.ts`:**
  - Step (5), last: the daily read, inside `[DAILY_ROSTER_AT, + SNAPSHOT_WINDOW_MIN)`.
  - No read on a scheduled event's day (owner, 2026-11-10): `hasScheduledEvent` in `lib/repo/events.ts` finds a non-manual, non-test event whose Before falls on that server day. The event's snapshots cover that day in the history.
  - One admin Discord line when the read is not `complete` (`dailyReadMessage`, `copy.discord.admin.dailyRead`).
  - `/api/tick` answers `{action: "daily-read", day, status, calls_used}`.
- **`lib/queries/member-history.ts` `memberHistory(db, unionId, { before, limit = 14 })`:**
  - It merges usable daily rosters with usable public event rosters (fresh, no error, not empty), newest first.
  - Each card is diffed against the next older usable roster with `compute.rosterDiff`: joined, left, renamed, and the members whose kills or might changed (most kills gained first).
  - Leavers get `nowIn` when their newest sighting is in another alliance.
- **Page `/alliances/[unionId]/history`** (`app/(pages)/alliances/[unionId]/history/page.tsx`):
  - breadcrumbs, the alliance head, Exact numbers;
  - the filter links All · Joined · Left · Renamed · Kills (`?show=`);
  - the cards (`app/_ui/MemberHistory.tsx`);
  - "Older ↓" / "↑ Newest" (`?before=<ISO time>`);
  - a 404 for an id with no usable roster or a malformed id or cursor.
- **"Copy for spreadsheet"** on every card (`app/_ui/CopyRoster.tsx`). It copies the card's whole roster as tab-separated rows: a header row (Name, Might, Kills in the page's language), then one row per member by might, with plain integers. A name starting with `= + - @` gets a leading `'`. The button says "Copied" or "Copy failed" for 2.5 s.
- "Member history →" link in the alliance page's title row.
- Copy: 16 `history.*` keys in `lib/copy.ts` and 17 languages (translate-copy skill, stamped), glossary rows added by the translators.
- Docs: D60 in DECISIONS.md; GLOSSARY ("daily read", "member history"); DESIGN.md (Navigation line, `member-history` component); ARCHITECTURE.md (`lib/daily-read.ts`, tick step); `.env.example` `DAILY_ROSTER_AT`.
- Tests:
  - `lib/daily-read.test.ts`, 2 tests: a quota below the reserve makes no roster call; a failed alliance gives an error row, a partial read, and the day is read once.
  - `app/api/tick/route.test.ts`, 1 test: the read runs once on Friday 2026-11-06 (06:05 and 06:20 server) and not on Saturday 2026-11-07, the scheduled event's day; it creates no event of its own.
  - `lib/queries/member-history.test.ts`, 2 tests: joined, left with `nowIn`, renamed and changed, with a stale roster skipped; paging, and null for an unknown alliance.
- Screenshots: `docs/screenshots/08zzt-alliance-history-{360,1280}-{light,dark}.png`, `08zzt-alliance-history-360-light-left.png` (the Left filter), `08zzt-alliance-link-360.png` (the link on the alliance page).

## Decisions
- **14 cards per page, not the spike's 30.** Each card carries its roster's spreadsheet text (≈ 3.5 KB per 100 members) for the copy button. 14 cards are ≈ 50 KB, 30 would be ≈ 105 KB on a phone.
- **The read runs inside a window**, `[06:00, 06:45)` server time, like the Friday check (`inWindow`). The ticks at :07, :22 and :37 give it three chances. A day with no tick in the window has no read; it is a gap, not a late read in the afternoon.
- **Arrays are read as `text[]`.** Drizzle maps a null `bigint[]` element to 0 (`PgArray.mapFromDriverValue` → `Number(null)`). `memberHistory` therefore selects `member_power` and `member_kills` as `::text[]` and converts them itself, so a null stays null (D15). Writes keep nulls (`mapToDriverValue` passes null through).
- **"now in [TAG]"** uses the member's newest sighting in any stored roster (daily or public event). It is shown only when that sighting is in another alliance. It is read from public rosters only, never from `joined_at`.
- **Event cards are named** by the event's label (D49) and the capture-window words Start / End (`copy.status.start/end`), so no new phase words were needed.
- **Cards list only members whose kills or might changed**, the first 10, then "Show all (n)" (a `<details>`, no JavaScript). The full roster goes only into the spreadsheet copy.
- **No avatars on the cards**: names only, to keep 14 cards light. Names link to the player page.

## Deviations
- **No build issue was opened.** The owner asked for the build in the same conversation. The PR body says `Closes #197`; PRs into `dev` do not auto-close issues, so close it by hand.
- **This branch is cut from `dev` without the spike.** The spike handoff `docs/handoff/08zzr-spike-alliance-history.md` is in PR #203, still open. D60 points to it. Merge #203 too, in either order: the two PRs touch no common file.
- **The spike prompt's filter links and cursor:** `?before=` takes an ISO time, not a day. Daily and event rosters share one timeline, and two can fall on one day.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (51 files, 233 tests passed, 1 skipped), drift (12 tables, no changes), i18n (17 languages up to date).
- **Local stack** (throwaway, in the scratchpad):
  - Postgres 18 with `drizzle/0000`–`0012` applied by psql, behind a WebSocket→TCP bridge, plus a preload that sends the Neon driver's WebSocket to the bridge.
  - Data: `scripts/seed.ts`, then hand-written SQL rows: three daily reads after the Oct 31 seed event. Nov 1 has kills and might moves; Nov 2 has one leaver who appears in URSA, one newcomer and one rename; Nov 3 is stale.
  - `next dev` ran under `env -i` with placeholder variables and `LAP_API_BASE_URL`/`LAP_SITE_BASE_URL` on `127.0.0.1:9`, so no upstream call was possible. That is also why the badges show a broken image in the screenshots.
  - No Neon database was written. Session branches do not deploy (`vercel.json`), so the preview DB gets 0012 only on the `dev` deploy.
- **Playwright with system Chrome:**
  - `document.documentElement.scrollWidth` is 360 at 360 px and 1280 at 1280 px, light and dark.
  - The Nov 3 stale read is skipped, and the Nov 2 card reads "since Nov 1, 06:00 server time".
  - "Copy for spreadsheet" with clipboard permission granted: the button reads "Copied" and the clipboard holds 101 lines. The header is `Name\tMight\tKills`, then e.g. `Sashalom\t162567834\t1942393`, 3 fields per row.
  - `?show=left`: 1 card, with "now in [URSA]".
  - The alliance page has the "Member history" link.
  - `/alliances/99/history`, `/alliances/abc/history` and `?before=nope` answer 404.
- No upstream call, no `/api/quota`, no `/api/tick` against a deployment.

## Open issues
- **First real read:** the release that carries migration 0012 must reach production first. The first read comes at the next 06:00 server tick after that.
- **The clipboard was tested in Chrome only.** Safari needs the write inside the click's user activation. The button calls `writeText` one microtask after the click, which Safari allows today; this was not tested on an iPhone.
- **/admin does not show daily reads.** Their outcome is in `daily_reads`, in `tick_log.outcome` and, when short, in one admin Discord line. An /admin row could come later if wanted.
- **Rank changes (`rank_code`) are not stored** in daily rosters. They would show promotions; the owner did not ask for them.
- **The French translation of `history.first`** uses a full stop instead of ` :`. The translator could not type the non-breaking space; it reads correctly.
- If 08zzh's build (#183) lands, its budget rule should count the daily read's `1 + k` calls on Saturdays (spike 08zzr `<adjustments for="08zzh build">`).

## Next
Session: none queued by this work. The playbook has no session after v1 ("After v1"); the open work in flight is 08zzh (#183, event model).
Model / effort: keep (opus · high) for 08zzh's build, which touches the same `lib/tick.ts` and `lib/budget.ts`.
Owner must do first:
1. Merge #203 (spike) and this PR into `dev`.
2. Release as usual, so migration 0012 reaches production.
3. Close #197 by hand.
4. Optional: set `DAILY_ROSTER_AT` in Vercel if 06:00 server is not wanted, or change `DAILY_ROSTER_IDS` to `[67111155]` for OGs only.
Plan changes needed: IMPLEMENTATION_PLAN.md §"Not in v1" or the After-v1 list — record "member history (daily roster read)" as shipped (owner's call; no edit made here).

<adjustments for="08zzh build (#171/#175/#176)">
- The tick now ends with step (5), the daily roster read (`dailyRead` in `lib/tick.ts`), run only when nothing else is due. If more than one sample per tick is introduced, keep the daily read last.
- `dailyReadQuota(k, 20)` = `requiredQuota(k) + requiredQuota(20)` guards the daily read. It does not run on a scheduled event's day (`hasScheduledEvent`, a non-manual event whose Before is that server day), so a KvK Saturday spends nothing on it. If event schedules move to /admin, keep creating the event's row a day ahead, or the check misses it.
- `daily_rosters` uses the array layout 08zzh proposes for light samples. When reading `bigint[]` columns with nulls, select them as `::text[]`: Drizzle turns a null element into 0.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/206
