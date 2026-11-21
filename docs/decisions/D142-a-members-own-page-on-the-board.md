## D142 — A member's own page on the board: "This is me" for members, links an officer sees and answers, and only the member's own data (2026-11-21, owner, issue 487; amends D71, D87, D105)

Why: the owner, 2026-11-20: give regular members a small "Me" page on the members' board. The real-data panel (product strategy) ranked it the most underserved need. D105 listed "my stats" among the board's no-gos; this amends it for the member's own data only.

**The link (reuses D87).**

- A member picks their player from the newest usable roster of the workspace's own alliance on `/w/[slug]/board/me`. The D74 matcher suggests one from the name Discord gave at sign-in (`workspace_users.display_name`: the server nickname first). A search filters the same roster in the browser. Each row shows rank and might, as in D87.
- `workspace_users.player_uid` holds the link, with `player_link` (`approved` or `pending`) and `player_linked_at` (migration `0061_member_player_links`).
- **One player per Discord user per workspace** is the row itself. **One approved link per player:** a partial unique index on `(workspace_id, player_uid)` where `player_link` is `approved`. A claim of a player another user holds with an approved link is refused with `409 taken`: "Already linked — ask an officer." A member who already has a link drops it before another claim (`409 linked`).
- **Every member's link waits for an officer's Approve** (orchestrator, 2026-11-21, on privacy grounds). It is **pending**, and nothing private shows until an officer approves it. A member can edit their own server nickname, so a name match proves nothing, and the data behind the link is that player's own private data. The first build opened a link at once when the Discord name was the game name; that is gone.
- **A pending claim reserves nothing.** When an officer approves a link, the other pending claims of that player are removed. So a false claim never locks the real player out (persona panel, adversarial).
- **Officers see every link.** Home's "To review" lists each pending link ("mossy says they are Moss Invented · R2") with Approve and Reject, and a hint from the D74 matcher on the Discord name: "Hint: the Discord name matches this game name." or "Hint: the Discord name is not this game name.", then "Asked to see their own page. Approve only when you know it is them: anyone can change their Discord nickname." The hint counts only the matcher's one match by current game name (`via: "current"`). Pending links count in the Home tab's number.
- The member card shows "Linked to Discord: <name>" (or the pending line) with Remove link, which asks first; a pending line has Approve and Reject. An officer's answer names the workspace user who holds the link, never the player, so it never reaches a later claim of the same player (`POST /api/w/[slug]/member-links {action: "approve" | "unlink", user}`, officers only, `ws_action` `member_link` / `approve` or `unlink`).
- An officer's own "This is me" (D87) is `approved` at once, and refused with `409 taken` when another user holds that player. The existing links became `approved` in the migration. Two users of one workspace that held the same player keep it on the lower id; the other's link is cleared.
- **A member who left** (not in the newest usable roster) sees "<name> is not in the alliance's newest roster, so your page is closed for now…" and nothing more; the link stays for if they come back. Their own "This isn't me" drops it.
- The member's route `POST /api/w/[slug]/me {action: "claim", uid} | {action: "drop"}` is behind the board's door (`requireBoard`), same origin, JSON. It writes only the session's own user row. It logs and counts nothing. It is excluded from the officer-route walk in `member-session.test.ts` and tested in `me/route.test.ts`.

**The door.** `requireBoard` now carries the session's link (`player: {uid, approved}`, read in the same session query, no new query) and the Discord name. `meAccess(board)` gives a branded `MeAccess` (workspace, union and the link's uid) only for an approved link. Every read of the page takes it, so the uid comes from the link and never from a request (INVARIANT `me.link-approved`). An officer previewing the board sees their own page the same way.

**What the page shows** (`lib/private/me.ts`, `me-parts.ts`, `lib/repo/me.ts`; `/w/[slug]/board/me`; EN · PT · FR):

1. **Your progress:** might and kills on each daily read of the last 30 days, two D68 line charts (shapes in SVG, the values and dates in HTML, a line under each heading: "Might 36.2M · −2.94M since Thu, Oct 22"). Then "Back to 85% of your might before KvK (Sat, Nov 14)." This compares the newest read's might with the member's might in the Start read of the newest public scheduled event of the last 30 days. It shows only once a daily read came after that event's day. At 100 % or more it reads "Fully back: 103% …". Real reads (six members, 2026-11-21) sat at 86–100 % of their 6–12-day peak.
2. **This week:** Monday to Sunday (server days), daily quest points, Alliance Help coins (against 1,000) and donations as the member card's day bars (D136). Each row has "This week: Average 550 · 4 days" and "Last week: Average 499 · 6 days", the member's own last game week. A day with no read is the no-data mark and "none" is a read that lists them with nothing (D127). Days not read yet are blank ("not read yet" for screen readers). Averages count the days with a number only (D75).
3. **Squads:** the member card's lineup (D136) with "seen" ages; "The tracker has not seen your squads yet." when none.
4. **Where you're needed** (first on phones, the margin column from 1024): their Elixir Scramble team this week, their Alliance Caravan seat this week (Coachman, VIP or Guardian), and their roll-call marks on live, unarchived roll calls from today on ("Raid prep, Sat, Nov 21: Shield up"; "… Squads off the wall"). "Nothing planned with you this week yet." when none.

**Never shown:** rankings or comparisons with others or with the alliance; officers' notes, facts, statuses or follow-ups; x, y, online, last_online_at, joined_at; avatar_url; troops; anything that reads as a score.

**Amends D71 (and the CLAUDE.md rule that follows it).** `daily_tech`, `daily_honor` and `active` reach a page behind `requireBoard`, not `requireWorkspace`: only `/w/[slug]/board/me`, and only for the one roster element of the session's own approved link, of the workspace's own alliance. raw_json is read only for that element's three daily fields, on the last two game weeks' rows. No other roster field leaves the database. Nothing is logged, cached or sent to analytics.

**Database cost.** No polling. The board page reads nothing new: its link is plain HTML. The Me page reads the door (4 parallel reads, as the board). Then it reads one roster query: the alliance's newest 40 usable rosters, only this member's array slot, raw_json only for the three daily fields of the last 14 days. Then 6 reads in parallel: KvK Start might (`member_snapshots_uid_idx`), squads, hero names, Elixir team, caravan seat, marks. Pending, picker and left read the door plus one. Home adds one read (two when links are waiting); the member card adds one. Measured on a local production build with `pg_stat_database.xact_commit`, minimum of 3: Me (approved link) 20, Me (pending, picker, left) 13, the board 19, Home 62, the member card 32. The per-request Pool still opens several connections for parallel reads, as on every page; that is the perf spec's Batch 3.

**Persona panel** (2026-11-21: technical, adversarial, a regular member, a non-English member, an R4, product strategy, a privacy/security expert; invented-data screenshots and six real `/v1/players` reads seen locally and deleted after). Verdicts: the adversarial reviewer rejected the first build; the others accepted with changes. Applied:

- pending claims reserve nothing;
- officer answers name the user;
- auto links shown to officers until confirmed (replaced the same day: every member link waits for an officer);
- the review line has the rank and the name hint;
- "Where you're needed" first on phones;
- "This week:" on the average;
- French recovery lines with a subject;
- no doubled "off the wall".

Left for follow-ups:

- the per-view raw_json scan (copy the three daily fields into arrays at write time);
- the board link naming the member;
- a limit on repeated claims after a Reject.

**Changed from the issue:** the issue asked for auto-accept when the matcher's top suggestion is the pick. The orchestrator removed it on 2026-11-21 (privacy): a nickname match is only the officer's hint.

**Tests.**

- `app/(private)/api/w/[slug]/me/route.test.ts` (issue 471 suite): a link waits for an officer even on a name match, then shows only its own data; a pending link shows nothing private; a member cannot approve their own; a false claim never locks the real player out, and a late Approve reaches nothing; changing the uid reaches nobody else's (taken, linked, another alliance's player, another workspace's session); a member who left sees nothing; an officer's Remove closes the page, and a second Remove finds nothing.
- `lib/private/me-parts.test.ts`: the week (none, no data, not read yet, the own last week), might over 30 days and the recovery, the lines of where they are needed, and that the name hint counts only a current-name match.
- `lib/private/profile.test.ts`: an officer's link of a held player is taken.
- `member-session.test.ts`: the new officer route.
