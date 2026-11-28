# feat/792-open-seats

## Built
- "Alliances recruiting" on `/alliances` (issue 792), page 1 only, between the board's date and "Read every day". It shows only while the PostHog flag `alliances-recruiting` is on (D91). The key is added to `FLAGS` in `lib/flags.ts`. The flag does not exist in PostHog yet, so the section is off until the owner creates it and turns it on.
- `lib/queries/recruiting.ts` `recruitingAlliances(db, today)`: for each alliance, the newest `daily_rosters` row with no error and a kept response (`raw_json`) whose `read_day` is on or after `today − RECRUITING_DAYS` (2). The daily read and "Get today's details" (D133) both write these rows. It picks `join.auto`, `join.power`, `join.castle_level`, `member_count` and `capacity` out of `raw_json` in SQL, plus the row's `tag`, `name` and `badge_id` columns. Spots free = capacity − members, with members capped at capacity (D138). Only rows with at least one spot free are kept. No upstream call, no new column, no migration.
- `lib/queries/statement.ts`: the parsing of the joining fields moved into `joiningColumns` and `joiningOf`, which `allianceStatement` (D128) and the new query both use. `allianceStatement` returns the same values as before.
- Shared cache (D143): `sharedRecruiting(today)` in `app/_ui/public-reads.ts`, entry `recruiting`, keyed by the server day. A new day gives a new key, so rows that went stale overnight are not served from the cache. The writes to `daily_rosters` already invalidate `reads`.
- `app/_ui/AlliancesRecruiting.tsx`: heading "Alliances recruiting (n)" and the line "Alliances with room right now, and what they ask to join." Then one row per alliance: its emblem and name, linking to the alliance's page (`allianceHref`: its page in the home event when it is there, else `/alliances/[id]/history`). Under the name: "27 spots free (73/100) · By application · Minimum might 8M · Minimum HQ 14", then "As of Nov 26" (the read's server day). A part the read lacks is left out. Below 640 px the row is stacked (name, then its line, then its date). From 640 px the details sit right of the name. The link is 44 px tall. Might is compact and rounded (`roundMinimum`, now exported from `AllianceStatement.tsx`). With no rows: "No alliance read in the last 2 days has a spot free."
- Copy: `lib/copy-alliances.ts` has 7 new keys (`recruiting`, `recruitingLead`, `recruitingNone`, `spotsFree`, `spotFree`, `minMight`, `minHq`). They are translated into the 17 other public languages with translate-copy and stamped.
- Tests: `lib/queries/recruiting.test.ts` (spots free computed and sorted, full alliance left out; reads older than 2 days hidden; no blocked roster key and no member in the result) and `app/_ui/AlliancesRecruiting.test.ts` (each row links to the alliance page and shows its parts and date; flag off draws nothing).

## Decisions
- Sort: most spots free first, then the lowest minimum might, then by id. Persona check (below).
- "Older than 2 days": a read dated `today − 2` (server days) is still shown; `today − 3` is hidden.
- Names (coordinator, from the owner, 2026-11-28): the heading is "Alliances recruiting", the line under it is the owner's sentence, and rows say "spots free". The flag is `alliances-recruiting`, in kebab case like every other key in `FLAGS`. The coordinator gave `alliances_recruiting` as an example. Internal names: `recruitingAlliances`, `RecruitingRow`, `RECRUITING_DAYS`, `spotsFree`, `sharedRecruiting`, `AlliancesRecruiting`, and the anchor `#recruiting`. The branch keeps the name it was briefed with.
- Plain words on the rows: "Minimum might 8M" and "Minimum HQ 14" replace the statement card's "8M+ might" and "HQ 14+" in this list only. The alliance page's card (D128) is unchanged. "Open to join" and "By application" are reused from `copy.statement`.
- Empty state: one muted line under the heading, not the page-level Granny Doctor (`EmptyState`), because the section is one of three on the page.
- Translations: the first round was for the old "Open seats" strings and was thrown away (`git checkout -- lib/i18n`) when the rename came in. Then the new keys were translated. Spot-check fixes: de heading "Allianzen werben" changed to "Allianzen suchen Mitglieder" (the first reads as "alliances advertise"); uk "{days} днів" changed to "{days} дні" (2 takes дні).

### Persona check (short, inline)
- Player who has never heard "open seats" or "recruiting" (first sight): "Alliances recruiting" plus the line "Alliances with room right now, and what they ask to join" tells them these alliances take new members and what they need. "27 spots free (73/100)" is read as places, not as the alliance's own numbers, because "free" and the members/capacity pair sit beside it. The earlier "Open seats" did not pass this test (the owner, a player, did not get it at first).
- Player looking for an alliance: wants to know if they can get in now. Most spots first gives the best chance that a spot is still there when they apply. "Minimum might" and "Minimum HQ" say what to check against their own profile. The date says how old the count is.
- Recruiter (officer who recruits for their alliance): their alliance shows up only when it was read in the last 2 days. The rows are tracked alliances and today's lookups, so an alliance outside the tracked set can appear by pressing "Get today's details" on its page. Noted under Open issues.
- R5 of an alliance with spots free: the facts are already public on the alliance page (D128). The wording is neutral ("recruiting", "spots free"), not "missing members", so it does not read as a weakness (D75, people first).
- Designer: one heading with a count, one short line, rows in the same pattern as the board's rows below it, and no hover-only part. The details line wraps only between parts (each part `whitespace-nowrap`). Placed first on page 1 because it answers a player's question; the board follows.

## Deviations
- The brief listed "seats open" as a column; the owner's rename made it "spots free". Placement above the tracked list was my choice; the issue does not say where on `/alliances` it goes.

## Verified
- `pnpm vitest related --run` on the changed files: 182 files, 1053 tests passed (run before and after the rename).
- `pnpm check`: passed (prettier, eslint, tsc, vitest 392 files / 2123 tests, schema drift, i18n: 17 languages up to date). No test timed out under load.
- Not done: a look at 360/640/1280 px in a browser. No local database with real reads is set up in this worktree, and the section is behind a flag that is off.

## Open issues
- The list covers only alliances the tracker reads: the day's tracked set (`TRACKED_COUNT`) and "Get today's details" lookups. An alliance outside them with spots free is not listed. The line under the heading does not say so, because the owner fixed its text.
- The PostHog flag `alliances-recruiting` must be created (off) and turned on by the owner.

## Next
- Owner: create the flag `alliances-recruiting` in PostHog project 741657 and turn it on when ready.
- Follow-up to consider: a UX review at 360/640/1280 and dark with real data before the flag goes on (memory rule for visual PRs).

What was missing from the task prompt? Where on /alliances the section goes, and whether "older than 2 days" counts the day of the read; both are assumptions above.

PR: (added by the orchestrator)
