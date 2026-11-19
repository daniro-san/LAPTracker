# 11an — Undead Siege garrison plan (issue 423, D121)

## Built

- **Garrison page** at `/w/[slug]/calendar/garrison?entry=&week=`, linked as "Garrison plan ›" next to "Roll call ›" on each Undead Siege in the Calendar week. From top to bottom:
  - the siege's enemy might, with "Read from a screenshot";
  - a status line, Copy for the game, the channel choice and Post to Discord;
  - one line explaining the order;
  - "Needs help (n)", "Close (n)" and "No squad data (n)" as cards. Each card has the strongest squad, the good signals as words, and a "Garrison squad for {name}" choice;
  - "Spare squads (n)", with where each one goes;
  - "Start again from the suggestion".
- **Enemy might, one per siege.** A siege is an Undead Siege entry's week. `garrison_plans` holds one row per siege:
  - `enemy_might`, its version `enemy_rev`, and `enemy_history` (every save: value, who, when; appended);
  - the pairs (null while the plan is the suggestion), `rev`, `saved_by`/`saved_at`;
  - the post claim (`post_request_id`, `post_status`, `post_channel`, `posted_by`/`posted_at`).
  - The calendar entry has no enemy might.
  - A siege with no value of its own starts from the newest value saved for an earlier siege, and the page says "Carried over from the siege in the week of {date}". The carried value is not stored until an officer saves it.
  - A stale save gets a 409 with the newer value.
- **Read from a screenshot.**
  - The reader is D109's, `POST /api/w/[slug]/shots/read`, with a new `?text=plain`: a plain-grey read only (`readUpload(…, plain)`).
  - `enemyMightIn` (pure) finds "Enemy Might: 11.5M" in the text and fills the field. Nothing is saved until Save.
  - `ReadScreenshot` takes an optional `query` and the place `garrison` (`ws_text_read`).
- **Rules** (`lib/private/garrison-plan.ts`, pure, shared by the server and the browser):
  - `needOf`: help is below T. Close is from T to T + 1M, inclusive. Unknown means no squads.
  - `sparesOf`: the helper keeps their strongest squad (a tie goes to the lower squad number). Every other squad is a spare, strongest first.
  - `helpOrder`: needs help before close, then the count of known-good signals, then name.
  - `suggestPairs`: in that order, each member gets the strongest free spare that is not their own.
  - `pairsOk`: the save check.
  - `shareText`: the shared text.
  - `enemyMightIn`: the screenshot parser.
- **Signals** (`lib/private/garrison-signals.ts`):
  - active: weekly `active` above 0 in the newest end-of-day roster;
  - growing: might in the newest roster is above might in the oldest roster 7–14 days before it;
  - took part: a "yes" mark in an Undead Siege (`raid`) roll call in the 4 weeks before.
- **Route** `POST /api/w/[slug]/garrison`: `enemy`, `save`, and `post` with `channel` (`members` by default, or `leaders`).
- **Post to Discord.**
  - It reuses `postMessages` and `discordMessages` (D102), once per request id, with no mentions.
  - The officer picks the members' or the leaders' channel; each is shown with its name, and only names reach the page.
  - With one channel set up there is no choice.
- **Home.** Two lines, "{who} changed the garrison plan for “…”" and "{who} posted the garrison plan for “…” to Discord". They are in `lib/repo/desk-activity-garrison.ts`, paged with the D108 cursor.
- **Analytics.** `ws_action` feature `garrison`: `edit` (the enemy might), `save` (the pairs), `publish`. `ws_text_read` place `garrison`.
- **Words.** `lib/private/dictionary.garrison.ts` (EN, PT-BR, FR), plus the "Garrison plan ›" link and the activity keys.
- **Migration.** `0045_garrison` (`pnpm db:generate`): one new table, no change to `calendar_entries`.
- **Docs.** D121 is new. D108 and D109 have dated amendments.

## Decisions

- See D121. The main readings:
  - "Close" includes T + 1M exactly.
  - Spares below T are still offered, with their might shown (owner: "so the officer can judge a weak spare").
  - A close member can be a helper too.
  - "No squad data" members get no suggestion.
- **Prefill means "carried over, not saved".** The carried value is the threshold and shows in the field with a note. Saving it makes it this siege's own. That way an earlier siege's history is never copied into this one.
- **The carried value comes from any earlier siege of the workspace**, the newest week first, not only the same entry. A one-off Undead Siege after a weekly one still starts from the last value.
- **Plain-grey read as a query on the existing route**, not a new screen kind. A new kind would have touched the screenshot drafts' kinds.
- **"Growth over 1–2 weeks"** is read from roster might (end-of-day rosters 7–14 days apart). The coordinator confirmed this.
- **Missing data is neutral.** A signal counts only when it is known to be good, so unknown and not-good tie. A test pins that a member with no data is not put after a member with poor data.
- The status bar scrolls with the page. A sticky version took about a quarter of a 360 px screen.

## Deviations

- The enemy might is no longer a field of the Calendar's add and edit sheet. It is per siege and lives with the siege's plan on the garrison page (coordinator, 2026-11-19).
- `placedOf` in `lib/private/roll-call.ts` is now exported, so the garrison read finds the siege's week the way a roll call does.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest (**211 files: 209 passed, 2 skipped; 1,118 tests passed, 4 skipped**), the drift check and i18n.
- **New tests:**
  - `lib/private/garrison-plan.test.ts` (5):
    - the categories, including the 9,000,000 / 9,000,001 edge at T = 8M;
    - capacity with the strongest squad kept;
    - one squad per member and each squad lent once;
    - the enemy might read from an invented text of the reader's output (also "Miqht 9,8 M"; none from a line without it);
    - the preference order with missing data neutral.
  - `lib/private/garrison.test.ts` (PGlite, 3):
    - each siege keeps its own enemy might and history, the next siege starts from the last one, and a stale save gets the newer value;
    - an edited plan persists, and a save over an old `rev` is `stale`;
    - the post goes to the chosen (leaders') channel with names and squad might, and no activity value or signal word.
  - `member-session.test.ts` has a fixture for the new route: a member's session gets 401.
- **The owner's real screenshot** (local only, never committed):
  - The existing reader's flattened read missed "Enemy Might" entirely.
  - The plain-grey read returned the line "Enemy Might: 11.5M".
  - In the e2e, Read from a screenshot filled the field with 11.5.
- **Local e2e: 44 of 44 checks pass.**
  - Setup:
    - a production build on :3998;
    - this worktree's own Postgres on :55447 with 46 migrations, and the DB bridge;
    - a Discord sign-in stand-in plus a webhook recorder with two channels;
    - an invented 24-member roster with two rosters 10 days apart, 26 squads;
    - a weekly Undead Siege Lv.6 whose previous week saved 8.0M, and last week's siege roll call.
  - No upstream, Groq or Discord call was made.
  - It checked:
    - the Calendar link (44 px);
    - the carried-over 8 and its note, then saved for this siege;
    - the real screenshot filling 11.5 without saving;
    - the counts (7 / 2 / 10 / 9 spares) and the suggested order;
    - no own spare offered, and no suggestion for members with no squad data;
    - no activity number on the page;
    - the clipboard text;
    - remove, add and move persisting, and a stale page refused;
    - members' channel as the default, and the post going to the leaders' channel with no mentions and no signal words;
    - both Home lines;
    - an enemy might of 7 bringing "Needs help" to 4;
    - the following week starting from 8;
    - no sideways scroll in all 8 modes.
- **Screenshots:** 19 files in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11an-shots/`:
  - `garrison-{360,1280}-{light,dark}-{en,pt}` (full page) and `garrison-top-…`;
  - `carried-360-light-en`;
  - `read-360-light-en`.
  - Design review: the PT text wraps cleanly at 360, the channel choice reads as two clear options at 1280, and the cards are two columns at 1280.
- **Privacy:** the diff was compared with the 129 names in the OGs fixture: 0 hits. The real screenshot stays in the scratchpad.

## Open issues

- The parser reads the game's English "Enemy Might". If officers play in another language, its words need adding.
- WebKit was not run, as in earlier sessions.

## Next

- Model/effort: keep. The scope fit one session.
- What the owner must do first: merge. The release applies migration `0045_garrison` (one new table). No environment change: the channel choice uses the `members` and `leaders` entries already in `WORKSPACE_DISCORD_WEBHOOKS`.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- On a real siege, check how many OGs members have 2 or more squads above the enemy might. That number decides whether the spare pool is enough or the "close" members need more attention.
- `allLatestSquads` (`lib/repo/squads.ts`) reads every member's newest squads in one query. Reuse it rather than calling `latestSquads` once per member.
- Screens whose numbers sit on game art (the siege's enemy might) read only in plain grey: `POST /shots/read?text=plain`.
</adjustments>

PR: (added by the orchestrator)
