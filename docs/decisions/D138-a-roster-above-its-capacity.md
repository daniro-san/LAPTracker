## D138 — A roster above its capacity: the read is kept, members with an empty rank are left out, and one counts-only line says so (2026-11-20, owner, issue 481; amends D72, D117, D128)

Why: the tracker's `/v1/alliances` body for OGs in `fixtures/v1-20261116T105019Z` lists 101 members, with `member_count: 101` and `capacity: 100`. One of them has `rank_code: null` and `rank_label: ""`. The other recorded bodies list 100 of 100, every member ranked, and our stored readings show 100 on every day but one (94). Server 325 holds at most 100 members. The extra member is a tracker artefact (likely someone leaving or joining while the tracker's list catches up), not the alliance's size.

**The rule, at the boundary** (`toSnapshotInput`, `lib/sources/shared.ts`, both adapters):

- A member sent with `rank_code: null` and an empty or missing `rank_label` is **unranked**. A member whose body has no rank fields at all (older bodies, the internal source) is not.
- The read is kept. Its `members` are the ranked members only, so the member arrays, `member_uids` and `totalKills` leave the unranked ones out. `memberCount` is `member_count` less the members left out. `listed` keeps how many the body listed.
- The body itself (`raw`, then `raw_json`) is kept as sent. `endOfDayReads` (`lib/repo/workspace-rosters.ts`), the one read model of `raw_json`'s members, keeps only the row's own `member_uids`.
- What follows from it: the Members tab, the member history, the alliance pages and the D132 squads queue (made from `member_uids`) all count and show the ranked members only.
- **Never a fixed 100.** The check uses the body's own `capacity`. A 120-capacity alliance with 120 ranked members is read as before.

**The log line.** When a body lists more members than its `capacity`, or has unranked members, the read writes one `warn` line `roster.over_capacity` with `union_id`, `members` (as listed), `capacity` and `unranked`. Counts only: no uid, name or rank. The event collector and the daily read write it to `run_logs`, so it shows on `/admin/runs`; "Get today's details" (D133) writes it to the console, as its other lines.

**The statement card** (D128) shows members as at most `capacity`: "Full (100/100)", never "101/100". `allianceStatement` (`lib/queries/statement.ts`) caps it.

**Seen in the recordings.** The same 2026-11-16 recording has two alliances under capacity with unranked members: 3 of 65 and 6 of 62, all level 6–10. The rule leaves them out too, and each read writes the line.

**Not done.** The squads queue's new members from an answer's `alliance_members` (D132) are uids only, with no rank, so they are not checked. Readings stored before this change keep their 101.

Tests: `lib/daily-read.test.ts` (an invented 101/100 body with one unranked member reads as 100 in the Members tab's read, the squads queue, the row and the card, with the line; a 120/120 body is untouched) and `lib/sources/v1.test.ts` (the recorded 101/100 body).
