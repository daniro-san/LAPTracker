# feat/790-kvk-plan — a KvK plan with roles and a ready-made chat message (stage 1)

Issue #790 (from spike #789). Size M: a new page, a new route, a migration and a new decision (D161).

## Plan (written before building)

Where: `/w/[slug]/calendar/kvk?entry=&week=`, linked as "KvK plan ›" beside "Roll call ›" on each KvK entry in the Calendar's week. Officers only (`requireWorkspace`), own alliance (D71). It sits under the Notices switch (D126), because its output is a notice.

Criteria (EARS):

- **P1** When an officer opens the plan of a KvK entry that has no saved plan, the page shall show four suggested roles (Rally lead, Garrison, Scout, Shield / stay safe) in the officer's language, with nobody in them and no note. Nothing is stored until Save.
- **P2** When an officer saves, the system shall store the roles (name and members, in the officers' order), the note and a new `rev` for that calendar entry, and the next read shall show them.
- **P3** If the save names a `rev` that is not the stored one, then the system shall refuse it (409 `stale`) and store nothing.
- **P4** If a saved role names a uid that is not on the alliance's newest roster, then the system shall refuse it (400 `invalid`).
- **P5** The member picker shall list the members the KvK's roll call asks (the newest roster without the members away on the KvK's day, D103), by public name, searchable by name key (D74). Away members are left out.
- **P6** When an officer taps "Make the message", the system shall make a new notice draft from the saved plan, in the officer's language: a heading with the KvK's server day and time, one line per role that has members ("Rally lead: Bramble, Quillon", members in name order), then the note. Roles with nobody are left out. With no role filled, the message is the heading and the note.
- **P7** The notice draft and anything later sent to translation shall carry public names only, never a private roster field, an away note or a uid.
- **P8** A repeat of "Make the message" with the same request id shall answer the same notice (D100).
- **P9** Where the entry is not a KvK of this workspace, the system shall answer 404; a member's session and another workspace's officer shall get 401 (D105).
- **P10** Roles are never shown or sent as a ranking: no numbers, no order by might, members in name order.

Entities: `kvk_plans` (one row per calendar entry): `roles` jsonb `[{name, uids}]`, `note`, `rev`, `saved_by`, `saved_at`, `notice_id` (the last notice made from it). Migration by `pnpm db:generate`.

Interface: `POST /api/w/[slug]/kvk-plan` `{action: "save", entry, rev, roles, note}` and `{action: "message", entry, week, requestId}`.

One-way doors: none. The table is new and only holds what officers type; no private field flows anywhere new.

## Persona check (quick, before building)

- Officer on a phone (30s, PH): wants the four roles ready and one tap to add people → defaults shown, "Add people" opens a sheet with search; each person is a 44 px chip with ×.
- Officer on a desktop (50s, UK): wants to see the whole plan and write a longer note → one column, a large note box, the same controls.
- UX designer at 360 and 1280: one column (max width as other desk pages), chips wrap, nothing hover-only, Save and "Make the message" side by side and wrapping. "Make the message" is off while there are unsaved changes, with the reason in words.
- Privacy reviewer: the plan stores uids; names come from the newest roster's public name; the message is the notice's text and goes through the notice flow only; names and lists are `ph-no-capture`; analytics carries the feature and action only.
- Role defaults kept: Rally lead, Garrison, Scout, Shield / stay safe, editable, removable, more can be added (up to 10).

## Built

- Table `kvk_plans` (`lib/schema-calendar.ts`), migration `drizzle/0083_kvk_plans.sql` made by `pnpm db:generate --name kvk_plans`.
- `lib/repo/kvk-plans.ts`: read, save over `rev`, remember the last notice.
- `lib/private/kvk-plan-message.ts` (pure): the default roles, the limits, `planMessage`.
- `lib/private/kvk-plan.ts`: input schema, `kvkPlanView`, `saveKvkPlan`, `makeKvkMessage` (makes the notice through `saveNotice` with the request id).
- `POST /api/w/[slug]/kvk-plan` (`save`, `message`), under the Notices switch.
- Page `/w/[slug]/calendar/kvk?entry=&week=` and `app/(private)/_ui/KvkPlanEditor.tsx`; "KvK plan ›" link on KvK entries in `CalendarAgenda.tsx`.
- Words in `lib/private/dictionary.kvk-plan.ts` (EN, PT-BR, FR), `calendar.kvkPlan`, and `data.file.kvk-plans` for the data download.
- `kvk_plans` in the workspace's tables (`lib/repo/workspace-data.ts`): downloaded as `kvk-plans.csv`, removed with the workspace.
- Analytics: `ws_action` feature `kvk_plan`, actions `save` and `draft` (tracking plan row added).
- Decision D161.

## Decisions

- D161 records the page, the plan, the message format and the privacy rules.
- The plan is one row per calendar entry, as the task says. A weekly KvK keeps one plan for every week.
- "Coming" is "not away on the KvK's day": KvK's roll call is Raid prep, which has no "coming" mark. The picker lists the roster without away members; this covers "else roster".
- The plan lives under the Notices switch, because its only output is a notice.
- "Make the message" builds from the saved plan only (as the garrison post), and is off while there are unsaved changes.
- Each tap makes a new notice (a new request id per page load); the page links the last one.
- The message is written in the officer's desk language and saved into that language of the notice. Role names are the officers' own text and are not translated until the notice's Translate.
- No delete for a plan: it belongs to its entry, which has the shared soft delete (D123). Removing roles and people is the edit.

## Deviations

- The test of "no private field in the AI request" checks the notice the Translate step is asked about (the editor sends the notice's own text, D81). It does not call the draft route, which needs the notice_translate switch and the AI stub; the text sent there is that notice text.

## Verified

- After the rebase onto origin/dev (migration renumbered to 0083, decision to D161): `pnpm vitest related --run <changed files>`: 386 files passed, 2 skipped; 2098 tests passed.
- `pnpm check` after the rebase: prettier, eslint, tsc, vitest (386 files passed, 2 skipped; 2098 tests), drift check, i18n check: all passed.
- In an earlier full run, `lib/squads-read.test.ts` failed once under machine load and passed when run alone; it passed in the final `pnpm check`.
- New tests (`lib/private/kvk-plan.test.ts`): save and load, stale save refused, unknown uid refused; the picker leaves out a member away on the KvK day; the message with roles (server time, names in name order, empty role left out); the message with no roles filled; no private field, away note or uid in the notice.
- Added after the PR 797 review: `app/(private)/api/w/[slug]/kvk-plan/route.test.ts` (409 stale; 400 invalid and 400 bad_request; 403 turned_off with Notices off; 403 forbidden from another site), and in `lib/private/kvk-plan.test.ts` a repeat of "Make the message" with the same request id answers the same notice and stores one, and someone who left the roster is dropped from the plan shown and from the message. Each behaviour was broken once in the source and its test failed, then the source was restored.
- Isolation: the route has a fixture in `member-session.test.ts` (no session, a member's session and another workspace's officer get 401). `cross-workspace.test.ts` sends Alpha's save and message naming Bravo's KvK entry; both are refused at the record and no Bravo row changes. The seeded workspace now has a KvK entry with a plan.
- Not run: the page in a browser at 360 and 1280. The persona check above was done from the design rules, not from screenshots.

## Open issues

- Home's recent activity does not list plan saves or messages.
- A role name is not translated in the plan itself; it is translated with the rest of the notice.

## Next

- Follow-ups: the designer-persona screenshot review at 360/390/412/1280 before the owner reads the PR; stage 2 (timeline editor) per issue 790.
- Measure after release: `ws_action` `kvk_plan` `save` and `draft` per workspace per KvK week, and how many drafts are later published (`notice_publish`).

What was missing from the task prompt? Which roll call answer means "coming" for a KvK (its roll call is Raid prep, with Shield marks only), and whether a weekly KvK keeps one plan or one per week.

PR: (added by the orchestrator)
