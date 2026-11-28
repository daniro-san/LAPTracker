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
