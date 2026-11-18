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
- **Officer names** are the name each officer chose in the desk (or Discord's), as everywhere in the desk. The feed adds no rank tag. A "(R4)" seen in review was part of a seeded chosen name.
- **Notice deletions** (owner, 2026-11-17): notices cannot be deleted today. There is no delete route, repo function or soft-delete column, so there is nothing to record and no table was added. If a delete is built, the least invasive record is a small append-only row (who, when, the title at the time) written by that delete.
  - Amendment (2026-11-18, 11aj, issue 411, D118): a delete now exists, as a soft delete on the notice's row (who, when, the delete's request id; the title stays in its edits). The feed has a seventh small source, notices deleted, and reads "Ana deleted the notice “…”". An undone delete has no line.
- **Indexes** (migration `0037_desk_activity`): `member_facts (workspace_id, written_at)`, `notice_edits (workspace_id, edited_at)`, `member_follow_ups (workspace_id, written_at)`, `thefts (workspace_id, created_at)`, `roll_call_marks (written_at)`. The other sources are small (notice publishes, saved drafts kept 14 days, calendar entries, pending members) and keep their workspace indexes.

### Order on Home

Title → "On the desk now" line → Today and tomorrow → Members this week → To review → Recent activity.

- The presence line is one line of small text. Under the title it costs about 24 px and answers "is anyone else here?" before the officer acts.
- Today and tomorrow and To review are what an officer acts on, so they stay where they were.
- The feed is context, not a task. It goes last, so its 6 lines never push a task down. On a phone it is a scroll away, which suits a "what happened while I was away" read.

### Not done

- No feed of calendar entry deletions, roll call additions, theft follow-up states (owner: not this round) or member-board views.
- No live refresh: both parts are as of the page load.
