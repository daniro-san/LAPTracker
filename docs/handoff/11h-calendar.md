# 11h — Calendar tab: week agenda, caravan picks, server and local time

Closes #300 (the Calendar, with caravans and open events); part of #293. It builds the `for_members` flag that #331 (the members' board) reads later. Rules applied: D71, D73, D75, D77, D52, D38. No new decision.

## Built
- **Pages**:
  - `/w/[slug]/calendar` (Week) and `/w/[slug]/calendar/caravans` (Caravans). `?week=` takes any day of the week shown; without it, this server week. Both run `requireWorkspace` first (`app/(private)/_ui/calendar-page.ts`, `openCalendar`).
  - **Sub-nav** `Week · Caravans · Notices` (`CalendarNav.tsx`): three links, 44 px tall, `aria-current` on the open one. Notices links to 11i's `/w/[slug]/notices`. The week and caravan links keep `?week=`.
  - **Week bar** (`CalendarWeekBar.tsx`): ‹ previous week, the range ("Nov 16 – Nov 22", each date kept on one line), next week ›, "This week" when another week is shown. Then once per screen: "ST is server time, the game's clock (UTC−2). The second time is your own; +1 d means the next day. KvK = Kingdom War." The offset is computed from `SERVER_TZ`.
  - **Week agenda** (`CalendarAgenda.tsx`, client): the week's Alliance Duel theme first, then Monday to Sunday, each day with its entries or "Nothing planned.". An entry shows "16:00 ST · 15:00 your time", its title, the caravan's roles line, notes, "Open the link", tags ("Every week", "Moved from Mon, Nov 23 16:00 ST", "Shown to members") and a 44 px Edit button. "Add an event" opens the same sheet empty, on today when the week shown is this week, else on its Monday.
  - **Month overview** from 640 px (`MonthGrid.tsx`): six Monday-to-Sunday rows of the month that holds the week's Monday; each day links to its week and lists up to three entries ("16:00 Alliance Caravan") and "+N more". Hidden below 640 px.
  - **Caravans** (`CaravanBoard.tsx`, `RosterPicker.tsx`): each Alliance Caravan of the week with its day, ST and local time, the Coachman seat, a VIP | Guardian choice and the second seat. "Choose" opens a search over the alliance's newest roster (name keys, D74, 11n's `searchRoster`, at most 6 rows); the member already in the other seat is shown but cannot be chosen. The roster is in name order; no suggestions, no counts.
- **Entry types** (only these): Alliance Caravan; Cheese Trap I / II with its level (1–10); Undead Siege with its level (1–10); Elixir Scramble, team A or B, in one of the windows 09:00, 18:00, 23:00 ST (30 minutes); KvK; the Alliance Duel weekly theme (one per week, free text, no time); other events (a name). Every entry has optional notes, an optional link (http/https only) and the `for_members` switch.
- **The add/edit sheet** (`EntryForm.tsx`, `EntryFields.tsx`, `DeleteArea.tsx`, client): kind chips (add only), the kind's own fields, the day (native date field), the time typed in ST ("18:00", "1800", "18", "18.00", "18h00") with the officer's own time under it as they type, "Only this day / Every week" (add), "Show to members" (off), Save and Close.
  - Editing a weekly entry asks whether a new day and time is for "Only the week of <date>" (default) or "Every week"; the other fields apply to every week.
  - Delete asks once more: a one-off is deleted; a weekly entry offers "Only the week of <date>" or "This week and every week after".
- **Time**: every time is shown in ST and on the viewer's own clock (`YourTime.tsx`). The browser's zone is read with `useSyncExternalStore` after hydration, so the server renders no local time and nothing differs at hydration. Day shifts show as "(+1 d)" / "(−1 d)".
- **Model** (`lib/schema-calendar.ts`, re-exported from `lib/schema.ts`, migration `drizzle/0024_calendar.sql`):
  - `calendar_entries`: one plan. `day` is its first server day, `minute` its server time (null only for the theme), `weekly`, `last_week` (a one-off: its own Monday; weekly: null, or the last week after "this week and every week after"), `for_members` (default false), `kind`, `variant` (I/II, A/B), `level`, `title`, `notes`, `link`, `created_by`, and `rev` + `edits` (per field: version, who, when). A partial unique index allows one Alliance Duel theme per workspace and week.
  - `calendar_occurrences`: one week of an entry, written only when that week differs: moved (`day`, `minute`), `cancelled`, or the caravan's picks (`coach_uid`/`coach_name`, `second_kind`/`second_uid`/`second_name`). Keyed by `(entry_id, week)`, where `week` is the Monday the plan puts it in, so a moved week keeps its picks and a changed weekly day keeps every week's row.
  - Checks in SQL: the second seat is one kind (`vip` or `guardian`), one uid and one name, all set or all empty; the Coachman and the second seat are two different uids; a moved row has both day and minute.
- **`lib/private`**:
  - `calendar-model.ts` (pure): `KINDS`, `LEVEL_MAX`, `ELIXIR_WINDOWS`; the zod schemas `newEntry` and `fieldChange` (the second seat is `{kind, uid}`, so a VIP and a Guardian together cannot be sent); `fits` (a level only for Cheese Trap and Undead Siege, picks only for the caravan, an Elixir time only in a window, a weekly slot only for a weekly entry); `inPlan` and `layOut` (the weekly expansion, moves in and out, cancels).
  - `calendar-time.ts` (pure, browser-safe): server days, `parseTime`, `zonedInstant` (server day + minute → instant), `clockIn` (instant → a zone's time and day shift), `offsetLabel`.
  - `calendar.ts`: `calendarDays`, `pickableMembers` (uid and name only, from 11n's `latestRoster`), `createEntry`, `editEntry`, `removeEntry`.
  - `calendar-words.ts`: titles as the game writes them ("Cheese Trap I · Lv.7", "Elixir Scramble · Team A"), dates, and the 409 sentence.
  - `dictionary.calendar.ts`, `.pt-BR.ts`, `.fr.ts`: 119 keys under `calendar.*` per language, spread into the three workspace dictionaries (one line each, at the top of each object).
- **`lib/repo/calendar.ts`**: the reads and writes, each inside one workspace; `officerNames` returns the chosen name, else the Discord name (11n).
- **Route** `POST /api/w/[slug]/calendar` (`app/(private)/api/w/[slug]/calendar/route.ts`): `create`, `edit` (a list of field changes, each with the version the officer saw) and `delete` (`all`, `one`, `after`). Same origin and JSON only (403), zod-parsed (400), a session of this workspace (401). A stale field answers 409 `{code: "stale", conflicts: [{field, version, said}]}`. Every answer is `private, no-store`. Nothing is logged.
- **Concurrency**: edits are field-level. Each field carries its version; the save locks the entry (and the week's row) and compares each sent version with the stored one. Any mismatch refuses the whole save, writes nothing, and returns, per stale field, its newer value, who changed it and when: "Ana (R4) changed the level to “Lv.8” 12 seconds ago.". "Keep theirs" resends the other fields only; "Use mine" resends with the newer version. Two officers changing different fields both keep their change.
- **Freshness**: both views read the page again when it comes back into view (`visibilitychange`), the #293 rule.
- **Shell**: the Calendar tab is a link to `/w/[slug]/calendar` (`Frame.tsx`, one line in `PATHS`).
- **Docs**: `docs/ARCHITECTURE.md` (the calendar modules), `docs/GLOSSARY.md` (calendar entry, occurrence, ST).
- **Tests**:
  - `lib/private/calendar-time.test.ts` (2): ST → instant → a viewer in UTC−3 (São Paulo) and in UTC+2 (Johannesburg), with the next-day and day-before shifts and "UTC−2"; the time formats officers type and Monday weeks.
  - `lib/private/calendar.test.ts` (5, PGlite):
    1. `for_members` is off unless switched on;
    2. a weekly entry repeats; one week moves (also into the next week), one is skipped, the weeks after one are ended, and an "every week" day and time change leaves the moved weeks where they were put;
    3. the Coachman + (VIP xor Guardian) rule: switching the seat to Guardian replaces the VIP; the Coachman cannot be the second seat; a member of another alliance or an unknown uid is refused; the schema refuses a VIP and a Guardian together and any other kind; picks on a Cheese Trap are refused;
    4. the 409: a stale `level` returns Ana's value, version, name and time, and nothing of the refused save is written; a different field alone goes through, then the retry with the newer version;
    5. two tenants (D71): NSE's officer neither sees nor edits nor deletes an OGs entry.

## Decisions
- **Series plus per-week rows, laid out on read.** An entry is the plan; a week's row holds only what differs that week. Moves are always per week (a one-off is moved through its week's row too), so its picks follow it, and an "every week" change reaches every week that was not moved. Nothing is written when a page is read.
- **Versions live in each row** (`edits`: per field its version, who and when), not in an append-only history table. The check is per field and the save is all or nothing in one transaction. A refused save writes nothing, so no version is lost. (#293 asks for append-only rows "where the history keeps both versions"; the brief asked for the field-level check and the 409 with the newer value. See Deviations.)
- **The caravan's second seat is one column set** (`second_kind`, `second_uid`, `second_name`): "VIP and Guardian together" cannot be stored, sent (zod) or shown. Switching VIP ↔ Guardian with a member seated moves that member to the other kind in one write; with nobody seated it only changes which kind "Choose" fills.
- **Picks store the member's name at the time of the pick** with the uid, from the server's roster, not from the browser. The uid must be in the newest roster of the workspace's own alliance.
- **Local time comes from the browser's zone**, not from D38's public `tz` cookie: that cookie means "Your time" was picked on public pages, and setting it from the workspace would change them.
- **Game names stay English in every language** (D52: the game's own word, English where unknown): Alliance Caravan, Cheese Trap I/II, Undead Siege, Elixir Scramble, Team A/B, Alliance Duel, Lv.N, and the roles Coachman, VIP, Guardian. The copywriter's pt/fr proposals (Cocheiro, Guardião, Cocher, Gardien) are unverified as game text (`copy/naming.md` §3). The sub-nav's "Caravanas" / "Caravanes" is a common noun from `copy/strings.json`.
- **Levels show as "Lv.7"**, the game's own prefix (D52), the same in every language.
- **The Elixir Scramble day is not fixed to Friday**: the form defaults to the day chosen and offers only the three windows (09:00, 18:00, 23:00 ST, confirmed by the owner on 2026-11-16).
- **The daily Alliance Duel themes are a muted line, not entries** (owner, 2026-11-16: "if easy, yes; otherwise keep it secondary"). Under each day's heading in the Week view: "AD day: Raven" ("Dia do AD", "Jour d’AD"). The names are the game's English (D52) from a fixed weekday map, `DUEL_DAYS` in `lib/private/calendar-model.ts`: Mon Raven, Tue Building, Wed Research, Thu Heroes, Fri Training, Sat Raid, Sunday none. No table, not editable; the weekly theme ("economy week") stays an entry.
- **One Alliance Duel theme per week**: the add sheet hides that kind when the week has one, and a second one answers 409 `theme_exists`.
- **Words**: `calendar.*` only, in separate files, so `dictionary.ts` stays under its 300-line limit and the parallel sessions' key additions do not collide.

## Deviations
- **No append-only edit history** (#293's "a new row per change, the history keeps both versions"). Versions, who and when are kept per field in the row; older values are not kept. "Use mine" overwrites after the officer has seen the newer value. Adding a `calendar_changes` log is one table and one insert inside the existing transaction.
- **No merge option for notes** (#293: "free text: both texts"). Notes offer Keep theirs / Use mine like every other field.
- **No registration deadline on Elixir Scramble entries** (#300 comment: "an Elixir entry carries its team, its 30-minute window and the registration deadline"). Owner, 2026-11-16: registration closes on Wednesday or Thursday; which one is pending his confirmation. Add it once confirmed (a fixed weekday and time, like `DUEL_DAYS`).
- **No caravan suggestions** (prototype `car.cand`, #300's first text): the brief and D75 ("not a ranking") replace them with a roster search.
- **No event icons**: the month overview and the agenda use text. The brand proposal's drawn icons (`scratchpad/brand/icons/`) cover five of the seven kinds.
- **No per-tab tip for Calendar** (#312 panel, 11e's adjustments): FirstUse.tsx is shared shell code; the brief did not list it.
- **The migration was renumbered three times**: built as `0020_calendar`, then `0021` (after 11n's `0020_workspace_user_profile`), `0022` (after 11i's `0021_notices`), and now **`0024_calendar`** after 11f's `0022_member_facts` and 11j's `0023_thefts` (snapshot `prevId` = 0023's id; it creates only the two calendar tables). If another migration lands first: drop `drizzle/0024_calendar.sql`, `drizzle/meta/0024_snapshot.json` and its journal entry, merge `dev`, run `pnpm db:generate --name calendar`.
- **Notices became a Calendar view** (coordinator, after 11i landed with a sixth bottom tab): the bottom bar is back to five tabs (`Frame.tsx`: `TABS`, `grid-cols-5`, comments); 11i's three notices pages pass `current="days"`, and the list page shows the sub-nav with Notices open. Nothing else in 11i's files changed. 11i's megaphone path stays in `TabIcon.tsx`, unused by the bar.
- **Thefts became the fourth Calendar view** (coordinator, after 11j landed): the sub-nav reads Week · Caravans · Notices · Thefts (`thefts.nav`); the thefts page already passed `current="days"` and now shows the sub-nav with Thefts open; 11j's temporary Home card and its two words (`thefts.home`, `thefts.homeOpen`) are removed. The thefts code uses the one viewer clock: `useViewerZone` from `YourTime.tsx` and `clockIn` for the day comparison inside its `viewerClock` (same output). 11j's `serverInstant` stays in `lib/schedule.ts` for its server-side reads.
- **Tab labels** (`Frame.tsx`): 12 px, `overflow-wrap: normal` and less side padding, so a word never breaks inside itself; a two-word label may take two lines. PT "Acompanhar" now stays whole at 360 px (it broke as "Acompanh / ar" after 11i). Checked in EN, PT and FR.
- **11n's roster read**: the first version used 11n's `latestRosterNames`; after merging `dev` it uses `latestRoster` and keeps only uid and name for the picker (no might or rank reaches the browser).

## Verified
- **`pnpm check` exits 0** after merging `dev` at 7b90d4d (11n, 11i, 11f, 11j and the public PRs): prettier, eslint, tsc; vitest **126 files passed, 2 skipped; 627 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". No test timed out. Earlier rounds: 99 files / 502 tests before any merge; 118 files / 592 tests after the 11i merge.
- **New tests**: `calendar-time.test.ts` 2, `calendar.test.ts` 5 (see Built). All passed on the first run.
- **Local e2e** against a production build (`pnpm build` + `next start` on :3167) of the final merged tree:
  - setup: db:local on 54367 with its bridge on 54368, migrated through `0024_calendar`; the Discord stub on 54387 with two officers, Ana (R4) and Bo (R4); the seed: the OGs and NSE workspaces and OGs' newest roster with the 101 uids and names of the scrubbed fixture; a worktree-only `.env.local` with random secrets (never printed) and the upstream on a dead port; playwright-core with system Chrome. Ana's browser is in `America/Sao_Paulo` (UTC−3), Bo's in `Africa/Johannesburg` (UTC+2);
  - no upstream call, no real Discord call, no `/api/quota`;
  - **95 of 95 checks passed** on the final merged build (earlier rounds: 86 of 86 after the 11i merge, 87 of 87 with the daily Alliance Duel line). Added in the last round: Thefts as the fourth view (sub-nav order, Thefts open, Calendar tab open, no sideways scroll), Home without the thefts card, and the bottom-tab labels in EN, PT and FR at 360 px (each fits its tab, a one-word label stays on one line). The first run of this round failed one old check that still expected three views; it was updated and the rerun passed all 95:
    - the Calendar tab is a link and the open one; the sub-nav reads Week · Caravans · Notices with Week open; Notices links to `/w/ogs/notices`; the legend says "ST is server time, the game’s clock (UTC−2)" and "KvK = Kingdom War.";
    - "25:00" is refused beside the field and nothing is saved; typing 16:00 shows "15:00 your time" in the sheet;
    - every type created through the sheet and shown: Alliance Caravan (every week), Cheese Trap I · Lv.7, Cheese Trap II · Lv.7, Undead Siege · Lv.4, Elixir Scramble · Team A (18:00–18:30 ST) and Team B (23:00–23:30 ST), KvK with a note, the Alliance Duel theme (stored on its Monday), Prettiest pet vote with a link and "Show to members";
    - `for_members` stored false for the eight others and true for the pet vote; only that entry says "Shown to members"; the link has `rel="noreferrer nofollow"`;
    - ST and local: Ana sees "16:00 ST · 15:00 your time" and 23:00 ST as 22:00 the same day; Bo sees "16:00 ST · 20:00 your time" and "23:00–23:30 ST · 03:00 your time (+1 d)";
    - the 409: both open Cheese Trap I; Ana saves Lv.8; Bo's Lv.9 plus a note is refused with "Ana (R4) changed the level to “Lv.8” now.", nothing of it written; "Use mine" then saves Lv.9 and the note; a raw POST with version 0 answers 409 `stale` with "Lv.9" and `private, no-store`;
    - weekly repeat: next week shows Monday 16:00; one-offs do not repeat; moving only next week to Tuesday 20:00 (scope defaults to "Only the week of …") shows "20:00 ST · 19:00 your time" and "Moved from Mon, Nov 23 16:00 ST"; this week and the week after keep Monday 16:00;
    - caravan picks: Coachman and VIP chosen through the search; switching to Guardian moves the same member (`guardian | beazord` in the row, the radio stays on Guardian); the Coachman shows as not choosable for the second seat; a raw POST with a VIP and a Guardian together answers 400;
    - five bottom tabs and no Notices tab; on `/w/ogs/notices` the Calendar tab is open and the sub-nav has Notices open;
    - no sideways scroll on Week and Caravans at 360 and 1280, light and dark, EN and PT, and on notices at 360; every target in main and the navs is at least 44 px at 360;
    - PT: Agenda, "Semana Caravanas Avisos", "ST é a hora do servidor", "15:00 sua hora"; FR: "Semaine de l’Alliance Duel (AD) : economy week" with U+00A0, "15:00 votre heure";
    - the month overview shows at 1280 and is hidden at 360;
    - the server log holds no officer name and no entry text.
  - The first run of the harness failed 2 checks that read the page before the refresh after the last save; the wait was fixed in the harness. One real fix came out of it: the VIP | Guardian choice now shows at once instead of after the refresh.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11h-shots/`: `week-` and `caravans-{360,1280}-{light,dark}-{en,pt-BR}.png`, `week-360-light-fr.png`, `add-360-light-en.png`, `conflict-360-light-en.png`, `picker-360-light-en.png`, `week-moved-360-light-en.png`, `caravans-360-light-en.png`, `notices-360-light-en.png`; with the daily Alliance Duel line: `week-360-{light,dark}-{en,pt-BR}-v2.png`; on the final build: `week-` and `thefts-360-{light,dark}-{en,pt-BR}-v3.png`.

## Open issues
1. **Past weeks follow "every week" changes**: a changed weekly day or time also moves the plan's past weeks. Nothing reads past weeks yet; a results feature (#298) may want the time an event actually ran.
2. **A deleted officer's name** in a 409 reads "Another officer" (the `created_by` and `edits.by` ids stay).
3. **The month overview does not mark the week shown**, only today.
4. **`next start` does not send the PostHog key**, so no calendar event is tracked; no new analytics event was added (D77's list is closed).
5. **Picks keep the name at the time of the pick**: a member who renames in the game shows the old name on that week's caravan until re-picked.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`. The calendar unblocks #331 (members' board) and the Elixir Scramble teams and roll call in #298.
Model / effort: keep — the model, the two views and the 409 fit one pass; the rework came from two merges (11n, 11i) and the Notices tab move, not from the task.
Owner must do first: nothing for this PR. Pending from the owner: the Elixir Scramble registration day (Wednesday or Thursday). The Coachman / VIP / Guardian words in pt and fr are being researched by the coordinator; they stay English under D52 until then (one value per key in `dictionary.calendar.pt-BR.ts` and `.fr.ts`).
Plan changes needed: none. The workspace track lives in issues #293–#331, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Calendar data for other screens: `calendarDays(db, access, from, to)` in `lib/private/calendar.ts` returns `Placed[]` (entry, week, day, minute, moved, the week's row) for whole weeks; `agendaItem` in `app/(private)/_ui/calendar-data.ts` turns one into words.
- #331 (members' board): filter `Placed` by `entry.forMembers`. Strip `notes` and `link` of strategy only if the owner asks; the flag is per entry, for every week. Show times with `YourTime` / `clockIn`.
- #298 (Elixir teams, roll call): an Elixir Scramble entry is `kind = 'elixir'`, `variant` 'A' or 'B', `minute` one of `ELIXIR_WINDOWS` (540, 1080, 1380). A team list per week can key on `(entry_id, week)` like `calendar_occurrences`.
- Writes elsewhere in the workspace can reuse the pattern: per-field versions in an `edits` jsonb (`{v, by, at}`), the row locked in a transaction, the 409 body `{code: "stale", conflicts: [{field, version, said}]}`, and `ConflictBox` (`CalendarFields.tsx`) for Keep theirs / Use mine.
- Roster pickers: `RosterPicker.tsx` (search by name key, the taken member disabled) takes any `{uid, name}[]`.
- Sub-nav: `CalendarNav.tsx`, four views; a fifth is one line in `VIEWS` (the columns follow its length).
- Clocks: one implementation, `lib/private/calendar-time.ts` + `YourTime.tsx`; the thefts log uses them too. The workspace-wide server-time / my-time switch and each member's local time are planned for the Members-list session (#337) on top of these: `zonedInstant` (server day + minute → instant), `clockIn` (instant → a zone's time and day shift), `offsetLabel`, `useViewerZone` (the browser's zone after hydration) and `yourTime`. Not built here.
- Migration: `0024_calendar`, on top of `0023_thefts`.
- `dictionary.ts` grows by one spread line per feature; the calendar's 119 keys per language are in `dictionary.calendar*.ts`.
</adjustments>

PR: (added by the orchestrator)
