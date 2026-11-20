# feat-459 — Every alliance from the ranks board, a daily top 20, and "Get today's details"

Issue #459. Decision: [D133](../decisions/D133-every-alliance-from-the-ranks-board-and-a-daily-top-20.md). It supersedes D4's fixed list and amends D60, D72, D124 and D130 (dated amendments appended to each).

## Built

- **No fixed list.** `config/alliances.ts` keeps `SERVER` and `OWN_ALLIANCE_ID`, and adds `TRACKED_COUNT` (20) and `LOOKUPS_PER_DAY` (30). `ALLIANCES` and `DAILY_ROSTER_IDS` are gone. All 40 call sites now read the database.
- **Ranks board each server day** (`lib/tracked.ts`):
  - The tick reads the board before the daily read and stores it (`alliance_board`, `alliances`).
  - Its top 20 by might becomes the day's set (`tracked_sets`). The insert is the claim.
  - The first caller posts one admin Discord line when alliances came in or went out. A board that cannot be read keeps the newest set and posts a line saying so.
- **Parser.** `lib/sources/internal.ts` `fetchRanks` also reads each row's `abbr`, `name` and `badge_id` (optional). It calls the same endpoint as before.
- **Daily read** (`dayTargets`, `dailyTargets`):
  - It reads the tracked set on our key, plus every workspace's alliance outside the set: on its own key when it saved a usable one, on ours when it saved none, and not at all when its saved key cannot be used.
  - The quota rule counts only the reads on our key.
  - A workspace key's 401 or 429 marks that key and fails only that alliance.
  - /admin's Retry reads the same targets.
- **Events.** The Before copies the newest set onto `events.alliance_ids`. With no set and no event yet, it takes the board's top 20 (`lib/collector-ids.ts`).
- **"Get today's details"** (`lib/lookup.ts`, `POST /api/alliances/[unionId]/details`):
  - One claim row per alliance and server day, taken under a per-day advisory lock, with a cap of 30 a day.
  - Refused with no call during the event window and for alliances the daily read covers.
  - One `/quota` call, then the read only if D117's reserve (`squadsReserve`) survives it. The read asks for the tracker's cached copy (`CallOptions.fresh: false`) and is never retried.
  - The roster is stored as that day's daily roster, with a 60-minute freshness rule.
  - Same-origin JSON only. 5 presses per address in 15 minutes.
- **Public pages:**
  - `/alliances` lists the tracked set first, then the others 25 a page. The ledger links to it under its table.
  - `/alliances/[id]/history` opens for every alliance on the board. It shows the board line with its date, "Read every day" for a covered alliance, the details box for the others, the statement after a lookup, and "No member list for this alliance yet."
- **/admin** has a new "Tracked alliances" card: the newest set, the last 7 days' changes, and today's lookups with their calls.
- **Labels.** Workspaces, invites and "Request an Officers' Desk" accept any alliance we know. `WorkspaceAccess.alliance` and `BoardAccess.alliance` carry the label, and the desk header, thefts, import and analytics use it.
- **Copy.** `lib/copy-alliances.ts` holds the public words, translated into all 17 languages and stamped. `lib/copy-admin-tracked.ts` and the Discord lines are English only.
- **Migration** `0054_all_alliances`: four tables, and `daily_rosters.read_day` loses its foreign key to `daily_reads`. A lookup's day may have no daily read yet.
- **Tests (11 new):**
  - `lib/tracked.test.ts` (3): the board once a day with who came in and went out; a failed board keeps the set; the daily targets and keys.
  - `lib/lookup.test.ts` (3): two presses make one cached read stored as the day's roster; the refusals with no call; the reserve refusal keeps the claim.
  - `app/api/alliances/[unionId]/details/route.test.ts` (1): same origin, and the per-address limit.
  - `lib/queries/alliance-list.test.ts` (1): tracked first, then the pages.
  - The board labels are asserted in `internal.test.ts`.
  - Existing tests now use 20 invented ids (`IDS`) and a fake board. The test database starts with the fixture board's labels (`openTestDb`).

## Decisions

- **Lookups go in `daily_rosters`.** The owner said "stored like a daily roster". This gives the history, the statement and player progress for free. The cost is dropping the `read_day` foreign key, and the daily read now judges its outcome on its own targets only.
- **A lookup costs at most 2 calls.** It makes a `/quota` call first because the reserve rule needs the current `remaining`. Neither call is retried, so 30 lookups mean at most 60 calls a day.
- **A refusal after the claim keeps the claim for the day.** This covers the quota rule and a failed read. "Once per alliance per day" is read strictly, so a flaky upstream cannot be pressed into extra calls.
- **The lookup's freshness is 60 minutes**, the tracker's cache life (D64), instead of 20. Its copy is cached on purpose, and with 20 minutes most lookups would be hidden from the history.
- **Balance and standing** count each day's own tracked set. A day before the first set counts the newest event's list. Otherwise rotating alliances and lookups would break the "complete day" trend.
- **Before the first set**, `trackedAllianceIds` falls back to the newest event's list, then to the alliances of the newest daily read.
- **Persona panel** (a player from another alliance, an R5, a data analyst, product strategy): **SHIP WITH FIXES**.
  - Applied:
    - "next update tomorrow" became "anyone can get them again tomorrow", since nothing updates by itself;
    - the board line on the alliance page now carries its date;
    - "Once a day for everyone." became "One lookup a day, shared with everyone.";
    - a "Read every day" line on covered alliances;
    - "Open one to see or get today's details".
  - Declined:
    - Renaming the last breadcrumb: "Member history" names the page.
    - A time on the failed line: the failed state is rare, and the decision keeps the claim on purpose.

## Deviations

- Issue #459's plan items left out:
  - the configurable "extra N" untracked alliances in the daily read (default 0, and the owner's lookup button replaces it);
  - the optional /admin pin or unpin.
- "Once a day for everyone" was made explicit as "One lookup a day, shared with everyone." D133 records it.
- The admin "Tracked alliances" card was not screenshotted, because the e2e had no admin session. It is covered by typecheck and lint only.
- The ledger's "All N alliances" link was not screenshotted, because the e2e seed had no event. Lookups during the event window were not pressed live; the unit test covers them.

## Verified

- `pnpm check` passes after the rebase onto `origin/dev` (#502–#506): prettier, eslint, tsc, vitest (1310 passed, 4 skipped, 248 files), drift, and i18n (17 languages up to date).
- **Rebase.** The decision was renumbered D131 → D133, because D131 (sign-in chooser) and D132 (squads queue) landed first. The migration was regenerated as `0054_all_alliances`, after D132's `0053_squads_queue_player_reads`, with the same SQL as before. Two things from dev that still read the old list now use the board's labels: D131's chooser (`allianceOf(db, …)`) and the "Desk made" admin line (`deskMadeMessage` takes the label from the invite step).
- **Squads (D132).** The queue's alliances are `squadTargets`, the workspaces, and each is in the daily read every day, so the queue always has the day's roster. A lookup queues nothing and writes no `player_reads` row, because a workspace's alliance is never looked up. `squadsReserve` uses `TRACKED_COUNT`. Squads targets carry the alliance's label, so analytics `alliance` stays set.
- **Local production build** (`next build` and `next start`), on a private Postgres 18 cluster in the scratchpad with the 54 migrations of the pre-rebase base and the WebSocket bridge. The API and site base URLs pointed at 127.0.0.1:9, so no upstream call was possible. No real quota was spent anywhere in this work.
- **Seed** (invented): a board of 48 invented alliances on two days with one swap at #20/#21, two tracked sets, two days of rosters for 21 alliances with invented member names, and one lookup done today with a statement.
- **Live press** on an alliance with no lookup: the route answered 409 `failed` (the upstream was unreachable), the page showed "Today's lookup didn't work. Try again tomorrow.", and a reload kept that state (the claim held).
- **Screenshots:** 7 pages × 360/768/1280 × light/dark × EN/PT-BR, 75 PNGs in the scratchpad (`e2e/shots-final`). 0 horizontal overflow. 0 visible links or buttons under 44 px in `main`. The unknown id is a 404.
- The diff contains no names from the fixture rosters. Test and seed names are invented. The only real alliance id used in a test is OGs, in `internal.test.ts` against the existing fixture.

## Open issues

- A roster from a lookup shows as "Daily update" in the history cards. A separate label ("Lookup") would need a column or a join on `alliance_lookups`.
- When a lookup alliance enters the top 20 the same day, the night's daily read replaces its roster with a fresh one (upsert). This is intended, but the lookup row still says "done".
- Analytics `alliance` is null for an event whose alliance has no label yet: none before the first board read for an alliance with no daily roster.
- The e2e and screenshots ran before the rebase. The rebase changed no page or route of this feature.
- `lib/copy.ts` and `lib/copy-admin.ts` are at the 300-line limit. `copy.alliances` comes through `lib/copy-statement.ts`, and `copy.admin` through `lib/copy-admin-tracked.ts`.
- On deploy day, /alliances shows its empty state until the 23:30 tick reads the first board. Labels fall back to daily rosters meanwhile, and the Before falls back to the newest event's list.
- `lib/i18n/glossary/sv.md` and `uk.md` repeat their table, as before. The translators added rows to the last copy.

## Next

- Model/effort: keep. This was a wide refactor (40 call sites), but each step was mechanical once the tables existed.
- Owner first: nothing to set up. After deploy, check the 23:37 server time tick: the admin channel gets the change line only if the top 20 differs from the newest event's list. /admin → Tracked alliances shows the set, and /alliances fills.
- Plan change: docs/IMPLEMENTATION_PLAN.md §3.4 and the `config/alliances.ts` snippet describe the fixed list that D133 supersedes. Not edited here.

<adjustments>
- `config/alliances.ts` no longer exports `ALLIANCES` or `DAILY_ROSTER_IDS`. Use `trackedAllianceIds(db)`, `allianceLabels(db, ids)` or `access.alliance`.
- Tests: `IDS` in `lib/collector.test-helpers.ts` are invented (67120001…), with `BOARD_EXTRA` and `LABELS`. `openTestDb` seeds the fixture board's labels into `alliances`, and `truncateAll` keeps them.
- Lookup budget: at most 60 calls a day on our key, on top of about 21 for the daily read and about 100 for squads.
- The fixture board's top 20 equals D4's old list exactly. Checked: `fixtureBoard()` in `scripts/seed-data.ts`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/508
