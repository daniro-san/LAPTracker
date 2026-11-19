## D121 — Undead Siege garrison plan: the enemy might on the Calendar entry, who needs help, spare squads, a deterministic suggestion officers edit, and a share with names and squad might only (2026-11-19, owner, 11an, issue 423; amends D108)

Why: before an Undead Siege, leadership finds the members with three or four strong squads and asks each to lend a spare squad to garrison a weaker member's sanctuary. Today an officer builds this list by hand, one member at a time (owner, 2026-11-18).

**The threshold T is the siege's enemy might.**

- A new nullable column `calendar_entries.enemy_might` (bigint, the game's number in full; a check allows it only on `undead` entries and above 0). Migration `0045_garrison` (`pnpm db:generate`).
- It is a field of the Undead Siege entry, in the Calendar's add and edit sheet ("Enemy might", typed in millions like 11.5, "M" inside the field) and at the top of the garrison page. Both save it as a Calendar edit with its version (issue 293), so the last value saved counts and a 409 says who changed it first.
- It belongs to the entry, not to one week. A weekly Undead Siege therefore keeps one value; officers set it again before each siege. This is the reading of "officers set or change it, the latest value counts".
- **Not built: "Read from a screenshot"** for the enemy might. It was not cheap. The desk's OCR runs behind `POST /api/w/[slug]/shots/read` (D109). Filling this field needs a parser for the siege screen's "Enemy might" line, and a real screenshot of that screen to test it on; neither is in the repo. It is a follow-up.

**Who needs help** (`lib/private/garrison-plan.ts`, pure, for the server and the browser). Each member's squads are each squad number's newest stored row (D117). The strongest squad is the highest power, the lower number on a tie (D117's main squad).

- **Needs help:** no squad at T or above.
- **Close:** the strongest squad is at T or above and at most T + 1M (`CLOSE_MARGIN`). The edge is inclusive: with T = 8M, 8.0M and 9.0M are close, 9,000,001 is not.
- **No squad data:** the tracker saw no squad (about a third of OGs on 2026-11-18). They are listed apart, by name, and get no suggestion: the officer decides.
- Everyone else needs nothing and is not listed.

**Helpers and spare squads** (owner, 2026-11-18).

- A member whose strongest squad is at T or above keeps that squad in their own sanctuary. Every other squad they have is a spare, whatever its might: capacity = squad count − 1.
- Spares are offered strongest first, and each shows its might ("Bramble · squad 2 · 12.1M"), so an officer can see a weak spare and decide.
- A close member can also be a helper: lending a spare never touches the squad they keep.

**The suggestion is deterministic.** No AI is used.

- Members are served in this order: "needs help" before "close"; then the members with more good signals; then by name.
- The signals (`lib/private/garrison-signals.ts`, own alliance only, D71):
  - **active:** the newest end-of-day roster's weekly `active` is above 0 (D76);
  - **growing:** the member's might in the newest roster is above their might in the oldest roster 7 to 14 days before it (D109's "growth over one to two weeks", read from the rosters every member has);
  - **took part:** a "Took part" mark in an Undead Siege roll call (D103, kind `raid`) of the four weeks before the siege's week.
- **Missing data never counts against anyone (D75).** Each signal counts 1 only when it is known to be good. Unknown and not-good both count 0, so a member with no data is never put after one whose data is poor.
- Then each member in that order gets the strongest spare squad left that is not their own. One squad per member; each spare goes to one member only.
- **No score or rank is shown.** A card shows only the good signals as words ("Active this week", "Growing", "Took part in a recent siege"), never a number. The page explains the order in one line.

**Officers edit the plan before sharing it.**

- Each card in "Needs help", "Close" and "No squad data" has a "Garrison squad" choice: no garrison, or any spare still free. Choosing one adds or moves a pair; "No garrison" removes it. "Start again from the suggestion" puts the suggestion back.
- A change is saved at once. `garrison_plans` holds one row per entry and week (the plan's Monday, as a roll call): the pairs (`{helper, squad, member}`), `rev`, who saved last and when.
- A save names the `rev` it started from. If another officer saved first, it is refused (409 `stale`), the page says so and shows their version.
- **The rules a save must pass** (`pairsOk`, the system boundary): both members are on the alliance's newest roster; the helper is not the member; the helper has that squad and it is not their strongest; each squad is lent once; each member gets one squad.
- Stored pairs whose member or squad has left the roster are dropped when the page is read.

**Sharing: names and squad might only.**

- "Copy for the game" and "Post to Discord" use one builder (`shareText`):
  - a heading: "Garrison plan · Undead Siege · Lv.6 · Sat, Nov 21";
  - "Enemy might 11.5M";
  - one line per pair: "Bramble → Quillon: squad 2, 12.1M".
- No signal, activity value, might total or roll call mark is in it.
- The post goes to the members' channel through the notices' webhook code (D102): no mention allowed, once per request id (D100), claimed on the plan's row (`post_request_id`, `post_status`). A plan never saved is stored first with no officer (`saved_by` null), so the post has a row to claim.
- Codes: `not_set_up` (no members' channel), `posting` (the same plan is still being posted), `failed` (Discord refused or timed out). The log line carries counts only (`garrison.post`: sent, of, pairs).

**Where it lives.** `/w/[slug]/calendar/garrison?entry=&week=`, linked as "Garrison plan ›" beside "Roll call ›" on each Undead Siege in the Calendar's week.

- Officers only: `requireWorkspace` first. A member's session gets 401 from the route (`member-session.test.ts`).
- Mobile-first: cards in one column below 640 px and two from 640 px.

**Bookkeeping.**

- Home's recent activity: two more small sources (D108 amendment).
- `ws_action` feature `garrison`, actions `save` and `publish` (tracking plan).
- Words in `lib/private/dictionary.garrison.ts` (EN, PT-BR, FR).

**Privacy.** The signals are read in `lib/private` for the workspace's own alliance only (D71, D76). They never leave it as values: not to the page, a log, an AI request, Discord or analytics. Squads stay workspace-only data (D117).
