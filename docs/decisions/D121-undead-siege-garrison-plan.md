## D121 — Undead Siege garrison plan: each siege's own enemy might (read from a screenshot), who needs help, spare squads, a deterministic suggestion officers edit, and a share with names and squad might only (2026-11-19, owner, 11an, issue 423; amends D108, D109)

Why: before an Undead Siege, leadership finds the members with three or four strong squads and asks each to lend a spare squad to garrison a weaker member's sanctuary. Today an officer builds this list by hand, one member at a time (owner, 2026-11-18).

**The threshold T is the siege's enemy might, one per siege** (owner, 2026-11-19).

- A siege is one Undead Siege entry's week (its Monday, as a roll call). `garrison_plans` holds one row per siege. The row carries the siege's own `enemy_might` (bigint, the game's number in full, above 0), its version `enemy_rev`, and `enemy_history`: every save, with value, who and when, appended and never rewritten.
- The calendar entry has no enemy might. A weekly Undead Siege's weeks each keep their own value and history.
- It is set at the top of the garrison page ("Enemy might", typed in millions like 11.5, "M" inside the field). A save names the version the officer saw. If another officer saved first, the save gets a 409 that says the newer value. The last value saved counts.
- **The next siege starts from the last value.** A siege with none of its own uses the newest one saved for an earlier siege of the workspace. The page says "Carried over from the siege in the week of {date}. Save it if it is still right." The carried value is the threshold until a value is saved for this siege; it is not stored until an officer saves.
- **Read from a screenshot** (D109's reader, `POST /api/w/[slug]/shots/read`):
  - The siege screen's "Enemy Might: 11.5M" sits on the scene's art, which the reader's row flattening wipes out: the owner's real screenshot read with no such line.
  - `?text=plain` reads the picture in plain grey only. That gave "Enemy Might: 11.5M" on the same screenshot.
  - `enemyMightIn` (pure) finds "Enemy" and a "Might"-like word followed by a number with K, M or B; it tolerates a missing colon or space and a misread letter.
  - The value fills the field; nothing is saved until the officer taps Save.
  - The picture is not kept (D96). `ws_text_read` has the place `garrison`.
  - The real screenshot was used for local testing only and is not in the repo. The committed test uses an invented text of the reader's output.
- Migration `0045_garrison` (`pnpm db:generate`).

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
- A change is saved at once, on the siege's row: the pairs (`{helper, squad, member}`, null while the plan is the suggestion), `rev`, who saved last and when.
- A save names the `rev` it started from. If another officer saved first, it is refused (409 `stale`), the page says so and shows their version.
- **The rules a save must pass** (`pairsOk`, the system boundary): both members are on the alliance's newest roster; the helper is not the member; the helper has that squad and it is not their strongest; each squad is lent once; each member gets one squad.
- Stored pairs whose member or squad has left the roster are dropped when the page is read.

**Sharing: names and squad might only.**

- "Copy for the game" and "Post to Discord" use one builder (`shareText`):
  - a heading: "Garrison plan · Undead Siege · Lv.6 · Sat, Nov 21";
  - "Enemy might 11.5M";
  - one line per pair: "Bramble → Quillon: squad 2, 12.1M".
- No signal, activity value, might total or roll call mark is in it.
- **The officer picks the channel** (owner, 2026-11-19): the members' (the default) or the leaders', each shown with the name set up for it (D102). Only names reach the page, never a webhook. With one channel set up there is no choice.
- The post goes through the notices' webhook code (D102): no mention allowed, once per request id (D100), claimed on the siege's row (`post_request_id`, `post_status`, `post_channel`). A siege with no row yet gets an empty one to claim.
- Codes: `not_set_up` (the chosen channel is not set up), `posting` (the same plan is still being posted), `failed` (Discord refused or timed out). The log line carries counts only (`garrison.post`: sent, of, pairs).

**Where it lives.** `/w/[slug]/calendar/garrison?entry=&week=`, linked as "Garrison plan ›" beside "Roll call ›" on each Undead Siege in the Calendar's week.

- Officers only: `requireWorkspace` first. A member's session gets 401 from the route (`member-session.test.ts`).
- Mobile-first: cards in one column below 640 px and two from 640 px.

**Bookkeeping.**

- Home's recent activity: two more small sources (D108 amendment).
- `ws_action` feature `garrison`, actions `edit` (the enemy might), `save` (the pairs) and `publish` (tracking plan).
- Words in `lib/private/dictionary.garrison.ts` (EN, PT-BR, FR).

**Privacy.** The signals are read in `lib/private` for the workspace's own alliance only (D71, D76). They never leave it as values: not to the page, a log, an AI request, Discord or analytics. Squads stay workspace-only data (D117).

**Amendment (2026-11-19, PR 431 review): the screen, Copy and Discord always show the same plan.**

- **A new enemy might makes a new suggestion on screen.** The page's board is keyed on the enemy might, so it starts again from the server's plan.
- **A plan remembers the enemy might it was made at** (`pairs_enemy_might`, written with every save of the pairs).
  - When the enemy might changes, the page says "This plan was made for an enemy might of {old}. Start again from the suggestion?" with that button.
  - Stored pairs whose member no longer needs help at the new enemy might are dropped from the plan shown, copied and posted.
- **One change at a time.** The garrison choices are off while a change is saved, so a quick second change never starts from an old version.
- **Post only what is saved.**
  - Post is off after a failed save, until a save goes through.
  - Post is refused (409 `not_saved`) while the enemy might is carried over from an earlier siege and not saved for this one. The page turns Post off and says "Save the enemy might for this siege before you post."
- **One request id per choice.** The page keeps one id and makes a new one only after `failed` or another channel, so a double tap posts once. The end of a post is written only for the request that claimed it.
- "No squad data" is in name order, then uid. "Not set up" names the chosen channel.

**Amendment (2026-11-19, D127, issue 458): the "active" signal reads the week's daily quest points.**

- `active` is daily quest points, not weekly. The signal is now the member's `active` added up over the end-of-day reads of the newest read's game week (`weekQuestPoints`), above 0; null when no day has a number.
- The card word is "Did daily quests this week" ("Fez missões diárias nesta semana", "Quêtes du jour faites cette semaine") instead of "Active this week".
