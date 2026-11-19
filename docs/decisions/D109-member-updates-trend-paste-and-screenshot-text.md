## D109 — Member updates: the trend on the card, AD Tech 100 % complete, Paste updates, Read from a screenshot, and progress in the thanks (2026-11-17, owner, 11ab, issue 347; amends D80, D96, D104)

Why: officers get new main squad and AD Tech values from members whenever someone sends them. They want to see what changed, record many members at once, and thank the members who progressed. The owner's correction of 2026-11-16: there is no weekly round, so there is no "not updated in 7 days" list, no progress counter and no "asked" marks. The owner added "Read from a screenshot" on 2026-11-17. A review round on PR 400 the same day (code review, an R4 officer and a copywriter persona, and the owner's answers) changed the points marked (r2).

- **The trend on the card.**
  - The two fields are labelled apart from the game's total "Might": "Main squad might" / "Might do esquadrão principal" / "Might de l’escouade principale" (r2; the fact's label everywhere, so D104's "still to ask: Main squad, …" now reads "Main squad might").
  - The current value comes first. Under it, on its own muted line, is the change since the version before it: "+400K since Nov 10" for main squad, "+5 points since Nov 10" for AD Tech. Then comes "Updated Nov 17" (r2: a short date with no weekday; day and month joined by a no-break space so "10 nov." never wraps in PT and FR).
  - The facts are append-only (D80), so the version before is read from `member_facts` (`factHistory`, `lib/private/fact-trend.ts`). The card reads only its own member's history.
  - No version before, a cleared one, or the same value: no change is shown. "Updated …" is plain information, never a warning, and is also on pending and former members' cards.
- **AD Tech at 100 % is complete.**
  - `AD_COMPLETE` (100) lives in `fact-fields.ts`. The card shows "100%" with "Complete" under it.
  - The Members "Missing info" chip (`factsToAsk`) lists AD Tech only when it has no value, so a member at 100 % is never asked.
  - A chat screenshot's or Paste updates draft's AD Tech row for a member already at 100 % starts dropped, says "Skipped: AD Tech is already complete." (r2), and its save does not write it, as 11k built it.
  - The facts editor stays free to correct the value.
- **Registered members through chat screenshots.** A member-update draft already proposed a new version for a member who has values (before → after on the row), saved as the next version "from a message", with D80's 409 for a stale one. That is unchanged.
- **Paste updates** (Members: the page's one primary action, right under the Members / Former members tabs, r2).
  - One member per line, the name first: "Ana 10.2M 74%", "RC9-XY 8,442,626 · 42%", "Bo: AD 80". The name is every word before the first value or AD/squad word (`nameAndValues`); the rest goes through D80's parser.
  - The sheet sends the lines to `POST /api/w/[slug]/shots` with `pasted: true`. They become a member-update draft with the new draft source `pasted` (r2, migration `0036_draft_source_pasted`), matched like a chat screenshot.
  - The officer lands on the draft's review. Its header says "Pasted by {name}" instead of "from a screenshot" / "Sent by", and "Draft kept until {date}." without "Screenshots are not kept" (r2). Each row says "Matched to {name}" instead of "Read as", and shows the value once: the line under it says before → after (r2).
  - Facts saved from it keep the source "from a message": what a member said, as with a chat screenshot (D80).
  - Reading (r2, from the code review): text from Paste updates is read line by line. The lines before the first chat sender line are typed lines, name first; from that sender line on, it is a chat (a picture read into the box). A picture's text (the screenshot import) is still read as a chat only: a page with no sender line gives no rows, as before.
  - As with the desk's Send screenshots (D100), the button stays busy until the draft exists; a draft has no request id. The per-card paste is unchanged.
- **Read from a screenshot.** A control beside the three paste boxes: Edit info's "Paste what they told you", Add a new member (the same editor), and Paste updates (several pictures).
  - In the editor it is a link above "Fill the fields", which is the box's main button (r2).
  - Each picture goes through the desk's reader, `POST /api/w/[slug]/shots/read`: PNG, status bar dropped, at most 1080 px wide, 4 MB, the reader's 20 s limit, one picture per request. The status-bar constants moved to `lib/screenshot/status-bar.ts` so the browser can load them.
  - Only the text lines come back. They go into the paste box: in the editor its reading runs at once ("Found 2 values. Check them, then Save."); in Paste updates the officer taps Check the updates. Nothing is saved without the officer.
  - The picture is read in memory and never stored (D96). The line under the control says "The picture is not kept." (r2).
  - The route is officers only (in `member-session.test.ts`) and answers 401 `signed_out`. It reads one picture at a time per officer: a second request while one is read gets 429 `busy`, shown as "Still reading the last picture. Wait a moment." (r2). The guard is per server instance and is freed when the reader fails.
  - While reading, the control is disabled and "Reading the picture… this takes a few seconds" shows. When picture N fails, the text of pictures 1 to N−1 still goes into the box, with the failure line: "Couldn’t read this picture. Try a sharper screenshot, or paste the text." (r2).
  - The input is `accept="image/*"` without `capture`, so an iPhone offers the photo library. The PT label is the owner's "Ler de um print".
- **Thanks: "Worth a thank-you"** (r2: "Merecem um obrigado", "À remercier cette semaine"). It is part of the Members thanks box, and Home's members box shows it as one line. The Members and Home pages read the workspace's history for it (`progressHistory`); `membersView` no longer reads it (r2, code review: the follow-up writes and every card open called it).
  - A member is named when, in the game week of the newest daily update (server days), AD Tech was saved at 100 % this week and the version before it was below 100. A first-ever 100 % has nothing to compare with and is not thanked (owner, 2026-11-17).
  - A member is also named when main squad might was saved this week at least **5 %** (`SQUAD_GROWTH`, owner, 2026-11-17) above **the version before it**: the same pair the card's "+400K since …" compares (r2: the first build compared with the newest value before the week, so the thanks and the card could disagree).
  - No value before: not named and not counted (D75). Members on a break are left out, as from the other thanks. New members are not: progress compares a member with their own earlier value.
  - Lines say what happened, with no number: "Fennick grew their main squad", "Juniper finished AD Tech", "… finished AD Tech and grew their main squad". The list is in name order and is not a ranking.
- **D75.** No "didn't answer" list exists. "—" is no data and counts against no one.

**Amendment (2026-11-17, 11ae, owner, issue 404): a weekly baseline (D114).**

- Main squad progress in the thanks compares the newest value saved in the week with the last value saved before Monday 00:00 ST of that week, no longer with the version just before the newest. 10.0M → 10.3M → 10.6M in one week counts as +6 %. AD Tech counts as reached when the newest value in the week is 100 and the value before the week was below 100.
- The card says "+600K this week" ("+5 points this week") when the newest version is from this game week and a value from before the week exists; otherwise it keeps "+400K since Nov 10". The card and the thanks compare the same pair again (r2's reason for the version before).
- The week is no longer the game week of the newest daily update. It is the week the thanks cover (`thanksWeek`): the current game week, or last week on a Monday.
- A first-ever value still gets no thanks.

**Amendment (2026-11-17, 11ae review round, PR 407): "Say thanks to".** The heading "Worth a thank-you" / "Merecem um obrigado" / "À remercier cette semaine" now reads "Say thanks to" / "Agradeça a" / "Dites merci à" (copywriter persona), in its own block under the top lists (D114).

**Amendment (2026-11-19, 11an, issue 423, D121): a plain-grey reading.** `POST /api/w/[slug]/shots/read?text=plain` reads the picture in plain grey only, with no row flattening. The garrison plan's "Read from a screenshot" uses it, because the Undead Siege screen's "Enemy Might" sits on the scene's art, which the flattening wipes out. Without the query the reader is unchanged. `ws_text_read` gets the place `garrison`.
