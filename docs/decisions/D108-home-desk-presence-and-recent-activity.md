## D108 — Home: who is on the desk now, and what officers did lately (2026-11-17, owner-approved, 11aa, issue 335)

The owner asked to "say which leader is online". Home now shows two things: the other officers on the desk now, and a short feed of what officers did. Both follow D75: they are about the work, not about watching people.

### On the desk now

- **Source.** Officer sessions only. `workspace_sessions.seen_at` (new, nullable) is the time of the session's last desk request. `requireWorkspace` writes it after the session passes its checks. It writes only when the stored time is more than a minute old (`SEEN_EVERY_MS`). The update also checks that condition in SQL, so a session writes at most once a minute however many requests it makes.
- **Who counts.** A session of this workspace, tier `officer`, seen in the last 10 minutes (`ON_DESK_MS`), not ended, and its account not blocked. The officer looking is left out. A member's session on the members' board never counts: `requireBoard` does not write `seen_at`, and the read filters on tier. The game's `online` flag is not used.
- **Shape.** One line under the Home title: "On the desk now · Ana and Wren" (names through `isolate()`, joined with `Intl.ListFormat`), or "On the desk now · Nobody else right now.". There is no "who hasn't signed in" and no last-seen time per person.

### Recent activity

- **Sources.** Only the histories that already exist. No new logging table. Each source gets one bounded read: the newest 40 actions of the last 14 days. All reads run at once and are merged in memory. Names are resolved in three more reads (officers, members, notice titles), never one read per line.
  - member facts (`member_facts`): one line per save (same officer, same instant). "Ana updated Bramble's info", or "… the info of 12 members" for a batch such as a sheet import;
  - notices: saves (`notice_edits`, one line per save of any number of fields) and posts to Discord (`notice_publishes`, status `posted`), with the notice's current title;
  - saved screenshot drafts (`screenshot_drafts`, status `saved`), with the kind's label;
  - calendar entries added (`calendar_entries.created_by`), with the entry's title. Edits of an entry are not in the feed: they live in a jsonb field, not in a history table;
  - roll call marks (`roll_call_marks`). Marks one officer wrote at one instant are one action. More than one mark at one instant reads "marked the rest of the roll call". Single taps by one officer on one roll call within the same clock hour are one line ("marked the roll call"). There is never one line per member, and undo rows (mark null) are left out;
  - follow-up records (`member_follow_ups`, not `withdrawn`): "Ana added a follow-up note for Bramble". The action (talked, break, help, fine) is not shown, because a break or Needs help is a member status;
  - thefts added (`thefts`): "added a theft to the log" or "added 3 thefts to the log", with no attacker, victim or note;
  - new members added by hand (`pending_members`): "added the new member Bramble".
- **One line per action.** A draft save also writes facts, thefts and new members, and a follow-up writes facts, all by the same officer at the same instant. The higher action stands for them: draft, then follow-up, then new member, then the rest. The same line repeated in a row (same officer, same action, same object) is shown once, at its newest time.
- **Privacy.** Lines name the officer and what they worked on: a member's name, a notice's title, a calendar entry's title, a screenshot's kind. They never show a member field's value, a follow-up note, a theft's note, attacker or victim. Every name and title goes through `isolate()`.
- **People first (D75).** Newest first, never grouped or counted per officer, no ranking. An officer whose account is gone (null author) is left out, not shown as "someone".
- **Time.** "5 minutes ago" etc., from the existing `agoText` (`Intl.RelativeTimeFormat`), "just now" under a minute.
- **Show more.** The first 15 lines show. The rest, up to 40, sit under "Show more", a `<details>` that works without script; there is no further paging. Before anything happened: "Nothing in the last two weeks."
- **Indexes** (migration `0035_desk_activity`): `member_facts (workspace_id, written_at)`, `notice_edits (workspace_id, edited_at)`, `member_follow_ups (workspace_id, written_at)`, `thefts (workspace_id, created_at)`, `roll_call_marks (written_at)`. The other sources are small (notice publishes, drafts kept 7 days, calendar entries, pending members) and keep their workspace indexes.

### Order on Home

Title → "On the desk now" line → Today and tomorrow → Members this week → To review → Recent activity.

- The presence line is one line of small text. Under the title it costs about 24 px and answers "is anyone else here?" before the officer acts.
- Today and tomorrow and To review are what an officer acts on, so they stay where they were.
- The feed is context, not a task. It goes last, so its 15 lines never push a task down. On a phone it is a scroll away, which suits a "what happened while I was away" read.

### Not done

- No feed of calendar edits, notice deletions, roll call additions, theft follow-up states or member-board views.
- No live refresh: both parts are as of the page load.
