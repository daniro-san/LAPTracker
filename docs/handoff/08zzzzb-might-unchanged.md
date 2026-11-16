# 08zzzzb — Might unchanged: an officer view (#273)

Closes #273.

## Built
- **Read model** `mightUnchanged(db, unionId)` in `lib/queries/might-unchanged.ts`, exported from `lib/queries/index.ts` with `MIN_DAILY_READS` (7), `NEW_MEMBER_DAYS` (14) and `LOST_MIGHT_PCT` (5). It merges the alliance's usable daily rosters (newest 60) and public event rosters (newest 30) with the `history-readings.ts` helpers and returns `ready`, `dailyReads`, `period` (from, to, daily, events), `members` (n in the newest read), `unchanged` rows and `lost` rows. A row holds uid, name, might and the figure, plus the kills change.
- **Page** `/admin/members` (`app/(pages)/admin/members/page.tsx`), linked as "Members" in the admin nav (`AdminShell`). Session check first, no database read when locked. Alliance select (GET form, default `OWN_ALLIANCE_ID`, `?alliance=<union_id>` for any tracked alliance), the period and n, the help line, the two lists in `AdminSection` frames (cards below 640 px, ruled rows above), and the not-ready chip "Not enough history yet: x of 7 daily reads".
- **Config** `OWN_ALLIANCE_ID = 67111155` in `config/alliances.ts` (no earlier constant named the own alliance).
- **Friday message**: `quotaReport` (`lib/run.ts`) takes `origin` and adds the line `Might unchanged ≥ 7 daily reads: N · Lost might ≥ 5 %: M — [Members ↗](<origin/admin/members>)` to the weekly check; left out until the own alliance is ready. `lib/tick.ts` and `GET /api/quota/check` pass the origin. The text is `copy.discord.admin.mightLine`.
- **Copy**: `lib/copy-members.ts` (`copy.admin.members`, split from `lib/copy-admin.ts` for the 300-line limit); `nav.members`.
- **Tests**: `lib/queries/might-unchanged.test.ts` (5: run listed with N and kills, event reading breaks a run, first seen under 14 days left out, not ready under 7 daily reads, 5 % threshold), `lib/quota-report.test.ts` (2: counts and link with no name, omitted while not ready), one row added to the locked-pages list in `app/(pages)/admin/gate.test.ts`.
- **Docs**: D70 and its index line; README admin guide (the `/admin/members` row, the weekly check row); screenshot `docs/screenshots/08zzzzb-might-unchanged-360.png`.

## Decisions
- **The run extends back past 7 reads.** A member is listed when the might was identical in a run of readings ending at the newest one that holds at least 7 daily reads; N is the whole run, not capped at 7. Reading "identical over the last ≥ 7 daily reads" as a minimum, not a fixed window.
- **Lost might uses the newest 7 daily reads as its span** (the 7th newest daily reading to the newest reading), so the page's period and the lost list agree. The 14-day rule is not applied to it: the member must be in both readings.
- **A member missing from a reading, or with an unknown might, ends the run.**
- **N = days between the run's first and last reading, rounded**, as the task says. Seven daily reads one day apart span 6 days, so a run of exactly 7 reads shows "6 days"; the page and the Friday line name the threshold as "7 daily reads" (changed in review).
- **Own alliance constant** is in `config/alliances.ts`; an `?alliance=` value that is not a tracked id falls back to it.
- **Lookback**: newest 60 daily reads and 30 event rosters. A member unchanged for longer than the lookback shows the lookback's length.
- **The Friday line is computed only when the check posts** (always on the tick; on `/api/quota/check` only when the quota is low), so the route does not read rosters when it posts nothing.
- **Might means `power`** (D60, glossary). Only uid, name, power and kills are read; no blocked key appears in the new module (`blocked-keys.test.ts` passes).

## Deviations
- README (admin guide) edited: two rows for the new page and the new line. Not in the task; the guide lists every admin page and message, and a page left out would be wrong. Prettier realigned the table, so the diff of the file is wider than the content change.
- Nav label is "Members" and the page title "Might unchanged".

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (62 files passed, 1 skipped; 285 tests passed, 1 skipped), drift ("No schema changes"), i18n (17 languages up to date).
- Mutation check: `NEW_MEMBER_DAYS` set to 1 made the first-seen test fail; restored to 14.
- Local run (D47 database, `next dev`, no upstream call; the base URLs in the local env point at a closed port): seed plus 16 daily rosters for OGs inserted by SQL into the local database only, built from the seed's roster (6 constant members, 7 who lost 8 %, the rest rising). `/admin/members` after the PIN: 6 unchanged, 7 lost, period Nov 10 to Nov 16, "7 reads (7 daily, 0 at events) · 101 members in the newest read". `?alliance=67109944` (no daily reads): "Not enough history yet: 0 of 7 daily reads." and no lists. `scrollWidth` 360 at 360 px; no button, select or link under 44 px high. Locked, `/admin/members` shows the PIN card.
- Screenshot at 360 px (full page): `docs/screenshots/08zzzzb-might-unchanged-360.png`. The round "N" badge at the left is Next's dev indicator.
- The local database and dev server were stopped; no AGENTS.md was left in the tree.

## Open issues
1. **Resolved in review:** the help line, the list title and the Friday line now say "7 daily reads", the owner's threshold, instead of "7 days".
2. **The first list stays empty until about 2026-11-19.** Members present in the alliance's oldest reading count as first seen then, and the history starts 2026-11-05, so the 14-day rule is met on 2026-11-19. The not-ready chip goes when the 7th daily read exists (5 by 2026-11-16, per the issue, so about 2026-11-18).
3. **Event rosters in the same span as daily reads are only in the run when they are public** (`publicEvent`); admin-only manual rounds and rehearsals are ignored, as in the member history.
4. **The page has no link to a player's page**; rows are text. Not asked.
5. **No `docs/DESIGN.md` line for `/admin/members`** (DESIGN.md lists the admin pages by name under `admin-section`); not added.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after this one.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` and release; check `/admin/members` after the daily read of 2026-11-19, when the first list can have rows.
Plan changes needed: none.

<adjustments>
- `mightUnchanged(db, unionId)` in `lib/queries/might-unchanged.ts` is the one read for both lists; reuse it for any later Discord count or export. Thresholds are the exported constants.
- Admin Discord copy is English only (D48): the line is `copy.discord.admin.mightLine`.
</adjustments>
