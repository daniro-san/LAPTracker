# 11an — Undead Siege garrison plan (issue 423, D121)

## Built

- **Enemy might.** A new column, `calendar_entries.enemy_might` (bigint; a check allows it only on `undead` entries and only above 0).
  - It is a versioned Calendar field (`enemyMight`). It appears in the add and edit sheet for Undead Siege, typed in millions ("8", "11,5") with "M" inside the field. The garrison page has the same field.
  - A 409 conflict names it "the enemy might" and shows the value as "8.00M".
- **Garrison page** at `/w/[slug]/calendar/garrison?entry=&week=`, linked as "Garrison plan ›" next to "Roll call ›" on each Undead Siege in the Calendar week. From top to bottom:
  - the enemy might;
  - a status line, then Copy for the game and Post to Discord;
  - one line explaining the order;
  - "Needs help (n)", "Close (n)" and "No squad data (n)" as cards. Each card has the strongest squad, the good signals as words, and a "Garrison squad for {name}" choice;
  - "Spare squads (n)", with where each one goes;
  - "Start again from the suggestion".
- **Rules** (`lib/private/garrison-plan.ts`, pure, shared by the server and the browser):
  - `needOf`: help is below T. Close is from T to T + 1M, inclusive. Unknown means no squads.
  - `sparesOf`: the helper keeps their strongest squad (a tie goes to the lower squad number). Every other squad is a spare, strongest first.
  - `helpOrder`: needs help before close, then the count of known-good signals, then name.
  - `suggestPairs`: in that order, each member gets the strongest free spare that is not their own.
  - `pairsOk`: the save check.
  - `shareText`: the shared text.
- **Signals** (`lib/private/garrison-signals.ts`):
  - active: weekly `active` above 0 in the newest end-of-day roster;
  - growing: might in the newest roster is above might in the oldest roster 7–14 days before it;
  - took part: a "yes" mark in an Undead Siege (`raid`) roll call in the 4 weeks before.
- **Persistence.** `garrison_plans` holds one row per entry and week: the pairs, `rev`, `saved_by`/`saved_at` and the post claim. Every change saves at once with `rev` (409 `stale`). `POST /api/w/[slug]/garrison` takes `save` and `post`.
- **Post to Discord.** It reuses `postMessages` and `discordMessages` (D102) and posts to the members' channel once per request id. A suggestion that was never saved is stored first, with `saved_by` null.
- **Home.** Two lines, "{who} changed the garrison plan for “…”" and "{who} posted the garrison plan for “…” to Discord". They are in `lib/repo/desk-activity-garrison.ts`, paged with the D108 cursor.
- **Analytics.** `ws_action` feature `garrison`, with actions `save` and `publish`, is in the tracking plan.
- **Words.** `lib/private/dictionary.garrison.ts` (EN, PT-BR, FR), plus the calendar and activity keys.
- **Migration.** `0045_garrison` (`pnpm db:generate`).
- **Docs.** D121 is new. D108 has a dated amendment.

## Decisions

- See D121. The main readings:
  - "Close" includes T + 1M exactly.
  - Spares below T are still offered, with their might shown (owner: "so the officer can judge a weak spare").
  - A close member can be a helper too.
  - "No squad data" members get no suggestion.
- **Enemy might lives on the entry, not on a week.** A weekly Undead Siege keeps one value, and officers update it before each siege. The plan itself is stored per entry and week, as roll calls are.
- **"Growth over 1–2 weeks".** It is read from roster might (end-of-day rosters 7–14 days apart). D109's "Main squad might" history is only typed for some members, so I did not use it.
- **Missing data is neutral.** A signal counts only when it is known to be good, so unknown and not-good tie. A test pins that a member with no data is not put after a member with poor data.
- **The Discord post goes to the members' channel.** The list tells members whom to reinforce.
- The status bar scrolls with the page. A sticky version took about a quarter of a 360 px screen.

## Deviations

- **"Read from a screenshot" for the enemy might was not built.** It is not cheap: it needs a parser for the siege screen and a real screenshot of that screen to test with, and neither is in the repo.
- `placedOf` in `lib/private/roll-call.ts` is now exported, so the garrison read finds the siege's week the way a roll call does.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest (**211 files: 209 passed, 2 skipped; 1,116 tests passed, 4 skipped**), the drift check and i18n.
- **New tests:**
  - `lib/private/garrison-plan.test.ts` (4):
    - the categories, including the 9,000,000 / 9,000,001 edge at T = 8M;
    - capacity with the strongest squad kept;
    - one squad per member and each squad lent once (`pairsOk` refuses a second squad, a squad lent twice, and the kept squad);
    - the preference order with missing data neutral.
  - `lib/private/garrison.test.ts` (PGlite, 2):
    - an edited plan persists, and a save over an old `rev` is `stale`;
    - the Discord post has names and squad might, and no activity value or signal word.
  - `member-session.test.ts` has a fixture for the new route: a member's session gets 401.
- **Local e2e: 37 of 37 checks pass.**
  - Setup:
    - a production build on :3998;
    - this worktree's own Postgres on :55447 with 46 migrations, and the DB bridge;
    - a Discord sign-in stand-in plus a webhook recorder;
    - an invented 24-member roster with two rosters 10 days apart, 26 squads, Undead Siege Lv.6 at 8.0M, and last week's siege roll call.
  - No upstream, Groq or Discord call was made.
  - It checked:
    - the Calendar link (44 px) and the sheet field showing "8";
    - the counts (7 / 2 / 10 / 9 spares) and the suggested order (Odessa, Tansy, Quillon, Wynnie, Fennick, Juniper, Thimble, Isolde, Hollis);
    - Hollis is never offered their own spare, and members with no squad data get no suggestion;
    - no activity number on the page;
    - the clipboard text;
    - remove, add and move each persist after a reload, and a lent squad is not offered twice;
    - a second officer's older page gets the stale line and then the newer plan;
    - one Discord message with `allowed_mentions` empty, holding the edited pairs and no signal words;
    - both Home lines;
    - an enemy might of 7 brings "Needs help" to 4;
    - no sideways scroll in all 8 modes.
- **Screenshots:** 18 files in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11an-shots/`:
  - `garrison-{360,1280}-{light,dark}-{en,pt}` (full page);
  - `garrison-top-…`;
  - `sheet-360-light-{en,pt}`.
  - Design review: the PT text wraps cleanly at 360, the cards are two columns at 1280, and the tags read in dark mode.
- **Privacy:** the diff was compared with the 129 names in the OGs fixture: 0 hits.

## Open issues

- Follow-up: "Read from a screenshot" for the enemy might (see Deviations).
- Follow-up: the post goes only to the members' channel. A choice of channel was not asked for.
- WebKit was not run, as in earlier sessions.

## Next

- Model/effort: keep. The scope fit one session.
- What the owner must do first: merge. The release applies migration `0045_garrison` (a new table and a new column). No environment change: it uses the existing `WORKSPACE_DISCORD_WEBHOOKS` members channel.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- On a real siege, check how many OGs members have 2 or more squads above the enemy might. That number decides whether the spare pool is enough or the "close" members need more attention.
- `allLatestSquads` (`lib/repo/squads.ts`) reads every member's newest squads in one query. Reuse it rather than calling `latestSquads` once per member.
</adjustments>

PR: (added by the orchestrator)
