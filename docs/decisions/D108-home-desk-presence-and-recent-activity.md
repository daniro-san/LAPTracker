## D108 — Home: who is on the desk now, and what officers did lately (2026-11-17, owner-approved, 11aa, issue 335)

The owner asked to "say which leader is online". Home now shows two things: the other officers on the desk now, and a short feed of what officers did. Both follow D75: they are about the work, not about watching people.

### On the desk now

- **Source.** Officer sessions only. `workspace_sessions.seen_at` (new, nullable) is the time of the session's last desk request. `requireWorkspace` writes it after the session passes its checks. It writes only when the stored time is more than a minute old (`SEEN_EVERY_MS`). The update also checks that condition in SQL, so a session writes at most once a minute however many requests it makes.
- **Who counts.** A session of this workspace, tier `officer`, seen in the last 10 minutes (`ON_DESK_MS`), not ended, and its account not blocked. The officer looking is left out. A member's session on the members' board never counts: `requireBoard` does not write `seen_at`, and the read filters on tier. The game's `online` flag is not used.
- **Shape.** One line under the Home title: "On the desk now · Ana and Wren" (names through `isolate()`, joined with `Intl.ListFormat`), or "On the desk now · Just you." (PT "Na Mesa agora · Só você.", FR "Au bureau maintenant · Il n’y a que vous."). There is no "who hasn't signed in" and no last-seen time per person.

### Recent activity

- **Sources.** Only the histories that already exist. No new logging table. Each source returns at most its newest 40 actions of the last 14 days, and the results are merged in memory.
- **Queries per Home open (review, 2026-11-17).** Five reads at once:
  - member facts;
  - calendar edits;
  - roll call marks;
  - thefts;
  - the six small sources (notice saves, notice posts, saved drafts, calendar entries added, new members, follow-ups) in one `union all`.

  Then three more at once to resolve names (officers, members, notice titles), never one read per line. That is 8 feed queries, at most 5 in flight, beside Home's other reads; the first build had 10 at once against a pool of 10.

- **The bound is on rows returned, not rows scanned.** `limit 40` caps what each part returns. The grouped parts (facts, notice saves, thefts, roll call marks) and the calendar `jsonb_each` read still scan every row of the workspace inside the 14-day window (all entries and week rows for calendar edits) before they limit. The time indexes keep those scans to the window.
  - member facts (`member_facts`): one line per save (same officer, same instant). "Ana updated Bramble's info" (PT "editou os dados de", FR "a modifié la fiche de");
  - notices: saves (`notice_edits`, one line per save of any number of fields) and posts to Discord (`notice_publishes`, status `posted`), with the notice's current title;
  - saved screenshot drafts (`screenshot_drafts`, status `saved`), with the kind's label. A draft whose source is `pasted` (Members' "Paste updates", D109) reads "Ana pasted member updates" instead of "saved a screenshot";
  - calendar entries added (`calendar_entries.created_by`), with the entry's title;
  - calendar entries changed (owner, 2026-11-17): "Ana changed the Calendar entry 'Undead Siege · Lv.5'". There is no history table; each field of an entry and of its week rows keeps its last writer and time in `edits` (`{v, by, at}`, the 409 check of issue 293). The read expands those stamps (`jsonb_each`) for the workspace's entries and week rows, newest 40 in the window. A save of several fields is one line. Only the newest change of each field exists, so a change that a later one overwrote is not shown. The read is not index-bound: it expands every entry and week row of the workspace (dozens to a few hundred rows);
  - roll call marks (`roll_call_marks`). Marks one officer wrote at one instant are one action. More than one mark at one instant reads "finished the roll call". Single taps by one officer on one roll call within the same clock hour are one line ("took the roll call"). There is never one line per member, and undo rows (mark null) are left out;
  - follow-up records (`member_follow_ups`) name the choice (owner, 2026-11-17): "Ana talked to Bramble", "Ana marked Bramble on a break until Nov 24" (the last day away stored; PT "colocou Bramble em pausa até 24/11"), "Ana marked Bramble as needing help", "Ana noted Bramble is fine". Never the note. An unknown member reads "a member". A `withdrawn` row, and the record an Undo cancelled (the record right before it, D104), are both left out;
  - thefts added (`thefts`): "added a theft to the log" or "added 3 thefts to the log" (PT "anotou um roubo no registro"), with no attacker, victim or note;
  - new members added by hand (`pending_members`): "added Bramble as a new member".
- **One line per action.** A draft save also writes facts, thefts and new members, and a follow-up writes facts, all by the same officer at the same instant. The higher action stands for them: draft, then follow-up, then new member, then the rest. The same line repeated in a row (same officer, same action, same object) is shown once, at its newest time.
- **Grouping (persona panel, 2026-11-17).** One officer's consecutive lines of a noisy verb become one line at the newest time:
  - member info saves: "Ana updated 9 members", counting distinct members, plus the members of batch saves;
  - thefts added: "added 4 thefts to the log";
  - new members added: "added 2 new members".

  Any other line in between ends the run, so a notice post, a roll call, a break or a calendar change is never folded away.

- **Saved drafts outlive their 7 days (review, 2026-11-17).** A draft save's facts, thefts and new members hide behind the draft's line because they share its officer and instant. `dropExpired` deleted every draft at 7 days, so from day 8 those rows would have come back as separate lines, and the draft's line would have gone early. Now `dropExpired` does three things:
  - it deletes open and discarded drafts at 7 days, as before;
  - at 7 days, it empties a saved draft's OCR text and rows (`pages`, `rows`);
  - it keeps the saved draft's row (kind, scope, who, when) until 14 days after the save (`SAVED_DRAFT_KEEP_MS`, which is also the feed's window).

  I chose this over a dedupe without the draft row: without that row, an Alliance Duel save has no other line in the feed and would vanish. D96 has the matching amendment.

- **Privacy.** Lines name the officer and what they worked on: a member's name, a notice's title, a calendar entry's title, a screenshot's kind. They never show a member field's value, a follow-up note, a theft's note, attacker or victim. Every name and title goes through `isolate()`.
- **People first (D75).** Newest first, no ranking, no totals per officer. A grouped line counts the members of one run of work, not an officer's output. An officer whose account is gone (null author) is left out, not shown as "someone".
- **Time.** "5 minutes ago" etc., from the existing `agoText` (`Intl.RelativeTimeFormat`), "just now" under a minute.
- **Show more.** The first 6 lines show (persona panel, 2026-11-17; it was 15). The rest, up to 40, sit under "Show more", a `<details>` that works without script; there is no further paging. Before anything happened: "No activity yet. Saved notices, roll calls and calendar changes show up here."
  - Amendment (2026-11-18, 11al, issue 410): **paging, Show less and runs.**
    - **Pages.** Home renders the first 6 lines on the server, as before. "Show more" is now a button that reads the next 20 lines (`ACTIVITY_PAGE`) from `GET /api/w/[slug]/activity?before=<ms>`: an officer's session through `requireWorkspace`, 401 `signed_out` without one (D99), no-store, nothing logged, the lines made in the officer's language. It goes on until the 14-day window ends; there is no 40-line cap any more. "Show less" goes back to the first 6 lines and moves the focus to "Show more", so the page does not jump. Both are 44 px buttons side by side under the list.
    - **Cursor, not offset.** Every source reads its newest 40 rows before the cursor, each part bounded in SQL (`< before`; a roll call's hourly line falls on one side by its newest mark, whole). Below the oldest row of a source that returned 40, rows may be missing, so a page keeps only lines newer than that. The cursor is the oldest action the page's last line stands for, its repeats and its run included, and a page never ends inside one instant, so a page has no line twice and misses none. When a source was read short and the read ran out, the last line waits for the next page, so a run that the read cut off comes back in one piece. A run longer than one source read (about 39 actions) is the exception: it is the page's only line, so it shows as two lines on two pages ("added 39 entries", then "added 11 entries"), each action once. A page with no line newer than that point goes on from it, so paging never stops early. The route answers 400 for a cursor after the year 9999.
    - **Runs.** One officer's consecutive lines of the same kind on the same server day (`SERVER_TZ`) are one line at the newest time; any other line in between, another officer's included, ends the run. The grouped kinds: member info saves ("Ana updated 9 members"), thefts added, new members added (as before), and now calendar entries added ("Rook added 6 entries to the Calendar", PT "Rook adicionou 6 itens à Agenda", FR "Rook a ajouté 6 entrées à l’agenda"), calendar entries changed ("changed 3 Calendar entries"), notice saves ("saved 4 notices") and saved screenshots ("saved 2 screenshots"). These four count the lines the run opens to. A run line is a `<details>` (44 px summary, ▾) that opens its own lines in place, each with its time, and works without script. Posts, deletes and restores (D118), roll calls, follow-ups, reviews, the thanks and notice pictures (D119) are never folded into a run. The "Grouping" rule above now also ends a run at the server day's end.
- **Officer names** are the name each officer chose in the desk (or Discord's), as everywhere in the desk. The feed adds no rank tag. A "(R4)" seen in review was part of a seeded chosen name.
- **Notice deletions** (owner, 2026-11-17): notices cannot be deleted today. There is no delete route, repo function or soft-delete column, so there is nothing to record and no table was added. If a delete is built, the least invasive record is a small append-only row (who, when, the title at the time) written by that delete.
  - Amendment (2026-11-18, 11aj, issue 411, D118): a delete now exists, as a soft delete on the notice's row (who, when, the delete's request id; the title stays in its edits). The feed has two more small sources, notices deleted and notices restored from the trash, and reads "Ana deleted the notice “…”" and "Rook restored the notice “…”". An undone delete has no line.
  - Amendment (2026-11-18, 11ak, issue 419, D119): another small source, notice pictures added or replaced (`notice_pictures.added_by`/`added_at`, the current picture per notice), reads "Ana added a picture to “…”". A removal has no line.
  - Amendment (2026-11-19, 11am, issue 424, D120): roll calls deleted and archived are two more small sources and read "Ana deleted the roll call “KvK shield”" and "Ana archived the roll call “…”". A deleted roll call's marks are in no line. An undone delete or an unarchived roll call has no line.
  - Amendment (2026-11-19, 11an, issue 423, D121): garrison plans saved and posted to Discord are two more small sources (`garrison_plans.saved_by`/`saved_at` and `posted_by`/`posted_at`), paged with the same cursor, never grouped, and read "Ana changed the garrison plan for “Undead Siege · Lv.6”" and "Ana posted the garrison plan for “…” to Discord". A plan keeps only its last save, so an earlier save is not listed; a suggestion stored only so it could be posted has no save line.
- **Indexes** (migration `0037_desk_activity`): `member_facts (workspace_id, written_at)`, `notice_edits (workspace_id, edited_at)`, `member_follow_ups (workspace_id, written_at)`, `thefts (workspace_id, created_at)`, `roll_call_marks (written_at)`. The other sources are small (notice publishes, saved drafts kept 14 days, calendar entries, pending members) and keep their workspace indexes.

### Order on Home

Title → "On the desk now" line → Today and tomorrow → Members this week → To review → Recent activity.

- The presence line is one line of small text. Under the title it costs about 24 px and answers "is anyone else here?" before the officer acts.
- Today and tomorrow and To review are what an officer acts on, so they stay where they were.
- The feed is context, not a task. It goes last, so its 6 lines never push a task down. On a phone it is a scroll away, which suits a "what happened while I was away" read.

### Not done

- No feed of calendar entry deletions, roll call additions, theft follow-up states (owner: not this round) or member-board views.
- No live refresh: both parts are as of the page load.

**Amendment 2026-11-19 (D123, issue 427).** Three more lines, each never grouped and each bound by the page cursor: a Calendar entry deleted, a theft deleted (never whose or by whom) and a new member removed. A deleted Calendar entry's add, edit and garrison lines, a deleted theft's add line and a removed new member's add line leave the feed; an Undo brings them back.
