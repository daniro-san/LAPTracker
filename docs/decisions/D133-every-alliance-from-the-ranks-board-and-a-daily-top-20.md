## D133 — Every alliance from the ranks board, a top 20 recomputed every day, and "Get today's details" for the rest (2026-11-20, owner, issue 459; supersedes D4's fixed list; widens D5's use of the ranks board; amends D60, D69, D72, D85, D89, D90, D97, D124, D130)

Why: `config/alliances.ts` held 20 fixed union ids (D4). Changing them needed a code change and a redeploy, an alliance that climbed into the top 20 was missed, and one that dropped out kept being read. The owner (issue 459, 2026-11-19 and 2026-11-20): follow every alliance on the server, recompute the top 20 every day, show every alliance publicly, and let any visitor get one day's details of an alliance outside the 20.

**The ranks board, every server day** (`lib/tracked.ts`, `lib/repo/alliances.ts`, `lib/schema-alliances.ts`, migration `0054_all_alliances`).

- The tick reads the board right before the daily read, in its window (23:30 ST), through `lib/sources/internal.ts` `fetchRanks`. It spends no quota.
- **This widens D5, by the owner's decision (2026-11-19, issue #459).** D5 allowed the ranks board only as a cross-check that never feeds a number on a page. From D133 the board also picks the tracked set, and its might, kills and places are shown on `/alliances` and on each alliance's page, labelled "Ranks board". They still never enter a delta: event and history numbers come from rosters only. The endpoint and its rules are unchanged: the same `GET /servers/catalog/<server>/ranks`, no refresh call, no Origin, Referer or cookies.
- The board's rows now also give each alliance's `abbr`, `name` and `badge_id`. The parser reads them as optional, so a board without them still parses. `avatar_url` is not read.
- Stored once per server day:
  - `alliance_board`: one row per alliance, with the board's might and kills and its places on both boards. The tag and name history comes from these rows.
  - `alliances`: one row per alliance ever seen, with its newest tag, name and emblem. `allianceLabels` reads labels from here, and falls back to the newest daily roster's tag for an alliance the board never listed.
- **The tracked set** (`tracked_sets`, one row per server day; the insert is the claim):
  - It is the board's `TRACKED_COUNT` (20) alliances with the most might, a tie going to the lower id (`topByPower`).
  - A board that cannot be read keeps the newest set (`source: previous`) and posts one admin line: "Ranks board unreadable <day>: yesterday's tracked alliances are kept."
  - Before any set exists, the newest event's list is used (`source: event`). That list is D4's, so the first set is compared with it.
- **Changes**: the first caller of the day compares its set with the day before's. An alliance entering or leaving posts one admin Discord line ("↕ Tracked alliances <day> (top 20 by board might)", then "＋ In: …" and "－ Out: …"). /admin shows the newest set and every change of the last 7 days ("Tracked alliances" card). An alliance's history keeps every day it was read.

**The daily read** (D60, D72; `dayTargets`, `dailyTargets` in `lib/workspace-keys.ts`).

- It reads the day's tracked set on `LAP_API_KEY`, as before, plus every workspace's alliance outside the set:
  - on the workspace's own key when it saved a usable one (D124);
  - on `LAP_API_KEY` when it saved none, or when the keys are off;
  - not at all when its saved key cannot be used now (invalid, out of quota, or sealed under another master key). That alliance is never read on ours.
- The quota rule counts only the reads on `LAP_API_KEY`: `dailyReadQuota(reads on ours, 20)`.
- A workspace key's 401 or 429 marks that key (D124) and fails only that alliance. It does not stop the read.
- The day's outcome is judged on the day's targets only. A lookup's roster stored under the same day does not count.
- /admin's Retry reads the same targets. It reads the board first when the tick has not yet.

**Squads (D132), unchanged.**

- The squads queue still takes its alliances from `squadTargets`, that is the workspaces, and the day's roster of each. Every workspace's alliance is in the daily read, so the queue always has a roster to fill from, whether or not the alliance is in the top 20.
- A lookup reads `/v1/alliances` only: it queues no member and writes no `player_reads` row, because a lookup's alliance is never a workspace (that alliance is in the daily read, so the button refuses with `daily`).
- `squadsReserve` counts the event's reads for `TRACKED_COUNT` (20), as it counted the old list's 20.
- Each squads target carries its alliance's label (`allianceLabels`), so the run's lines and analytics keep the public tag.

**Events** (D4's freeze, kept). A Before copies the newest tracked set onto `events.alliance_ids`. The After and every sample (D69) read that copy, so a set that changes mid-event changes nothing in the running event. On a new database with no set and no event, the Before takes the board's top 20 at once.

**Public pages.**

- **`/alliances`, "All alliances"**: every alliance of the newest board.
  - The tracked set comes first ("Read every day"), then "More alliances" by board might, 25 a page (`?page=n`, plain links).
  - Each row has its place, emblem, name, and the board's might and kills, compact or exact by the page's switch. No chart.
  - A tracked alliance's row opens its page in the home event. Any other opens `/alliances/[id]/history`.
  - The ledger links to it under its table: "All 98 alliances on the server →".
- **An alliance's own page** is `/alliances/[id]/history`. It used to be a 404 without a roster. Now it opens for any alliance on the board:
  - a ranks board line with its date ("Ranks board of Nov 20: #23 by might (412M) · #31 by kills (3.10M)"), and "Read every day" when the daily read covers the alliance;
  - "Get today's details" when the daily read does not cover the alliance;
  - its statement (D128) when a lookup read it;
  - its history, or "No member list for this alliance yet."
  - The breadcrumb goes to "All alliances" when the alliance is not in the home event.
- Balance (D85) and standing (D90) count each day's tracked set only. A day before the first set counts the newest event's list. Flow (D89), merge (D84) and the server's players (D97) use the newest set.

**"Get today's details"** (`lib/lookup.ts`, `POST /api/alliances/[unionId]/details`, the owner's comment of 2026-11-20).

- **Once per alliance per server day, for the whole site.** The press claims (alliance, server day) in `alliance_lookups`, under one lock per day, so two presses at the same second make one claim. INVARIANT `lookups.once-per-alliance-day`.
- **What it reads**: one `GET /v1/alliances/{id}` on `LAP_API_KEY`, without `fresh` (the tracker's cached copy, `CallOptions.fresh: false`), never retried.
- **The quota guard** comes before it, inside the claim's lock: one `/v1/quota` call, never retried. The read goes ahead only when D117's reserve stays intact after it and after every lookup of the day still in flight: `remaining − 1 − in flight ≥ squadsReserve(now, 20)`, which is the 100-call margin plus the KvK's reads on its quota day. So parallel lookups cannot together go below it. INVARIANT `lookups.keeps-event-reserve`. A lookup costs at most 2 calls.
- **Time**: each of the two calls is cut at 10 s (`LOOKUP_CALL_TIMEOUT_MS`), so a lookup ends well inside the route's 30 s `maxDuration`. A claim still "running" 5 minutes after it was made (`LOOKUP_STALE_AFTER_MS`) belongs to a killed function: the page and /admin show it as failed, and it no longer counts as in flight.
- **"Read daily" is one rule** (`dailyKeyRule` in `lib/workspace-keys.ts`, INVARIANT `daily.one-rule`): the daily read's targets and the button's "daily" refusal use it, so a workspace's alliance whose saved key cannot be used now is not read daily, shows the button, and says "Details for this alliance aren't read every day."
- **Refusals**:
  - Refused with no call: an alliance the daily read covers (`daily`); inside the scheduled event's window (`event_window`, INVARIANT `lookups.not-in-event-window`); past `LOOKUPS_PER_DAY` (30) claims in the day (`cap`, INVARIANT `lookups.daily-cap`).
  - Kept for the day: a refusal after the claim keeps it, so the alliance waits until tomorrow. A quota refusal is stored as `refused` (migration `0055_lookup_refused`) and the page says "Today's lookups are used up, try again tomorrow."; a failed call is `failed` and the page says "Today's lookup didn't work. Try again tomorrow."
- **Storage**: the roster is stored as a daily roster of that server day (D72), through the same `dataRow`. Every later visitor sees it in the history and the statement, and D71's rules hold: x, y, online and last_online_at stay in raw_json.
  - Its freshness is judged against 60 minutes, the tracker's cache life (D64), not 20, because the read asked for the cached copy.
  - `daily_rosters.read_day` no longer references `daily_reads`: a lookup's day may have no daily read yet.
- **No sign-in.** The POST needs the same origin and a JSON body (`isSameOriginJson` in `lib/route.ts`). Each address may press 5 times in 15 minutes, counted first (`auth_attempts`, `lookup:ip:<address>`). INVARIANT `lookups.ip-rate-limit`. The page stays cacheable: the button's state comes from the database, not the visitor.
- **What the page says** (EN, PT-BR, FR and every public language):
  - "Details for this alliance aren't read every day." with the button "Get today's details" and "One lookup a day, shared with everyone." (the owner's "(once a day for everyone)", made explicit after the persona panel);
  - after a lookup: "Details from today, 14:05 server time · anyone can get them again tomorrow" (nothing reads it again by itself);
  - past the cap or the quota: "Today's lookups are used up, try again tomorrow.";
  - after a failed read: "Today's lookup didn't work. Try again tomorrow.";
  - during the event: "Lookups pause while the weekly event runs. Try again after it.";
  - after too many presses: "Too many lookups from here just now. Try again in a few minutes."
- /admin lists today's lookups: alliance, time, outcome, and "n of 30 · calls".

**Quota, measured on the code** (fixtures and stubs only; no upstream call was made building this):

| Read                       | Calls a day                                         |
| -------------------------- | --------------------------------------------------- |
| Board                      | 0 (internal)                                        |
| Daily read                 | 1 quota call + 20 tracked, unchanged                |
| A workspace outside the 20 | + 1 on its own key, or + 1 on ours without one      |
| Lookups                    | ≤ 30 × 2 = 60 on ours, only while the reserve holds |

A normal day before: about 21 for the daily read plus about 100 for OGs' squads. A normal day after: the same, plus at most 60.

**Workspaces and invites.** A workspace, an invite or a "Request an Officers' Desk" may name any alliance we know: one on the board, or one with a daily roster (`isKnownAlliance`). The 20 are no longer required. Their tag and name come from `allianceLabels`. A workspace's access (`WorkspaceAccess.alliance`, `BoardAccess.alliance`) carries them, so the desk's header, the thefts log's own tag, the screenshot import and analytics' `alliance` read them from there.

**Not built** (issue 459's plan, left out on purpose):

- the configurable extra N of untracked alliances in the daily read: the owner's lookup button replaces it, and it would be 0 by default;
- the manual pin or unpin of an alliance on /admin, which the issue marks optional.

**Amendments to earlier decisions.**

- **D4**: its fixed list is superseded. Alliances are still addressed by `union_id`, and the event's copy at Before is kept. Its quota rule is unchanged.
- **D60, D72**: the daily read's alliances are the day's tracked set plus the workspaces' alliances (above), not `DAILY_ROSTER_IDS`.
- **D124**: "A workspace's own daily roster read on its own key belongs to an alliance outside the 20, which issue 438 builds later" is built here. A tracked alliance's daily read stays on our key, as D124 says.
- **D130**: the request form lists every known alliance. An invite may be made for any known alliance. The roles' `[TAG]` and the address come from the board's tag.

**Amendment 2026-11-22 (orchestrator, issue 509):** `isSameOriginJson` now lives in `lib/same-origin.ts` (no imports), not `lib/route.ts`; the public lookup route imports it from there and `lib/private/http.ts` re-exports it (#631).
