# fix/collector-wrong-alliance: wrong-alliance reads and kills over the members

## Built

- **Identity check at collection** (`lib/collector-identity.ts`), used by `lib/collector.ts` and `lib/daily-read.ts`. A read for alliance X counts as a failed read of X (error row, no roster stored) in two cases:
  - its `union_id` is not X;
  - its tag and its name both differ from X's known labels, and it shares under 20 % of the smaller uid list with X's newest daily roster.
  - A null label matches nothing. With no known label, or no daily roster yet, the read passes.
  - X's daily roster uids are loaded once per run (`lastMemberUids`, one `distinct on` query).
  - The read's `v1.fetch` line carries the code `wrong alliance (id|tag)` and http 200. It names no tag and no member of the other alliance.
- **Kills compared over the members** (owner's scope extension and display decision, 2026-11-21):
  - `lib/queries/live.ts` `memberGains`, one SQL query per event, gives each Start and sample row two figures: `gained` (each member's kills since their first reading of the event in the alliance) and `step` (the members also in the previous reading).
  - `standings` uses `gained`; `serverPulse` uses `step`; the fight clock follows the pulse.
  - `lib/queries/carried.ts` `stayedGains`: kill share vs might share uses the kills gained by the members in both the Start and End rosters, for this event and for the earlier events' ratios. `CarriedInput` is now `{ key, might, gained }`.
  - `lib/queries/rosters.ts` `rosterChanges` is now one SQL query. It returns the joined and left counts, the joiners' Might and Kills at their first reading in the alliance (a sample, else the End), and the leavers' figures at the Start.
  - A null kills counts as 0 in all three queries, as #271 does.
- **Ledger and alliance page.** The figure stays End minus Start. When joiners or leavers moved Might or Kills, a tappable `*` opens a `<details>` panel: Total, Came in with {n} who joined, Went with {n} who left, Without them.
  - The panel is `app/_ui/SplitMark.tsx`, with a 44 px target. A tap outside or Escape closes it.
  - Its screen-reader name gives the figure and the alliance.
  - Below 640 px it is anchored to the card; at 640 px and up, to its cell.
  - The legend reads "Includes member changes: tap * for the split" when a mark opens (`legend.membersTap`).
  - The copy lives in `lib/copy-split.ts`, in all 18 languages.
- **Labels.** The live standings, pulse and kill share help lines now say the kills are those the members gained.
- **Event cache keyed by deployment** (`lib/event-cache.ts`), as the D143 public cache is, so finished events show the new figures as soon as the release is live.
- **Amendments.** D69 (both changes), D83, D79 and D05 (cross-reference).
- **Tests:**
  - `lib/collector-sample.test.ts`: a read carrying another id, or another tag, name and members, is not stored, counts as failed and spends no extra call; a rename with the same members is stored; a read with no daily roster to compare is stored.
  - `lib/daily-read.test.ts`: a wrong body becomes an error row.
  - `lib/queries/live.test.ts`: a joiner's lifetime kills and a one-row dropout move neither the pulse nor the standings.
  - `lib/queries/carried.test.ts`: a joiner's lifetime kills are left out of the kill share and the kills gained.
  - `lib/queries/rosters.test.ts`: joiners at their first reading, leavers at the Start.
  - `app/_ui/event-rows.test.ts`: the ledger keeps the total and gives the split.

## Decisions

- **The reply's id matched X in all four bad rows of event 263** (production, read-only). An id check alone catches nothing seen so far. The tag, the name and the members tell them apart: 0 % uid overlap for the bad rows, 93 % or more for every good row.
- **One basis for both splits.** Joiners come in with their Might and Kills at their first reading in the alliance, so "Without them" keeps what they gained or lost after joining (review SHOULD 4). For the alliance in event 263:
  - kills: +6,100,900 total, +5,342,582 came in, +758,318 without them;
  - might: −140,397,584 total, +95,453,796 came in, −235,851,380 without them. The earlier End-based reading gave −234,312,332.
- **Who carried uses Start ∩ End only.** A fall counts as none, the same rule as #271's `gained`, and no samples are read. The standings and pulse keep a joiner's gains after joining.

## Deviations

- **The read-time guard was dropped.** A stored sample row keeps its tag, but a tag alone cannot tell a wrong read from a rename: two alliances renamed in November. Members could tell, but the pulse's reader returns no members. The orchestrator deleted the four rows, and the collection check stops new ones.
- **"Same id, new tag is accepted" needs the members.** In the bad rows the id matched and the tag changed, which is exactly the shape of a rename. A new tag and name pass only with X's members, or when X has no daily roster to compare.

## Verified

- `pnpm check`: see the final line of this section.
- **QA agent** (production, SELECT only):
  - Event 263, all 20 alliances: its own SQL, the repo SQL and the pure functions agree, with 0 mismatches.
  - The table below was computed when might "came in" was taken at the End. For the might columns, read: came in = the joiners' might at their first reading.
  - Pulse: the slot that showed +6,868,638 (joiners' lifetime kills) is now +1,891,858; the largest slot is +2,340,961.
  - Server kills since Start: 16,598,512 → 13,373,309.

  | Tag | Total K | Joined K | Left K | Without K | Alert | Standing (last reading) | Carried |
  |---|---|---|---|---|---|---|---|
  | YAHO | +6,100,900 | +5,342,582 | 0 | +758,318 | K+M | 729,772 | 702,287 |
  | NSE | +4,394,970 | +357,021 | 0 | +4,037,949 | K+M | 4,016,102 | 4,037,949 |
  | TEST | +751,292 | +190,191 | 0 | +561,101 | K+M | 537,843 | 561,101 |
  | TmS | +395,368 | 0 | 190,191 | +585,559 | K+M | 575,735 | 585,559 |
  | RUS | −301,228 | 0 | 360,259 | +59,031 | K+M | 58,903 | 59,031 |
  | SYNE | −314,842 | 0 | 437,867 | +123,025 | K+M | 120,716 | 123,025 |
  | BRAV | −1,279,606 | 0 | 1,676,274 | +396,668 | K+M | 396,668 | 396,668 |
  | 13 others | no roster change | | | = total | no | | |

- **Past events.** 7 of the 8 events with both a Start and an End have roster changes. The 4 public ones (7, 9, 129, 263) will show the mark. The largest "came in with" kills are 159,055 (event 7), 36,543 (9), 3,092,283 (129) and 5,342,582 (263). Spot checks of events 129 and 7, all alliances each: 0 mismatches.
- **No other wrong-alliance rows.** No sample row in any event shares 0 uids with its alliance's Start roster. The event 9 After row with another tag (id 196) shares 98 of 98 members: a real rename.
- **Cache after deploy.** The ledger reads go through the D143 cache, keyed by `VERCEL_DEPLOYMENT_ID`. Live readings, standings, pulse and fight clock go through the event cache, now keyed the same way. Pages render per request, so old event pages show the new figures once the deployment is live.
- **Local production build** (`next build` + `next start`, local Postgres 18 with all 68 migrations, invented roster, upstream on a dead port), with playwright-core and system Chrome:
  - checked at 360 and 1280 px, light and dark, in EN, PT and FR;
  - 4 marks, each 44×44;
  - at 360 px the panel stays inside the viewport (x 25..335), with no horizontal scroll; at 1280 px it opens under its own `*`;
  - outside tap and Escape close it;
  - the panels read correctly. For example, KSG kills +5.44M = +5.34M came in + +102K without them, and MOTH kills −1.64M with −1.68M gone with 1 who left, +39.5K without them.
- Production timing: `memberGains` on event 263 takes 66 ms and returns 465 rows.
- `pnpm check`: exit 0.

## Cleanup of event 263 (done 2026-11-21)

The orchestrator ran this with the owner's approval (alliance_snapshots ids 449, 628, 777, 787). A sample row keeps its members on the row, so no `member_snapshots` rows go with it. The SELECT returns 0 rows now.

```sql
-- 1. The sample rows of event 263 whose tag is neither the alliance's Start tag nor its board tag.
select a.id, s.slot_at, a.union_id
from alliance_snapshots a
join snapshots s on s.id = a.snapshot_id and s.event_id = 263 and s.phase = 'sample'
join snapshots sb on sb.event_id = 263 and sb.phase = 'before'
join alliance_snapshots b on b.snapshot_id = sb.id and b.union_id = a.union_id
left join alliances al on al.union_id = a.union_id
where a.error is null and a.tag is distinct from b.tag and a.tag is distinct from al.tag;
-- Expect 4 rows before the cleanup: 12:15, 14:45 and 16:45 (two).

-- 2. Only after the owner approves, the same rows:
delete from alliance_snapshots where id in (
  select a.id
  from alliance_snapshots a
  join snapshots s on s.id = a.snapshot_id and s.event_id = 263 and s.phase = 'sample'
  join snapshots sb on sb.event_id = 263 and sb.phase = 'before'
  join alliance_snapshots b on b.snapshot_id = sb.id and b.union_id = a.union_id
  left join alliances al on al.union_id = a.union_id
  where a.error is null and a.tag is distinct from b.tag and a.tag is distinct from al.tag
);
```

## Open issues

- **Three kills figures for one alliance.** For the alliance in event 263, one page shows +758,318 "Without them", +729,772 at the last reading, and +702,287 in who carried. Each is right by its own definition: End, last sample, and Start ∩ End. A reader may still ask why they differ.
- **A stored total can differ from the members' sum.** One alliance's Start might total is 21.9M below the sum of its members' might, so its "Without them" might carries that gap. The formula is as specified.
- **Events 7 and 9 have no samples.** A joiner there "came in with" their End figures, so what they gained during the event counts as brought in.
- **Items 8 and 12** of the adversarial review reached the orchestrator, not this session, so they are not recorded here.
- `lib/lookup.ts` ("Get today's details") still stores `/v1` alliance reads without the identity check.
- Discord messages already posted keep their old figures; they are not edited.

## Next

- Model/effort: keep.
- Owner first: nothing. The four rows of event 263 were deleted on 2026-11-21.
- Plan change: none.

<adjustments>
- Run `checkIdentity` in `lib/lookup.ts` as well. "Get today's details" writes `daily_rosters`, which is the check's member baseline.
- Every view of event kills now has two bases. The ledger and alliance page show the total with the split. The live standings, pulse, fight clock and kill share use the members. A new view of event kills should pick one basis and label it.
</adjustments>

PR: (added by the orchestrator)
