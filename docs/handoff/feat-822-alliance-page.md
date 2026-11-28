# feat: the public alliance page /alliances/[unionId] (issue 822, part of 818)

## Built

- New page `app/(pages)/alliances/[unionId]/page.tsx`:
  - the head: emblem, `[TAG] Name`, and facts for server, leader (the R5, linked to the player page, with the leader's might), might, members out of capacity, and server rank from the ranks board with the board's date;
  - "Get today's details" for an alliance outside the daily read (D133, the same box the history page shows);
  - the statement and joining card (D128, `AllianceStatementCard` reused);
  - the growth card;
  - tabs Members (n) and History. History links to the existing `/alliances/[unionId]/history`.
  - A union id with no usable roster and on no ranks board is a 404. With a board row but no roster, the head shows the board's facts and the member list says "No member list for this alliance yet."
- Read model `lib/queries/alliance-page.ts` (`alliancePage`): the newest usable daily roster with its raw_json. From raw_json, only these keys are picked out, in SQL: `sid`, `capacity` and, per member, `uid`, `nick_name`, `power`, `rank_code`, `rank_label`, `active`, `daily_honor`, `daily_tech`. It also reads total might and member count per usable roster for the last 90 days (`GROWTH_DAYS`). Members are sorted by rank, then might, then name. Members past the capacity are not counted (issue 481).
- The page reads through the shared cache (D143): `sharedRead("alliance-page", [unionId, lookup])` holds the roster model and the board row, `sharedRead("statement", …)` holds the statement. "Get today's details" is read per view, as on the history page.
- Shared components for the player page (issue 824):
  - `app/_ui/DossierHead.tsx`: the picture, the title, the controls, and the facts band. A fact whose value is null is left out.
  - `app/_ui/GrowthCard.tsx` with `app/_ui/growth.ts`: one small `LineChart` per measure, stacked, all from the same daily points, so they share one time axis. There is no dual axis (D158). Range links 7d, 30d and 90d set `?range=`, with `scroll={false}`. Each chart has a change line (`+258.8M over 7 days`). It counts the real days between the range's first and last reading, and leaves the line out when the range has only one reading. The charts keep the existing readout (D158 rule 7 (a)).
- `app/_ui/AllianceDossier.tsx`: `allianceFacts`, `AllianceTabs`, `AllianceMembers` and `membersTsv`. Each member is a row in one card. A row shows the rank (`R4`), the role mark and title, the name linked to `/players/[uid]`, neutral chips for quest points, Help coins and tech donated, and might on the right. A null figure has no chip. A line above the list gives the read's date. Copy for spreadsheet (`CopyRoster`) copies rank, name, might, quest points, coins and tech.
- Links to the new page: rows on `/alliances` for alliances outside the home event (`allianceHref`, which linked to `/history` before), alliance names in the member flow (`FlowView`), and the history page's breadcrumb when the alliance is not in the home event.
- Copy: `lib/copy-alliance-page.ts` (`copy.alliancePage`), translated into all 17 public languages with the translate-copy skill, then stamped.
- Rules:
  - D76 has a dated amendment (owner, 2026-11-28) covering D163 as well.
  - CLAUDE.md's roster-fields rule and `.claude/rules/private.md` are updated.
  - `lib/queries/blocked-keys.ts`:
    - `BLOCKED_ROSTER_KEYS` is now `x`, `y`, `online`, `last_online_at`, `joined_at` and `avatar_url`.
    - New `ACTIVITY_KEYS` holds `daily_honor`, `daily_tech` and `active`.
    - New `UNLOGGED_ROSTER_KEYS` holds both lists. The redactor (`lib/redact.ts`), the workspace export's `NEVER` set (`lib/repo/workspace-data.ts`), the Discord body check in `lib/notify.test.ts` and the e2e `EXPORT_NEVER` now use it, so logs, Discord and exports behave as before.
- Tests:
  - `lib/queries/alliance-page.test.ts` has 6 tests: head facts, sorting by rank then might, an unknown figure left null, no blocked key or value, growth limited to 90 days, and null with no roster.
  - `app/_ui/growth.test.ts` has 4 tests: ranges and change lines.
  - `app/_ui/AllianceDossier.test.ts` has 3 tests: the head's facts, an unknown fact left out (never N/A), and an unknown chip left out.

## Decisions

- **The amendment is on D76 only.** D163 is not on `dev` yet (PR 819, `feat/d163-map-and-names`), so its file cannot be amended here. The D76 amendment says it also amends D163 point 2's "other public-page uses … stay as they are". When PR 819 merges, add a one-line amendment to D163 that points to D76's 2026-11-28 amendment.
- **The blocked list is split instead of shortened.** Taking the three activity keys out of `BLOCKED_ROSTER_KEYS` alone would also have let them into error text, Discord bodies and workspace exports. `UNLOGGED_ROSTER_KEYS` keeps those paths exactly as they were.
- **`last_seen_at` is not added to `BLOCKED_ROSTER_KEYS`.** It is a `/v1/players` key, not a roster key. The list's first test checks every key against a real roster fixture, and the new read model never reads `last_seen_at`.
- **Labels:**
  - `active` is labelled "Quest points" (GLOSSARY: daily quest points, a weekly running total), not "weekly activity". The line above the list says "quest points since Monday".
  - `daily_honor` is "Help coins". The line above the list names "Alliance Help coins" in full.
- **The default range is 30d.**
- **Members:** the head counts members from the roster row's `member_count`, capped at the capacity. The Members (n) tab counts the listed members.

## Deviations

- The task asked for "weekly activity" as the chip label. It reads "Quest points" instead, to use the glossary's term.
- Squads, VIP and X/Y are not shown, as the task says.

## Verified

- `pnpm vitest related --run` on the changed files: 252 files, 1458 tests passed (before the translations).
- `pnpm typecheck`: clean.
- `pnpm check`: green. 401 test files passed and 2 were skipped (2174 tests). Prettier, eslint, tsc, drift and i18n (17 languages up to date) all passed. The first two runs failed on import order, function complexity and length, and the D71 fence test (`lib/private/roster-fields.test.ts`). That test now allows `lib/queries/alliance-page.ts`.
- Not run: a browser check at 360, 640 and 1280 px, light and dark. This worktree has no local database seeded, and the designer-persona review is the orchestrator's step.

## Open issues

- A design persona panel and a UX review at 360, 640 and 1280 px, light and dark, have not been done. The orchestrator owes them before the merge.
- Translators kept "Quest points", "Help coins" and "tech" in English in some languages (for example pt-BR) because the glossary has no in-game word for them.
- No feature flag gates the page (the task did not ask for one). It is live as soon as this merges, and `/alliances` rows link to it.

## Next

- Issue 824 (the player page): reuse `DossierHead` and `GrowthCard`, with might and kills as the series.
- Link the event alliance page's title, `AllianceLinks` and the player page's alliance links to `/alliances/[unionId]`. Today they go to `/events/[id]/alliances/[unionId]`.
- `/alliances` rows of home-event alliances still open the event's alliance page. Decide whether every row should open the new page.
- The private thefts log (`app/(private)/_ui/theft-data.ts`) still links to `/history`.
- Joins and leaves tab (issue 818's reference): not in issue 822, so not built here.
- After PR 819 merges: add the D163 amendment line and reconcile CLAUDE.md and `.claude/rules/private.md`. Both PRs edit the same rule sentence and table row.

What was missing from the task prompt? D163 exists only on the unmerged PR 819, so "amend D163" could not be done on a branch cut from `dev`.

PR: (added by the orchestrator)
