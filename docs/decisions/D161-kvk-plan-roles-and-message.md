## D161 — A KvK plan: roles officers name and fill, a note, and "Make the message" into a notice draft (2026-11-27, orchestrator from spike #789, issue 790 stage 1; persona check in docs/handoff/feat-790-kvk-plan.md)

Why: before KvK, officers tell the alliance who leads rallies, who garrisons, who scouts and who should shield and stay safe, and they write that message by hand in the game chat and on Discord. Spike #789 (persona panel and adversarial review) adopted a plan on the KvK calendar entry that writes the message for them and hands it to the notice flow.

**Where.** `/w/[slug]/calendar/kvk?entry=&week=`, linked as "KvK plan ›" beside "Roll call ›" on each KvK entry in the Calendar's week. Officers only (`requireWorkspace`), own alliance (D71). It is under the Notices switch (D126): its output is a notice, so with Notices off the link is gone, the page goes to Home and the route answers 403 `turned_off`.

**The plan.** One row per calendar entry (`kvk_plans`, migration `0083_kvk_plans`): the roles in the officers' order (`[{name, uids}]`), the note, `rev`, who saved last and when, and the last notice made from it. A weekly KvK keeps one plan for every week; officers change it week to week.

- A new plan suggests four roles in the officer's language: Rally lead, Garrison, Scout, Shield / stay safe. They are not stored until Save. Officers rename, remove and add roles (up to 10, names up to 40 characters), and write a note (up to 500).
- Save names the `rev` it started from. If another officer saved first it is refused (409 `stale`) and the page says to reload.
- The rules a save must pass (the system boundary): every uid is on the alliance's newest roster, a role names a person once, at most 200 people across the roles.
- Stored uids that left the roster are dropped from the plan shown and from the message.

**Who can be picked.** The members the KvK's roll call asks: the newest roster without the members away on the KvK's day (D103's away rule). KvK's roll call is Raid prep, which has no "coming" mark, so "not away that day" is the coming list. Search is by name key (D74), public name only.

**The message.** "Make the message" makes a new notice from the saved plan, in the officer's desk language, once per request id (D100), and opens it in the notice editor. From there the notice flow translates, copies and posts it (D81, D102, D113); nothing new is sent anywhere.

- Title: "KvK plan · Sat, Nov 28".
- Text: "KvK · Sat, Nov 28 · 12:00 ST", then one line per role that has people ("Rally lead: Bramble Fox, Quillon Ash"), then a blank line and the note.
- A role with nobody is left out. With no role filled, the message is the heading and the note.
- It is off while the plan has unsaved changes ("Save the plan before you make the message.").

**People first (D75).** Roles are jobs, never a ranking: no number, no order by might or activity; people inside a role are in name order. An empty role is left out of the message, not shown as a gap.

**Privacy.** The plan stores uids. The page and the message carry the public name only. No private roster field, away note or uid is in the notice, so none reaches a translation (D81) or Discord. The name lists are `ph-no-capture`. Analytics: `ws_action` feature `kvk_plan`, actions `save` and `draft`, no names.

**Not in stage 1.** A timeline editor (stage 2 in issue 790). Home's recent activity does not list plan saves.

**Amendment 2026-11-28 (orchestrator, issue 831): members ask for a role, officers confirm; a timed reminder post.**

- **"I'm in" from the board.** A member with an approved link (D142) sees a "KvK roles" card on their own page (`/w/[slug]/board/me`) while a KvK is open: the next KvK calendar entry officers marked "Members can see this" (D105), with a saved plan, on a KvK day (`isKvkDay`, not Origin of Chaos, D160 amendment 2026-11-28), before its start, from today through the next week. The card shows its day, its time in server time and in the reader's own time (D116's `Times`), and each role of the plan with the people officers confirmed, in name order. Per role the member taps "I'm in", or "Withdraw" while no officer has confirmed it; once confirmed it reads "Confirmed: you're in." and only an officer takes them out.
- **Route.** `POST /api/w/[slug]/me/kvk {entry, role, action: ask | withdraw}`: requireBoard, the board and Notices switches (the plan lives under Notices, D126), and `meAccess`. Strict body, no uid: the uid is the link's. 403 `not_linked` for a pending or missing link, 404 for a role that is not the open KvK's, 409 `confirmed` or `left` (no longer on the roster). Nothing is logged.
- **Storage.** `kvk_claims(workspace_id, entry_id, role, uid, asked_at)`, primary key (entry, role, uid), migration `0089_kvk_claims`. A row is an ask not answered yet. Confirm puts the uid into the plan's role (a new `rev`) and deletes the row; Decline and Withdraw delete it. The role is named as the plan names it: renaming a role in the editor leaves its asks unshown. Downloaded as `kvk-claims.csv` and deleted with the workspace (D125).
- **The desk.** On the KvK plan page, under each role's people: "Aster Vale (asked)" with Confirm and Decline (`{action: "answer", entry, role, uid, answer}` on `/api/w/[slug]/kvk-plan`, requireWorkspace). Both are off while the plan has unsaved changes ("Save the plan before you answer the members who asked."), so an answer never drops an officer's edits. A Confirm writes over the plan's current `rev`; only a save that lands between its read and its write refuses it (409 `stale`), and another officer's open editor then gets 409 on its next save, as for any save. The confirmed people are the role's chips, as before. Analytics: `ws_action` feature `kvk_plan`, actions `approve` (Confirm) and `decline`, no names; the member's ask sends no event.
- **People first (D75).** A role is a job, never a ranking: no count of asks, no order but name order (the desk lists asks by name, never by when they came), no "declined" mark shown to anyone; a declined member sees "I'm in" again.
- **The reminder.** Catalog post 6, "KvK reminder" (D159 amendment 2026-11-28): 60 and 15 minutes before the KvK's start, its time and the roles with the confirmed people to the members' channel. Asks that are not confirmed and the note are not in it.
- **Tests.** `app/(private)/api/w/[slug]/me/kvk/route.test.ts`: ask and withdraw for the link's own uid and 400 for a body naming a uid; 403 for a pending or missing link and 404 for an unknown role, with nothing stored; an officer confirms one ask into the role and declines another, another workspace's officer gets 401, and a confirmed member cannot withdraw; the card's start in ST and in the reader's time. `lib/private/catalog-posts-kvk-soon.test.ts` for the reminder.
