# feat/831-kvk-claims: members ask for a KvK role, officers confirm; a KvK reminder post

Closes #831. Extends D161 (members' asks, the desk's answers) and D159 (catalog post 6), with dated amendments to D161, D159, D156, D141 and D71. Migration: `0089_kvk_claims` (dev's latest was `0088_kind_junta`).

## Built

- **Storage.** `kvk_claims(workspace_id, entry_id, role, uid, asked_at)` in `lib/schema-calendar.ts`, primary key (entry, role, uid), cascades from the workspace and the calendar entry. A row is an ask not answered yet. `lib/repo/kvk-claims.ts`: `claimsOf`, `addClaim`, `removeClaim`. Listed in `WORKSPACE_TABLES` (downloaded as `kvk-claims.csv`, deleted with the workspace), with its README line in EN, PT-BR and FR (`lib/private/dictionary.data.ts`) and a seed row in `lib/workspace-data.test-helpers.ts`.
- **Rules.** `lib/private/kvk-claims.ts`:
  - `meKvkView(db, me, now, zone)`: the open KvK, which is the next KvK entry marked "Members can see this", with a saved plan, on a KvK day (`isKvkDay`), before its start, from today through the next week. It returns the roles with the confirmed names in name order and the member's own state (`in`, `asked` or null).
  - `claimKvkRole`: ask or withdraw for the MeAccess uid only.
  - `asksOf`: the desk's open asks, on roles still in the plan, by members still on the roster.
  - `answerKvkClaim`: Confirm writes the uid into the role over the plan's current `rev` and deletes the ask. Decline deletes the ask.
- **Member route.** `POST /api/w/[slug]/me/kvk {entry, role, action}`. Behind requireBoard, the board and Notices switches, and `meAccess`. The body is strict, so it carries no uid. Excluded from the officer-route walk in `member-session.test.ts`.
- **Officer route.** `/api/w/[slug]/kvk-plan` gains `{action: "answer", entry, role, uid, answer: confirm | decline}` (requireWorkspace). Analytics: `kvk_plan` `approve` and `decline` (`decline` is new in `DESK_ACTIONS`).
- **Board.** `app/(private)/_ui/MeKvk.tsx`: the "KvK roles" card on `/w/[slug]/board/me`, after "Days you are away". It shows the day, then `Times` (server time, then the reader's own time after hydration, in the order the browser chose). Each role lists its confirmed names and one control: "I'm in", "You asked. An officer will confirm." with Withdraw, or "Confirmed: you're in.". All buttons are `buttonClass` (`min-h-11`, 44 px). The card is `ph-no-capture`. The page's "pick" section moved into its own `PickLink` component, and the card renders through `KvkCard`, so `Body` stays under the 80-line lint limit. The page's behaviour is unchanged.
- **Desk.** `app/(private)/_ui/KvkPlanAsks.tsx`: under each role's chips, "Aster Vale (asked)" with Confirm and Decline. Both are off while the plan has unsaved changes, with the line "Save the plan before you answer the members who asked.". `KvkPlanEditor` gains `asks` and an `answer` request. The page keys the editor by `rev`, so a Confirm reloads it from the saved plan.
- **Post 6, "KvK reminder"** (`kvk_soon`):
  - Catalog entry with `marks: [60, 15]` and `from: "before"` (`SNAPSHOT_BEFORE`). `periodsOf` and `markOf` give one period per mark ("2026-11-28 T-60"). `sendDuePosts` loops over the periods.
  - `soonText` and `soonOf` in `lib/private/catalog-posts.ts`. Each mark is sent from its time until the next mark or the start; a mark whose time passed is settled `skipped`.
  - Feature `post_kvk_soon`, with its /admin label and switch name.
  - Copy `posts.kvk_soon.*`, `posts.whenKvkSoon`, `callouts.*.kvk_soon` and `activity.callout.kvk_soon` in EN, PT-BR and FR. The card's lead now says three posts name anyone.
  - The settings card reads "The KvK must start between 11:00 and 14:00 ST" (`marksWindow`).
  - `DESK_POSTS` gains `kvk_soon`. The two `post_key` checks are widened in 0089.
- **Docs.** Amendments to D161, D159, D156, D141 and D71. Updated the tracking plan (row and Changed line), `.claude/rules/private.md`, `REVIEW.md`, the `eslint.config.mjs` zone comment, and the e2e index count ("Posts 1 of 6 on").
- **Tests.**
  - `app/(private)/api/w/[slug]/me/kvk/route.test.ts` (4 tests): a member asks and withdraws for their own uid, and a body that names a uid gets 400. A pending or missing link gets 403 and an unknown role gets 404, with nothing stored. An officer confirms one ask and declines another; another workspace's officer gets 401; a confirmed member cannot withdraw. The card shows 12:00 ST and 15:00 in Paris.
  - `lib/private/catalog-posts-kvk-soon.test.ts` (4 tests): the exact T-60 text and the T-15 text, once each, with no post at 10:45, 11:15 or 12:00 ST; the asker and the note are absent. Nothing is sent while the post is off or not allowed. Nothing is sent on an Origin of Chaos Saturday. The card shows 11:00–14:00.
  - `self-report.test-helpers.ts` gains `kvk(who, body, path)`. Its route switch is now a lookup table.

## Decisions

- **Where members ask:** a "KvK roles" card on `/board/me`. The board has no KvK plan view, and the task named this card as the fallback.
- **Which KvK is open:** the next KvK entry members can see, with a saved plan, on a KvK day, before its start, within today plus 13 days. A plan's roles reach members only once officers marked the entry "Members can see this" (D105). Asks close at the start.
- **"Confirmed" means the uid is in the plan's role.** There is no second status column. Confirm moves the uid into the plan, so the existing message and the editor's chips stay the one record of who is in a role. Decline deletes the ask, and the member sees "I'm in" again. No "declined" mark is shown (D75).
- **Asks are keyed by the role's name, as the plan stores roles.** The plan's roles have no ids, and adding ids would change D161's stored shape.
- **Answers are off while the plan is dirty.** The editor is keyed by `rev`, so this rule keeps a Confirm from dropping unsaved edits.
- **Reminder timing rides the event window (D160).** The post is due from the Before read on the event weekday. The window's 15-minute ticks already open the database, so a KvK at 12:00 ST is reminded at 11:00 and 11:45 ST. `tickMayBeDue` is not widened. The minutes in the text are counted from the sending tick ("in 60 minutes").
- **Reminder content:** the time, then the roles with confirmed people by public name, then a closing line. Asks that are not confirmed and the officers' note are left out. Names come from `anyRoster`, the same read the plan page uses.
- **The member's ask sends no analytics event,** like `me/away`.

## Deviations

- The task asked for one test per behaviour. The card's "next post" line got its own small test in the reminder file, because the card line is new behaviour.
- The board page's existing "pick" section was moved into `PickLink`, and the shared test helper's route chain became a table. Both were needed to pass the lint function-length limits; behaviour is unchanged.

## Verified

- `pnpm vitest related --run <changed files>`: 418 files. The first run had 1 failure: the data-export test's file list lacked `kvk-claims.csv`. I added it to the list. After the lint fixes, `vitest related` on the touched files passed (111 files, 648 tests).
- `pnpm check`: passed. 416 test files passed and 2 skipped; 2,267 tests passed and 4 skipped; no migration drift; i18n up to date. The first `pnpm check` failed on formatting. The second failed on 6 lint errors (function and file length, import order, nesting), fixed in one round.
- No mutation proofs were run.
- No screenshot or browser check at 360 px was done. Layout uses the existing card, button (44 px) and `Times` patterns.
- The e2e suite was not run; it needs local Postgres and a built server.
- No upstream API, Discord or quota endpoint was called.

## Open issues

- Migration 0089 must be applied with the release. It creates `kvk_claims` and widens two checks.
- Renaming a role in the editor hides its open asks; they stay in the table until the entry is deleted. A follow-up could move asks to the new name on save.
- A declined member can ask again at once. There is no limit on asks, and no rate limit on `me/kvk`.
- The reminder is sent only when a tick that opens the database anyway falls inside a mark's span. A KvK whose start is outside the event window, before 11:00 or after 14:00 ST with the default schedule, gets no reminder or only part of it. The card says this.
- Run `e2e/desk-posts.spec.ts` once on this branch before merge.

## Next

- Follow-up: designer-persona review of the "KvK roles" card and the desk's asks at 360 / 640 / 1280 px and in dark mode. Also check the reminder's Discord text in EN, PT-BR and FR.
- Follow-up, if officers ask: show members who else asked for a role, and send the officer a notification when a member asks.

What was missing from the task prompt? Which KvK counts as "open" for the board and whether its plan must be member-visible first (I used the entry's "Members can see this"), what "confirmed" should store (I used the plan's own role list), and which start time the reminder uses (the KvK calendar entry's, not the env's EVENT_TIME).

PR: (added by the orchestrator)
