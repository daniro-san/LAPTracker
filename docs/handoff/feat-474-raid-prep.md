# feat — Raid prep: the Raid Shield check (issue 474)

## Built

- **Two reads** (`lib/shield-check.ts`, `lib/shield-read.ts`, `lib/shield-tick.ts`), only for alliances whose `shield_check` is on (D134's two layers). They run in the tick's `after`, after the squads batch.
  - **Friday from 23:30 ST:** the day's squads queue (D132) read as a burst of batches (`SquadsRun.shield`). The burst stops when nobody's turn has come, when a batch makes no call, or when the next batch could end after 00:00 ST or after the tick's budget (180 s). The burst is that day's squads read, so nobody is read twice that night. The cap (120), the reserve and the storage are D132's. The 23:45 tick takes the retries.
  - **Saturday from the alliance's morning time** (10:00, 10:15 … 11:00 ST; 10:00 by default) until 12:00 ST: every member of the day's roster once more, from `shield_queue`. The queue rules are the squad queue's. At most 120 calls (`reason: cap`). The reserve waits. A claim is held for 140 s at most.
  - Nothing runs at any other time.
- **Raid prep, on the Raid Shield roll call's page** (`lib/private/raid-prep.ts`, `RaidPrepMarks.tsx`, `RaidPrepRow.tsx`, `prep-data.ts`).
  - The kind is renamed "Raid prep" / "Preparação do raid" / "Préparation du raid".
  - Two ✓/✗ pairs per member: Shield (the roll call's own mark) and Squads off the wall (`roll_call_marks.part` `wall`).
  - The tracker's line on each row, with "map seen 22:32 ST" on both clocks:
    - "Tracker: shield seen" with "8 h shield, ends by 06:32 ST at the latest", or "shield on, length unknown" for other kinds;
    - "Tracker: no shield seen yet" (a hint);
    - the tag "May end before KvK";
    - "Seen Fri 22:32 ST, not seen this morning (09:40 ST)".
  - Above the rows: "16 not seen yet · 10 may end before KvK", then each read's counts, the map-scan hint, and "Accept the tracker's (n)". Accept writes only ✓, and only for members seen with a shield and not marked yet.
  - A ready private message per row, in the member's language: their recorded languages, else the game's, else English. It holds only the parts not yet ✓, plus "bring your troops home", and has a Copy button. A row with both marks ✓ says "All set".
- **The leaders' channel summary** (`lib/shield-post.ts`, `lib/copy-shield.ts`). It is opt-in, in EN, PT-BR or FR. It is posted after Friday's read, then edited in place by every later tick of both reads. It goes through the workspace's leaders webhook (D129), with the site's `WORKSPACE_DISCORD_WEBHOOKS` as fallback. It never goes to the members' channel, pings no one, and names at most 40 people.
- **Alliance settings → Raid Shield check** (`RaidPrepSettings.tsx`, `POST /api/w/[slug]/raid-prep`): the morning time, plus the message switch and its language. The section shows only while the check is on.
- **Data:** migration `0058_raid_prep_shield_check` (`pnpm db:generate`) adds `shield_checks`, `shield_queue`, `shield_settings` and `roll_call_marks.part`. All three tables are deleted with the workspace and none is downloaded (D125).
- **Analytics:** `ws_action` `roll_call` / `accept`, `raid_prep` / `save`; `ws_roll_call_marked` `how: tracker`.
- **Docs:** D137. Amendments to D103, D132 and D134. Updates to ARCHITECTURE, GLOSSARY and the tracking plan. /admin no longer says "not built yet".

## Decisions

- **D137.** D135 and D136 are taken by open PRs 515 and 514.
- **No event-window pause on our key for the morning read.** KvK's Before read is at 10:00 ST, and D132's pause would stop OGs' morning read. The event read runs inside the tick request and the shield read runs in `after`, so they never overlap. The reserve still keeps the event's quota.
- **Squads read off:** an alliance with the squads read off but the shield check on is still read by Friday's burst, through the squads queue, with its squads stored. Its retries are taken only inside Friday's 23:30–00:00 window.
- **The estimate** (D134) counts the shield check as 1 read per member when the squads read is on, and 2 when it is off.
- **"Accept the tracker's" applies to all**, read as: ✓ for everyone the newest reading saw with a shield. "Not seen yet" is never turned into a ✗.
- **The message's "bring your troops home"** goes with every message that has a part left. Friday's text says "before the reset"; after 00:00 ST it says "before KvK starts at 12:00 ST".
- **Persona review** (an R5 the night before KvK, an R4 scouting, product strategy). Fixes applied:
  - Among the not-set rows, not seen comes first, then may end before KvK, then no reading, then seen.
  - "Not seen" lines are in the attention colour; "seen" lines are plain.
  - "The rest" leaves out the not-seen. The bar still says the honest "99 not set" beside "Mark the other 83 as no problem seen".
  - The Discord line says "with a shield seen" instead of "shielded".
  - When the tracker saw a shield, the message says "check your shield is still on".
  - The attention line comes first. Accept's help sits above the button.
  - The ✓/✗ gap is 12 px, and the pairs are at most `max-w-md` wide.
  - The owner's label "Accept the tracker's" is kept; the panel had proposed renaming it.

## Deviations

- **The D135 status bar** (PR 515) is not merged, so the check's progress is not in it. Until it is, the page's read counts and /admin's squads progress cover it.
- **Web push** (part 3 of the issue) is out of scope, as the brief says.
- **Home's activity line** counts a wall mark as "took the roll call", like a Shield mark. An "Accept the tracker's" of many members reads like "the rest".
- **The Discord message lists away members** if the tracker did not see them, because the tick has no access to `lib/private`'s away notes. The page leaves them out.

## Verified

- **`pnpm check`** passes: prettier, eslint, tsc, vitest (253 files, 1,339 tests pass, 4 skipped), drift and i18n (17 languages).
- **New tests**, stubs only, with no upstream and no Discord call:
  - `lib/shield-check.test.ts` (2): the windows, the 8 h end, and "may end before KvK".
  - `lib/shield-read.test.ts` (4):
    - Friday's burst reads 60 of 60 members once as the squads read, and a second tick reads nobody;
    - Saturday reads 30 of 30 again from 10:30 and reads nothing before or after;
    - a 130-member roster stops at 120 calls;
    - one message is POSTed, then PATCHed to `/messages/900`, and only when turned on.
  - `lib/private/raid-prep.test.ts` (3): the row hints; Accept marks only 104 and keeps the officer's ✗; the wall mark is kept apart from the Shield mark and refused on a non-shield roll call.
  - The #471 isolation suite: Alpha's wall mark and Accept on Bravo's two roll calls are refused, and Alpha's Raid prep never shows Bravo's readings. The member-session fixture covers the new route. The estimate test is updated.
- **Migrations:** all 59 applied to an empty local Postgres 18.
- **Local production build** (`next build`, `next start`, local Postgres, OGs with 101 invented members, invented readings for both reads, a fake leaders webhook that is never called): **154 of 154 checks pass.**
  - Raid prep at 360 and 1280, light and dark, EN and PT, plus FR at 360. Each page has its words, the attention line, the read counts, "map seen 22:32 ST" and "May end before KvK". There is no sideways scroll, no blocked field in the HTML, and every button, summary and select is at least 44 px.
  - Bramble 1's English message holds only the shield part ("check your shield is still on") and troops home. Thistle 1's is in French. Wren 1 is "All set".
  - Accept marked 79. A wall tap is saved after a reload.
  - Settings at 360 and 1280, light and dark, EN and PT. Saving 10:30 with the message on survives a reload.
  - Screenshots: the scratchpad's `474-shots/` (before the review), `474-shots-2/` and `474-shots-3/` (after the review).
- **Privacy:** no name from the 386 in the fixture rosters appears in the added lines. The `shield.morning` log line holds counts only.
- **Expected calls** (about 101 members, about 5 % retries):
  - Friday 23:30–00:00 ST: about 106. These are that day's squads read, so nothing extra when the squads read is on.
  - Saturday from 10:00 ST: about 101–106, at most 120.
  - Saturday's UTC quota day: about 210 instead of about 106.

## Open issues

- Test once on a real Friday before relying on it (owner, issue 474): the map scan can be up to 7 h old.
- `shield_type` for the 12 h, 24 h and 3 d kinds is still unmapped. One plain read after turning each kind on would map it.
- "A squad seen outside at the last scan", as a hint, waits for the owner's `seen_at` test.
- Follow-up: show the check's progress in the D135 status bar once PR 515 merges.
- Follow-up: in the R4 review, the "Message" disclosure takes a row of its own. It could sit on the name's line.

## Next

- **Model and effort:** keep.
- **What the owner must do first:**
  1. Merge.
  2. Check that `shield_check` is allowed and on for OGs. OGs has everything on.
  3. Optionally turn on the leaders' message in Alliance settings.
  4. After the first Friday, compare "not seen yet" with what the officers saw in game.
- **The plan itself needs no change.**

<adjustments>
- The D135 status bar can show Friday's read through `squadsToday`, because the burst is the squads queue. Saturday's read is in `shield_checks` (`morning_status`, `morning_calls`) and `shield_queue`.
- Readers of shield data go through `lib/private/raid-prep.ts` (`prepView`). A member's newest reading in a window comes from `shieldReadings` in `lib/repo/shield-checks.ts`.
</adjustments>

PR: (added by the orchestrator)
