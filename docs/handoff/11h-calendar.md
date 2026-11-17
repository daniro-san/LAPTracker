# 11h — Calendar tab: week agenda, caravan picks, server and local time

Part of #300 (the Calendar, with caravans and open events) and #293. It builds the `for_members` flag that #331 (the members' board) reads later. Rules applied: D71, D73, D75, D77, D52, D38. No new decision.

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
- **Model** (`lib/schema-calendar.ts`, re-exported from `lib/schema.ts`, migration `drizzle/0021_calendar.sql`):
  - `calendar_entries`: one plan. `day` is its first server day, `minute` its server time (null only for the theme), `weekly`, `last_week` (a one-off: its own Monday; weekly: null, or the last week after "this week and every week after"), `for_members` (default false), `kind`, `variant` (I/II, A/B), `level`, `title`, `notes`, `link`, `created_by`, and `rev` + `edits` (per field: version, who, when). A partial unique index allows one Alliance Duel theme per workspace and week.
  - `calendar_occurrences`: one week of an entry, written only when that week differs: moved (`day`, `minute`), `cancelled`, or the caravan's picks (`coach_uid`/`coach_name`, `second_kind`/`second_uid`/`second_name`). Keyed by `(entry_id, week)`, where `week` is the Monday the plan puts it in, so a moved week keeps its picks and a changed weekly day keeps every week's row.
  - Checks in SQL: the second seat is one kind (`vip` or `guardian`), one uid and one name, all set or all empty; the Coachman and the second seat are two different uids; a moved row has both day and minute.
- **`lib/private`**:
  - `calendar-model.ts` (pure): `KINDS`, `LEVEL_MAX`, `ELIXIR_WINDOWS`; the zod schemas `newEntry` and `fieldChange` (the second seat is `{kind, uid}`, so a VIP and a Guardian together cannot be sent); `fits` (a level only for Cheese Trap and Undead Siege, picks only for the caravan, an Elixir time only in a window, a weekly slot only for a weekly entry); `inPlan` and `layOut` (the weekly expansion, moves in and out, cancels).
  - `calendar-time.ts` (pure, browser-safe): server days, `parseTime`, `zonedInstant` (server day + minute → instant), `clockIn` (instant → a zone's time and day shift), `offsetLabel`.
  - `calendar.ts`: `calendarDays`, `pickableMembers` (uid and name only, from 11n's `latestRoster`), `createEntry`, `editEntry`, `removeEntry`.
  - `calendar-words.ts`: titles as the game writes them ("Cheese Trap I · Lv.7", "Elixir Scramble · Team A"), dates, and the 409 sentence.
  - `dictionary.calendar.ts`, `.pt-BR.ts`, `.fr.ts`: 118 keys under `calendar.*` per language, spread into the three workspace dictionaries (one line each, at the top of each object).
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
- **The Elixir Scramble day is not fixed to Friday**: the form defaults to the day chosen and offers only the three windows.
- **One Alliance Duel theme per week**: the add sheet hides that kind when the week has one, and a second one answers 409 `theme_exists`.
- **Words**: `calendar.*` only, in separate files, so `dictionary.ts` stays under its 300-line limit and the parallel sessions' key additions do not collide.

## Deviations
- **No append-only edit history** (#293's "a new row per change, the history keeps both versions"). Versions, who and when are kept per field in the row; older values are not kept. "Use mine" overwrites after the officer has seen the newer value. Adding a `calendar_changes` log is one table and one insert inside the existing transaction.
- **No merge option for notes** (#293: "free text: both texts"). Notes offer Keep theirs / Use mine like every other field.
- **No registration deadline on Elixir Scramble entries** (#300 comment: "an Elixir entry carries its team, its 30-minute window and the registration deadline"). The brief listed only the windows; the deadline rule (when the in-game countdown ends) is not known.
- **No daily Alliance Duel themes** (Raven, Construction, …; prototype and #300's poster). The brief lists the weekly theme ("economy week") only, and the daily names differ between the poster and the game text (`naming.md` §3a).
- **No caravan suggestions** (prototype `car.cand`, #300's first text): the brief and D75 ("not a ranking") replace them with a roster search.
- **No event icons**: the month overview and the agenda use text. The brand proposal's drawn icons (`scratchpad/brand/icons/`) cover five of the seven kinds.
- **No per-tab tip for Calendar** (#312 panel, 11e's adjustments): FirstUse.tsx is shared shell code; the brief did not list it.
- **The migration was renumbered**: first built as `0020_calendar`; 11n's `0020_workspace_user_profile` landed first, so it was regenerated as `0021_calendar` (snapshot `prevId` = 0020's id). If 11i's `0021_notices` lands before this, it is regenerated again as `0022` (drop `drizzle/0021_calendar.sql`, `drizzle/meta/0021_snapshot.json` and its journal entry, merge `dev`, `pnpm db:generate --name calendar`).
- **11n's roster read**: the first version used 11n's `latestRosterNames`; after merging `dev` it uses `latestRoster` and keeps only uid and name for the picker (no might or rank reaches the browser).

## Verified
- (filled in after the final merge)

## Open issues
1. **Past weeks follow "every week" changes**: a changed weekly day or time also moves the plan's past weeks. Nothing reads past weeks yet; a results feature (#298) may want the time an event actually ran.
2. **A deleted officer's name** in a 409 reads "Another officer" (the `created_by` and `edits.by` ids stay).
3. **The month overview does not mark the week shown**, only today.
4. **`next start` does not send the PostHog key**, so no calendar event is tracked; no new analytics event was added (D77's list is closed).
5. **Picks keep the name at the time of the pick**: a member who renames in the game shows the old name on that week's caravan until re-picked.
6. **Thefts in the sub-nav (11j, issue 321)**: 11j was not on `dev` at this merge. `CalendarNav.tsx` has the slot marked: add `"thefts"` to `CalendarView` and `{ id: "thefts", path: "/thefts", key: "thefts.nav", keepsWeek: false }` to `VIEWS`; the columns follow the list's length. Then remove 11j's temporary Home card that links to the thefts log.
7. **Two clocks to consolidate (11j)**: 11j adds `serverInstant` to `lib/schedule.ts` and a viewer-clock hook. This branch has `zonedInstant` and `clockIn` (`lib/private/calendar-time.ts`) and `useViewerZone` / `YourTime` (`app/(private)/_ui/YourTime.tsx`), tested for UTC−3 and UTC+2. Keep these as the single ones; whoever merges second moves 11j's callers onto them.

## Next
(filled in after the final merge)

PR: (added by the orchestrator)
