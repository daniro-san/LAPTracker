# 11aa — Home: who is on the desk now, and recent officer activity

Closes #335. Branch `session/11aa-desk-activity`, cut from `origin/dev` at 3ea8caa. Rules applied: D71, D75, D99, D105. New decision: **D108**.

## Built
- **"On the desk now"** on Home, one line under the title: "On the desk now · Wren", or "Nobody else right now.".
  - `workspace_sessions.seen_at` (new, nullable). `requireWorkspace` writes it after an officer session passes its checks, only when the stored time is more than a minute old (`SEEN_EVERY_MS`, also checked in the SQL `where`). Pages and private API calls both count.
  - The read takes officer-tier sessions of this workspace seen in the last 10 minutes (`ON_DESK_MS`), not ended, account not blocked, and leaves out the officer looking. Member sessions never count; `requireBoard` writes nothing. The game's `online` flag is not used.
- **"Recent activity"** on Home, the last section: the newest 15 lines, and up to 40 behind "Show more" (a `<details>`, 44 px).
  - Sources, one bounded read each (newest 40 of the last 14 days), merged in memory: member facts saves, notice saves and Discord posts, saved screenshot drafts, calendar entries added and changed, roll call marks, follow-up records, thefts added, new members added by hand. Names come from three more reads (officers, members, notice titles). No N+1, no new logging table.
  - Roll call marks: one line per action. Several marks at one instant read "marked the rest of the roll call"; one officer's single taps on one roll call within the same hour make one line.
  - A draft save also writes facts, thefts and new members, and a follow-up writes facts. When those rows share the same officer and instant, only the higher action is shown. The same line repeated in a row is shown once.
  - Lines show officer and member names, notice and calendar titles, and the screenshot kind. They never show a field value, a follow-up action or note, or a theft's note, attacker or victim. Every name goes through `isolate()`.
- **Code**:
  - `lib/repo/desk-activity.ts` (the reads);
  - `lib/private/desk-activity.ts` (merge, presence);
  - `lib/private/desk-activity-words.ts` (the lines; the time uses the existing `agoText`);
  - `lib/private/dictionary.activity.ts` (17 keys × EN, PT, FR);
  - `app/(private)/_ui/DeskActivity.tsx`;
  - Home `page.tsx`;
  - `touchSession` in `lib/repo/workspaces.ts`.
- **Migration** `drizzle/0036_desk_activity.sql`: `seen_at`, plus indexes on `member_facts (workspace_id, written_at)`, `notice_edits (workspace_id, edited_at)`, `member_follow_ups (workspace_id, written_at)`, `thefts (workspace_id, created_at)` and `roll_call_marks (written_at)`.
- **Docs**: D108, the decisions index, ARCHITECTURE.

## Decisions
- **Order on Home**: title → desk line → Today and tomorrow → Members this week → To review → Recent activity.
  - The presence line is about 24 px.
  - The three task sections keep their places.
  - The feed is context, not a task, so it goes last and pushes nothing down.
  - D108 has the reasoning.
- **14-day window and 40 lines**, no paging past "Show more". This bounds every grouped read, including the roll call grouping, which has no workspace column on marks.
- **Facts**: one save, meaning same officer and same instant, is one line. A batch over several members (sheet import) reads "updated the info of n members". That count is per action, not per officer.
- **Follow-up lines don't say which action**, because On a break and Needs help are member statuses.
- **Time** reuses `agoText` ("5 minutes ago", "há 5 minutos", "il y a 5 minutes") instead of new compact keys.
- `usable` (the roster predicate) is now exported from `lib/repo/workspace-rosters.ts` for the member-name read.

## Deviations
- **Existing test changed**: `lib/private/member-roles-migration.test.ts` now inserts its two pre-0034 sessions with plain SQL. `createSession` names `seen_at`, which does not exist before 0036.
- **No stubbed Discord sign-in in the e2e**: Ana's session row and cookie were seeded directly. Sign-in is not changed by this session.
- **Screenshots**: no iPhone WebKit shots, because this session's Playwright has no WebKit build.

## Verified
- **Gates.** `pnpm check` gates all exit 0: prettier, eslint, tsc, vitest **173 files passed, 2 skipped; 916 tests passed, 4 skipped**, drift gate, i18n "17 languages up to date".
  - Vitest ran with `--testTimeout=60000`. The machine's load average was about 35 from other agents, and the two whole-migration PGlite tests (`member-roles-migration`, the thefts_kind migration) took 11–16 s against the 10 s default.
  - Both pass alone with the longer timeout. The thefts one also passed alone at the default timeout.
- **New tests**: `lib/private/desk-activity.test.ts`, 3 (PGlite).
  - Only the other officers seen in 10 minutes are listed: a member session seen 1 min ago and an officer seen 11 min ago are not.
  - `seen_at` is written at most once a minute.
  - The merged feed: newest first, one line per notice save, a "rest" roll call line plus one line for three taps, a follow-up covering its fact, a draft covering its two thefts, repeated fact saves shown once, and no value, note or attacker in any line.
- **Local e2e, 41 of 41 checks plus 2 of 2 empty-state checks**:
  - Setup: production build (`next start` on :3981), local Postgres 18 on 54981 (36 migrations), the bridge on 54982, the 11y invented roster plus `11aa/activity.sql` (Ana viewing, Wren seen 3 min ago, Rook 25 min ago, Rio a member seen 1 min ago, 22 actions). No upstream, Discord, Groq or `/api/quota` call.
  - Per language (EN, PT, FR):
    - Home answers 200;
    - the desk line names Wren only;
    - 15 lines show, then "Show more" (44 px) opens all 22, and the summary hides;
    - the feed has no fact value, follow-up note or theft note;
    - the theft line names only the officer;
    - the feed is the last section.
  - EN: the first line is the Discord post, and the roll call "rest" shows as one line.
  - No sideways scroll at 360 and 1280, light and dark.
  - Ana's own `seen_at` was written; `app_errors` is empty.
  - Empty states (EN, PT): "Nobody else right now." and "Nothing in the last two weeks.".
  - The server log holds no member name, value or note.
- **Privacy grep**: added lines against the 101 names in the OGs fixture roster: 0 hits.
- **Screenshots** (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11aa-shots/`:
  - `home-{360,1280}-{light,dark}-{en,pt-BR}` and `home-360-{light,dark}-fr`;
  - `feed-*` for the same set;
  - `empty-360-light-{en,pt-BR}`.
- **Designer look.** At 360 the desk line sits under the title without crowding it. The three task sections are where they were. PT and FR feed lines wrap to two lines with the time after the name, and nothing overflows. No fix was needed.

## Rebase on 6e18878 (#396, #397)

- `member-roles-migration.test.ts` keeps both changes: the plain-SQL session inserts from this branch and dev's 60 s timeout.
- The decisions index keeps D108 and dev's D112.
- The migration was regenerated as `0035_desk_activity` with the same SQL. #398 takes 0035 (`0035_roll_call_cheese`), so this one becomes 0036 when it is regenerated after #398 merges.
- `pnpm check` exits 0 with default timeouts: **174 files passed, 2 skipped; 925 tests passed, 4 skipped**. The e2e above ran before this rebase.

## Owner answers round (2026-11-17), rebased on 408d046 (#398)

- **Calendar changes** are in the feed: "Ana changed the Calendar entry 'Undead Siege · Lv.5'".
  - Entries have no history table. Each field of an entry and of its week rows keeps `{v, by, at}` in `edits` (the 409 check).
  - The read expands those stamps and groups them by officer and instant, so a save of several fields is one line.
  - Only the newest change of each field exists, so a change that a later one overwrote is not shown.
- **Notice deletions**: notices cannot be deleted today (no route, no repo function, no soft-delete column). Nothing was added. D108 records the shape a record would take if a delete is built.
- **Follow-up lines name the choice**: "Wren talked to Bramble", "… marked Thistle on a break until Nov 24", "… marked Thistle as needing help", "… noted a member is fine". The date is the stored last day away. Never the note. The old two follow-up keys were replaced by five, plus "a member" and the calendar-change key, in EN, PT and FR.
- **Migration**: regenerated as `0036_desk_activity` on top of `0035_roll_call_cheese`, same SQL.
- **Tests**: `desk-activity.test.ts` +1. It covers a calendar entry with two fields changed in one save (one line), a week-row change by another officer, and talked / break until Nov 24 / fine in EN, with the FR break line "jusqu’au 24 nov.". No note appears. The first feed test now expects "Wren marked Thistle as needing help".
- **Verified**:
  - `pnpm check` exits 0 with default timeouts: **174 files passed, 2 skipped; 934 tests passed, 4 skipped**.
  - Short e2e, **43 of 43**, on a fresh production build. The database was recreated with 37 migrations, and the seed added Wren's change to the Cheese Trap entry and a break for Marlow.
    - EN: the first line is "Wren changed the Calendar entry 'Cheese Trap I · Lv.7'", the second "Wren marked Marlow on a break until Nov 24", and "Wren marked Thimble as needing help" is in the feed.
    - Per language, "Show more" opens all 24 lines.
    - No note, value, attacker or victim appears. Nothing scrolls sideways at 360 and 1280, light and dark.
    - `app_errors` is empty.
  - Shots were refreshed in `11aa-shots/`.
  - Privacy grep: 0 of 101 roster names.

## Review round (PR 401: code review and persona panel)

- **Grouping.** One officer's consecutive member info saves, thefts added or new members added become one line at the newest time, for example "Ana updated 11 members" (distinct members, plus batch members). Any other line ends the run, so posts, roll calls, breaks and calendar changes stay in sight. Home shows 6 lines before "Show more" (it was 15).
- **Saved drafts past 7 days.** `dropExpired` (`lib/repo/import.ts`):
  - open and discarded drafts are still deleted at 7 days;
  - a saved draft has its `pages` and `rows` emptied at 7 days;
  - the saved draft's row is kept until 14 days after the save (`SAVED_DRAFT_KEEP_MS`, also the feed's window).

  The save's facts, thefts and new members therefore stay behind one "saved a screenshot" line. Recorded in D108, with a dated D96 amendment.
- **Fewer queries.** The six small sources (notice saves, notice posts, saved drafts, entries added, new members, follow-ups) are one `union all` read. A Home open now runs 5 feed reads at once, then 3 name reads: 8 queries in all (it was 13, 10 of them at once). D108 states the count and that `limit` bounds the rows returned, not the rows scanned.
- **Undo.** A `withdrawn` row is not shown, and neither is the record it cancelled (the next record after it is `withdrawn`).
- **Copy** (the grep found these strings quoted only in D108, which is this PR's own, so D108 was updated in place):
  - "Just you." / "Só você." / "Il n’y a que vous.", and "Na Mesa agora";
  - "took the roll call" / "finished the roll call";
  - "added Wobbleton as a new member";
  - "Ana updated n members";
  - PT: "editou os dados de", "colocou … em pausa até 24/11" (a numeric day/month for PT only), "fez / concluiu a chamada", "anotou um roubo no registro";
  - FR: "a modifié la fiche de", "a mis … en pause jusqu’au 24 nov.", "a fait / a terminé l’appel", "a noté un vol dans le registre";
  - the new empty feed line in three languages.
- **"(R4)".** The feed adds no rank tag. The "(R4)" in the earlier shots was part of the e2e seed's chosen name ("Rook (R4)"). The seed now uses "Rook". D108 says names are the officers' chosen names, as elsewhere on the desk.
- **Tests.** `lib/private/desk-activity.test.ts` (5), `lib/private/desk-activity-feed.test.ts` (3, new), and shared setup in `desk-activity.test-helpers.ts`, because one file passed the 300-line limit:
  - a member session whose `seen_at` is set directly is not listed. With the tier filter removed, this test fails (checked);
  - a `requireBoard` visit leaves `seen_at` null;
  - grouping: 5 members across single and batch saves, a Discord post ending the run, 2 new members grouped;
  - a member-update save 10 days old, with its fact and new member at the same instant, gives one line, and its `pages` are emptied; a talked-then-Undo follow-up shows nothing;
  - 45 follow-ups give 40 lines.
- **Verified**:
  - `pnpm check` exits 0: **175 files passed, 2 skipped; 938 tests passed, 4 skipped**.
  - Short e2e, **34 of 34**, on a fresh production build (37 migrations, the same seed with "Rook"). At 360, in EN, PT and FR:
    - 6 lines show before "Show more";
    - the grouped line ("Ana updated 11 members"), "finished" / "took the roll call", the break with its date ("24/11" in PT), and the theft wording;
    - no note, value, attacker or victim, and no "(R4)";
    - no sideways scroll, light and dark;
    - `app_errors` is empty.
  - Shots: `11aa-shots/r2-home-360-light-{en,pt-BR,fr}.png` and `r2-feed-360-{light,dark}-{en,pt-BR,fr}.png`.
  - The privacy grep found 0 of 101 roster names.
  - Not run in this e2e: the "Just you." line (no screenshot with nobody else on the desk). It is covered by the dictionary check only.

## Open issues
- The feed shows only the newest change of each calendar field (no history table). It has no calendar deletions and no theft follow-up states (owner: not this round). Notices cannot be deleted at all.
- Only one bound applies to a long run of single roll call taps: the hour grouping, on top of the 40-row read limit.
- A saved draft's row (and its `discord_pictures` rows) now lives 14 days instead of 7. A second "Send to LAPTracker" on the same picture in that time points to the saved draft instead of making a new one.
- Both parts are as of the page load. There is no live refresh.
- A former member (not in the newest roster) reads "a member's info".

## Next
- Model/effort: keep. One sitting covered the reads, the UI and the e2e.
- What the owner must do first: merge and release (migration 0036 adds a nullable column and five indexes, with no backfill). Then open Home on a phone while another officer has the desk open.
- Plan change: none. The workspace track lives in issues, not in `docs/SESSION_PLAYBOOK.md`.

<adjustments>
- `workspace_sessions.seen_at` exists; an officer request writes it at most once a minute (`SEEN_EVERY_MS` in `lib/private/session.ts`). Any future "who is around" need should read it, not add a table.
- `recentActivity(db, access, now)` returns typed lines. A new history (for example calendar edits) joins by adding one bounded read in `lib/repo/desk-activity.ts` and one kind in `desk-activity.ts` and `desk-activity-words.ts`.
- A migration test that runs app inserts on an older schema breaks when a column is added. Insert with plain SQL in such tests.
- Migration number: `0036_desk_activity`, on top of dev's `0035_roll_call_cheese` (408d046).
</adjustments>

PR: (added by the orchestrator)
