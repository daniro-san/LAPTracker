# feat: desk recruit check (issue 833)

## Built

- Switch `recruit_check` in `FEATURE_GROUPS.data` (`lib/workspace-features.ts`), as a plain D126 switch: dev has no `PLAN_FEATURES`.
  - `TRACKER_CALLS.recruit_check = { perMember: 0, weekly: false, perDay: 20 }`. `trackerEstimate`, the Alliance settings card (`lib/private/alliance-features.ts`) and /admin's calls help add `perDay`. So the estimate counts the full 20 a day while the switch is on.
  - It is in `TRACKER_CALLS`, so it starts off for a new alliance and waits for its officers (D134). OGs has it on.
  - The switch is named in the admin copy and in `dictionary.switches.ts` (EN, PT-BR, FR).
  - `RECRUIT_READS_A_DAY` = 20.
- Table `recruit_reads` (`lib/schema-features.ts`), migration `drizzle/0090_recruit_reads.sql`. It has one row per workspace per UTC day: `workspace_id`, `day`, `used`.
  - `countRecruitRead` (`lib/repo/recruit-reads.ts`) is one `insert … on conflict do update … where used < cap` statement, so the 21st read is refused in the database.
  - The table is in `WORKSPACE_TABLES` (`file: null`, scope workspace), like `workspace_usage`.
- `ownKeyOf` (`lib/workspace-keys.ts`) opens the workspace's own saved key, only when it reads now. It never returns `LAP_API_KEY` or another workspace's key.
- `playerTrail` and `trailNames` (`lib/repo/player-reads.ts`) read one player's own-alliance `player_history` and `player_reads` columns, and search names in the history rows. They never read raw_json.
- `lib/private/recruit-check.ts`:
  - `recruitFacts` merges public `playerProgress` readings (daily rosters and public events) with the workspace's own trail. From these it gives: the newest name, the alliance and the time; alliance moves and name changes between consecutive sightings; might and kills as the first and newest value of the last 30 days; and the events seen.
  - `recruitMatches`: a name goes through the public `searchPlayers` and then the own history names of the last 90 days (`TRAIL_NAME_DAYS`, D149), at most 10 matches.
  - `recruitBudget`: whether an own key reads now, and how many reads are left today.
  - `readRecruit` takes these steps in order:
    1. Checks the switch.
    2. Returns without a call when the player is already stored.
    3. Gets the own key.
    4. Counts the read.
    5. Sends one `fetchPlayer` with `{ apiKey, maxRetries: 0 }`.
    6. Keeps the answer with `storePlayerRead` under `access.unionId`.

    A 404 (`NotFoundError`) answers `not_found`. A 401 or 429 marks the key (`invalid`, `out_of_quota`). Log lines carry the workspace id and counts only.
- Export: `player-reads.csv` leaves `map_updated_at`, `shielding` and `shield_type` empty on rows of a player no daily roster of the alliance ever listed (`membersOnly` in `WORKSPACE_TABLES`, D163). `last_seen_at` was already never downloaded.
- `POST /api/w/[slug]/recruit-check` `{uid}`. Answers:
  - 200 `{called}`
  - 401 `signed_out` (also for a member's session)
  - 403 `turned_off`
  - 409 `no_key`
  - 429 `cap_reached`
  - 404 `not_found`
  - 502 `unavailable`
- Page `/w/[slug]/recruit?q=`, a view of Members:
  - It has a search form and a match list, linked by uid. It shows the facts, or for an unstored ID the "Read from the tracker" button (`app/(private)/_ui/RecruitRead.tsx`) with "n of 20 left today". When no read can be made, a line says why: no own key, or today's reads are used.
  - It goes through `openRollCall(..., "recruit_check")`. When the switch is off, it redirects to Home.
- Nav: the view `recruit` is in `DeskNav` (rail and sidebar) and in the phone switch `ViewSwitch`. `ViewSwitch` now takes the served feature set `on` instead of an `insights` boolean, and the insights page and `MembersHead` pass `access.features.on`.
- Copy: `lib/private/dictionary.recruit.ts` (EN, PT-BR, FR), spread into the three workspace dictionaries.
- Decision: a dated amendment to D124 (2026-11-28) records the 20 a day budget, the own-key rule, storage, the switch and privacy.
- Tests (`app/(private)/api/w/[slug]/recruit-check/route.test.ts`, 10 tests):
  - a 404 answers `not_found` and keeps nothing;
  - a 401 marks the key `invalid`, and a 429 marks it `out_of_quota`; after either, the next press sends nothing (409);
  - a stored player is shown without a call;
  - an unstored player gets one call on the workspace key and is kept under its alliance, and the next lookup makes no call;
  - the 21st read of the day is refused;
  - a member's session is refused;
  - the route is refused while the switch is off;
  - another workspace's key is never used (only the other workspace has a key, so the answer is 409 and no call is made);
  - the facts have no blocked keys.

  More test changes:
  - The page with the switch off is added to `app/(private)/w/[slug]/turned-off.test.ts`.
  - The estimate gets one line in `lib/private/features.test.ts`.
  - The route gets a fixture in `member-session.test.ts`.
  - The admin copy test's `allianceOff` now includes `recruit_check`.
  - The purge seed has a `recruit_reads` row.
  - `lib/repo/player-reads.test.ts`: the name search reads 90 days only; the download keeps a member's shield and map times and leaves a non-member's empty.
  - `playerFailure(status)` in `lib/squads.test-helpers.ts` builds the error `fetchPlayer` throws for a status, because app/ tests may not import `lib/sources`.

## Decisions

- **The own saved key only, even for OGs.** The task says "on the alliance's own key, never LAP_API_KEY for another workspace". I read that as: new reads go only on a saved key that reads now (`squadsKey` "own"). The own alliance without a saved key does not fall back to `LAP_API_KEY`. That keeps the recruit check out of the event reserve that the squads read keeps on our key. Without such a key, the page shows the stored facts and says a key is needed.
- **A read is counted when it is sent, whatever the answer** (404 and 5xx included). Each sent call spends tracker quota. Nothing is given back.
- **Stored means any row in our stores:** a daily roster, a public event roster, or this workspace's own player read or history row. A stored player is never read again by this tool. There is no "refresh".
- **Squads in the answer are not stored.** The player is not a member, and `storeSquads` would show them as a member's squads. The player read and its history rows are kept (D132).
- **Moves and renames use every stored sighting. Might and kills use the last 30 days.** Events seen lists every public event the player was in, newest first.
- **A union id of 0 or null says nothing about the alliance**, so it is left out of moves (D75). A missing tag falls back to the alliance's newest label, then to "alliance {id}".
- **The new read is a button (POST), not part of the GET page**, so opening or reloading a link never spends quota.

## Deviations

- None from the task. The issue's "PLAN_FEATURES only if it exists" did not apply.

## Verified

- `pnpm typecheck`: clean.
- `pnpm vitest related --run <changed files>`: 234 files and 1380 tests passed, after the fixture, admin test and seed fixes.
- `pnpm check`: the first two rounds failed: lint (import order, restricted imports in the route test, two functions over 80 lines), then the purge test, which needs a `recruit_reads` seed row. The seed row first pushed `seedKeyAndData` to 81 lines. With the orchestrator's go-ahead for a third round, the row moved into its own helper `seedRecruitReads` (`lib/workspace-seed-parts.test-helpers.ts`), which `seedEverything` calls. The third run passed.
- After the review of PR 852 (the 404 error class, the 90-day name window, the export of non-members' shield and map times): `pnpm vitest related --run` and `pnpm check`; the results are in the commit report.
- The name window has no index of its own: `player_history`'s key starts with `union_id`, so the query still walks that alliance's history rows and filters them by `t`. An index `(union_id, t)` would bound the walk too. It is not added here.
- Not run: the page in a browser at 360 / 640 / 1280 px. No dev server was started in this session.

## Open issues

- The UX review before the owner (360, 640, 1280, dark) is still to do.
- The name search covers public event names and this workspace's own history names. It does not search names in daily rosters.

## Next

- The orchestrator pushes the review fixes to PR 852.
- Decide whether the name search needs a `player_history (union_id, t)` index once the table is measured.
- Follow-up idea, not built: allow a new read of a stored player whose newest sighting is old. The task did not ask for it.
- The owner decides whether OGs should also read on `LAP_API_KEY` when it has no saved key. Today it needs a saved key.

What was missing from the task prompt? Whether OGs, which reads squads on LAP_API_KEY without a saved key, may spend LAP_API_KEY here too; and whether "events seen" means every event or the last 30 days.

PR: (added by the orchestrator)
