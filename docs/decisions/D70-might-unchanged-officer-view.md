## D70 — Might unchanged: an officer view on /admin/members and a count in the Friday message (2026-11-16, owner, 08zzzzb, issue #273)

Why: officers want to know whose might has not moved for a week, to check in with them. The panel and strategy workshop added guardrails: support and farm players are expected, so the view shows n and the period, uses neutral wording and names nobody outside /admin.

Owner's answers (2026-11-16):

1. **Where:** `/admin` behind the PIN, plus the admin Discord channel. Never a public page or public channel.
2. **Thresholds:** at least 7 daily reads; members first seen in that alliance less than 14 days ago are left out.
3. **Wording:** "might unchanged for N days", never "inactive", "dead" or "lazy"; "lost might" is a separate list.

Rules as built:

- **Page.** `/admin/members` (nav: Members), a page of its own like `/admin/runs` and `/admin/errors` (D37, D40). It checks the session before any database read (issue 218). English only (D48). One alliance at a time: the site's own (`OWN_ALLIANCE_ID` in `config/alliances.ts`, OGs 67111155) or `?alliance=<union_id>` for any tracked one; an id that is not tracked falls back to the own alliance. The select is a plain GET form.
- **Readings.** `mightUnchanged` in `lib/queries/might-unchanged.ts` merges the alliance's usable daily rosters (newest 60) and public event rosters (newest 30), oldest first, with `history-readings.ts` (D60: fresh, no error, not empty; `publicEvent`). Only might (`power` in the schema) and kills are read, from the roster arrays and `member_snapshots`; online, last_online_at, active, joined_at and daily_* are never read.
- **Ready.** At least `MIN_DAILY_READS` (7) usable daily reads. Before that the page says "Not enough history yet: x of 7 daily reads" and shows no list; the Friday line is left out.
- **Might unchanged.** For each member of the newest reading with a known might: the run goes back from the newest reading while the member is in the reading with the same might. A reading of an event in the run counts, so a change at an event ends the run. Listed when the run holds at least 7 daily reads and the member was first seen in the alliance at least `NEW_MEMBER_DAYS` (14) days before the newest reading. First seen = the oldest reading (of the 90 fetched at most) in which the uid is in this alliance; a member in the oldest reading counts as first seen then. N = days between the run's first and last reading, rounded. A member absent from a reading, or with an unknown might, ends the run. Sorted by N, then might.
- **Lost might.** The span is the newest 7 daily reads (event rosters between them are in it). A member in the first and last reading of the span whose might fell by `LOST_MIGHT_PCT` (5) % or more of its value at the start is listed with the change and the percent, biggest percent first. War losses count; the page says so. The 14-day rule does not apply here: both readings must hold the member.
- **Row.** uid, name, might now, N days or the might change and percent, and the kills change over the run or the span (for context; "Kills unknown" when either side is null, D15). Nothing else per member.
- **Friday message.** The weekly quota check (`quotaReport`, `lib/run.ts`) gains one line for the own alliance: `Might unchanged ≥ 7 daily reads: N · Lost might ≥ 5 %: M — [Members ↗](<origin/admin/members>)`. Counts and the link only, no names; left out while the alliance is not ready. No new schedule, no other message changes. Nothing in a public message or page changes.
- **Wording of the threshold** (orchestrator review, 2026-11-16). The page and the message say "≥ 7 daily reads", the owner's threshold, not "7 days": seven daily reads span 6 days. Each row's "unchanged for N days" counts the days between the run's first and last reading, so a run of exactly 7 daily reads shows 6 days.
