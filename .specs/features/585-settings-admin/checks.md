# Alliance settings and /admin (#585 batch 2b) checks

Build: `pnpm typecheck`; `pnpm lint`
Run unit: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" "app/(private)/_ui/settings-save.test.ts" "app/(private)/_ui/discord-step.test.ts"`
Run admin: `pnpm vitest run app/_ui/admin/needs-you.test.ts app/_ui/admin/StatusFacts.test.ts app/_ui/admin/alliances-view.test.ts lib/queries/admin-errors.test.ts lib/queries/admin-alliances.test.ts "app/(pages)/admin/gate.test.ts" --reporter=verbose`
Plan: `.specs/features/585-settings-admin/plan.md`

profile: light

16 checks for S1 (PR #620) and 14 for S2 (`feat/585-admin-first-screen`); S3 and S4 are later PRs with their own checks · 0 one-way doors · 0 open, of which 0 block

## Checks

### S1 - Alliance settings says what is set, what saves, and what needs a look

**C1** - The index lists one row per card shown, in page order, each linking to its card's anchor; Raid Shield check only while the check is on, Notifications only while the site has push keys (AC 1)
Proof: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "lists every card"`

**C2** - Each row carries its card's state in words: the key's state word, "{on} of {allowed} on", "Summary to Discord: on/off", "{set} of {n} channels set" with "commands off on this site" (plan AC 2, wording changed 2026-11-22 after the first-glance test), "Deletion asked: {date}" (AC 2)
Proof: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "lists every card"`

**C3** - Only a refused, out-of-quota or to-enter-again key, a webhook to paste again, the summary on without a usable Raid Shield channel, and an asked deletion mark a row as needing a look; no key, a working key and every channel set do not (AC 3)
Proof: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "needs a look"`

**C4** - At 360 × 780 the index ends inside the first viewport for `ogs` in EN, FR and PT; at 1280 it is in the margin column (walk)
Proof: walk - `585-2b/shots/after/settings--360-light-{en,fr,pt-BR}-fold.png`, `settings--1280-light-en-fold.png`; measured 2026-11-22 (`585-2b/e2e/walk2.mjs`, PR #620 review): the index ends at 633 px (EN), 686 px (PT) and 686 px (FR), the bottom tabs start at 723 px, so it fits in all three; every row is 44 px or taller, wrapped rows included (EN Discord 52; PT and FR Raid Shield check 52 and Discord 73)

**C5** - Ticking or unticking changes only the draft and the count of changes; a switch ticked and unticked back is no change (AC 5, AC 6 example)
Proof: `pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "only what the officer changed"`

**C6** - Save sends one POST per changed switch, one after another, and nothing for an unchanged one (AC 6)
Proof: `pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "one request per change"`

**C7** - A refusal stops the sending and leaves the unsent switches as the draft, with the refusal's code (AC 7)
Proof: `pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "stops at the first refusal"`

**C8** - While Features or the Raid Shield check has changes not saved, reload asks before leaving (AC 8)
Proof: walk - `useLeaveWarning(dirty)` in `SaveRow`; reload with a tick pending shows the browser's leave dialog (Playwright `page.on("dialog")` type `beforeunload`)

**C9** - The Raid Shield check card's Save is off with no change, "Not saved yet" with one, "Saved." after a save (AC 9)
Proof: walk - `585-2b/shots/after/` Raid Shield card before and after a change

**C10** - The page head says each card saves with its own button and Notifications are for this device only (AC 10)
Proof: walk - `settings--360-light-en-fold.png`

**C11** - With no Discord app on the site the card never shows "in your server", "Commands on", "Not checked yet" or the Check lead, shows the off block, and the channels' heading has no number (AC 11)
Proof: `pnpm vitest run "app/(private)/_ui/discord-step.test.ts" -t "site's bot is off"`

**C12** - With the app id but no bot token, step 2 shows only that Check is off, never the stored "in your server" line (AC 12)
Proof: `pnpm vitest run "app/(private)/_ui/discord-step.test.ts" -t "cannot check"`

**C13** - The Raid Shield channel has a "Leaders only" tag and its D147 help line at body size, full ink (AC 13)
Proof: walk - `settings--360-light-en.png`, `settings--360-dark-en.png`

**C14** - 8 px or more between each Raid Shield select and its label (AC 14)
Proof: walk - computed gap in the after shots' metrics

**C15** - The webhook how-to and the private-channel note are 44 px summaries; the how-to is open while a channel is not set (AC 15)
Proof: walk - `settings-fern--360-light-en.png` (no channel set: open) and `settings--360-light-en.png` (all set: closed)

**C16** - Every new key exists in EN, PT-BR and FR (AC 16)
Proof: `pnpm vitest run lib/private/dictionary.test.ts -t "has the same keys"`

### S2 - /admin answers "what do I need to do?" first

**C17** - "Needs you" lists, in order, the scheduler late, a daily read to retry, requests waiting, app errors in 24 h, workspaces to set up or with a key to fix, deletions asked, the morning reading low, and the to-dos, each with its count in words and its link (AC 17)
Proof: run admin | ✓ app/_ui/admin/needs-you.test.ts > Needs you (issue 585, F11) > lists what waits on the owner in the order he acts on it, each with its count and where it is done

**C18** - Only what waits is listed, nothing when nothing does; the workspaces row counts setup and key only, never a row whose reasons are page errors or a used-up limit (AC 17)
Proof: run admin | ✓ app/_ui/admin/needs-you.test.ts > Needs you (issue 585, F11) > lists only what waits, and nothing when nothing does

**C19** - The API calls row shows only from today's daily-read reading under 900: not 900, not yesterday's, not one above 1,000 (AC 17, AC 21)
Proof: run admin | ✓ app/_ui/admin/needs-you.test.ts > Needs you (issue 585, F11) > calls the API calls low only from today's reading taken before the day's spend

**C20** - /admin renders "Needs you" before Status with the seeded rows, and the nav reads out the App errors count (AC 17, AC 19)
Proof: run admin | ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin opens with what needs the owner, before Status, and the nav counts the last day's app errors (issue 585)

**C21** - No member role, and no read once a daily read since the workspace was made has finished, are setup gaps; a read still to come is not (AC 18)
Proof: run admin | ✓ app/_ui/admin/alliances-view.test.ts > setup gaps (issue 585, F12) > counts no member role, and no read once a daily read since the workspace was made has finished, as setup to do

**C22** - The first read skips a failed roster and one from before the workspace; "a read since" needs a read that started after the workspace was made and finished (AC 18)
Proof: run admin | ✓ lib/queries/admin-alliances.test.ts > allianceUsage (issue 485, D144) > gives the member role, the alliance's first roster that did not fail since the workspace was made, and whether a daily read has finished since (F12)

**C23** - Rows rank key, errors, setup, a used-up limit, then the rest by address (AC 18)
Proof: run admin | ✓ app/_ui/admin/alliances-view.test.ts > byAttention > puts a key that cannot be used first, then errors, then setup, then a used-up limit, then the rest by address

**C24** - The App errors count is the last 24 h only (AC 19)
Proof: run admin | ✓ lib/queries/admin-errors.test.ts > /admin/errors (issue 585, F34) > counts the app errors of the last 24 h for the nav, not older ones

**C25** - The alliance select keeps a workspace's own unnamed alliance as "{id} · not read yet" (AC 20)
Proof: run admin | ✓ app/_ui/admin/alliances-view.test.ts > allianceChoices (F13) > keeps a workspace's own alliance in the select, by its id, when no board or roster names it yet

**C26** - The reading is ok from 900 to 1,000, above over 1,000 (muted "Above the 1,000 plan", "{n} left", never OK), low under 900, no verdict for an earlier UTC day (AC 21)
Proof: run admin | ✓ app/_ui/admin/needs-you.test.ts > quotaState (F34) > reads today's reading as ok up to 1,000, above it over 1,000, low under 900, and gives an earlier UTC day no verdict
Proof: run admin | ✓ app/_ui/admin/StatusFacts.test.ts > Status's API calls fact (F34) > says how many are left and that it is above the 1,000 plan, never OK, when today's reading is above 1,000

**C27** - No /admin or guide string types the 1,000 a day out (AC 22)
Proof: `! grep -n "1,000 API\|of 1,000\|1,000 today\|1,000 plan" lib/copy-admin.ts lib/copy-admin-features.ts lib/copy-admin-alliances.ts lib/copy-admin-status.ts lib/copy-guide.ts`

**C28** - "Late" by the watcher's rule: 03:05 on time at 05:00 and 06:05, late at 06:11, late with no tick; the Last tick fact shows it (AC 23)
Proof: run admin | ✓ app/_ui/admin/needs-you.test.ts > tickLate (D45, D141) > calls the scheduler late by the watcher's rule: no tick since the newest heartbeat slot at least 10 minutes old
Proof: run admin | ✓ app/_ui/admin/StatusFacts.test.ts > Status's Last tick fact (D45, D141) > says Late when no tick came since the newest heartbeat slot the watcher judges, and nothing when one did

**C29** - /admin/errors gives each group its workspace addresses; `?w=` keeps that workspace's groups; anything but one workspace address lists all; the Alliances page error count links to `?w=` (AC 24, AC 25)
Proof: run admin | ✓ lib/queries/admin-errors.test.ts > /admin/errors (issue 585, F34) > gives each group the workspace addresses it happened under, and with ?w= that workspace's groups only
Proof: run admin | ✓ lib/queries/admin-errors.test.ts > /admin/errors (issue 585, F34) > takes ?w= only as one workspace address; anything else lists every error
Proof: walk - `585-admin/shots/after/admin-errors-w-ogs--360-light-fold.png` ("Errors under /w/ogs only.", "Show all errors", "/w/ogs · …" on each group)

**C30** - Activity shows the setup steps, with Member role and First read, when PostHog has no totals; waiting requests are counted past the 50 listed (AC 26, AC 17)
Proof: run admin | ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin's Activity shows each workspace's setup steps when PostHog has no totals (F12)
Proof: run admin | ✓ lib/queries/admin-errors.test.ts > countWaitingRequests (issue 585, F11) > counts every request with no answer yet, also past the 50 /admin lists

## Coverage

| Set (size)                             | Member -> proof                                                                                                                           | Unproven |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| index rows (6)                         | Tracker key C1 · Features C1 · Raid Shield check C1 · Notifications C1 · Discord C1 · data C1                                             | -        |
| key states (7)                         | ok C2 · invalid C3 · out_of_quota C3 · reenter C3 · none C3 · site C2 · off C2                                                            | -        |
| attention causes, AC 3 (6)             | key invalid C3 · key out of quota C3 · key reenter C3 · webhook reenter C3 · summary without channel C3 · deletion asked C3               | -        |
| bot steps (3)                          | off C11 · noCheck C12 · ready C11                                                                                                         | -        |
| Save outcomes (3)                      | all through C6 · refused C7 · no answer C7                                                                                                | -        |
| source controls: Alliance settings (5) | index link C1 · feature tick C5 · Features Save C6 · Raid Shield Save C9 · in-place help summary C15                                      | -        |
| Needs you rows (8)                     | scheduler C17 · daily retry C17 · requests C17 C30 · app errors C17 · workspaces C17 C18 · deletions C17 · quota low C17 C19 · to-dos C17 | -        |
| setup gaps, AC 18 (4 examples)         | no member role C21 · no read after a finished read C21 C22 · read still to come C21 C22 · failed roster C22                               | -        |
| quota states (5)                       | unknown C26 · old C26 · above C26 · low C26 · ok C26                                                                                      | -        |
| late tick, AC 23 (4 examples)          | 05:00 C28 · 06:05 C28 · 06:11 C28 · no tick C28                                                                                           | -        |
| source controls: /admin (4)            | Needs you row link C20 · nav App errors C20 · page errors link C29 (walk) · Show all errors C29 (walk)                                    | -        |

## Swept

- validation: existing - `allianceFeatureInput` (zod, strict) on the route, unchanged
- failure modes: C7
- idempotency: C6 - Save is disabled while sending; a switch already stored is not sent
- authorization: existing - `requireWorkspace` before any read; a member's session is refused (`refuse.ts`)
- concurrency: C7 - an owner's change meanwhile answers 403 `not_allowed`, the page refreshes to what is stored
- data lifecycle: n/a - nothing stored or deleted beyond the existing switch writes
- dependency failure: C7 - no answer from the route counts as `failed`
- state transitions: C5, C6, C9
- observability: n/a - `ws_action` per switch is unchanged; a dated "Changed" line in the tracking plan
- S2 validation: C29 - `?w=` only as one workspace address
- S2 authorization: existing - `isAdmin()` before any read (`gate.test.ts` locked cases, unchanged)
- S2 failure modes: C30 - PostHog down still shows the setup steps
- S2 concurrency: n/a - read only
- S2 data lifecycle: n/a - nothing stored; `app_errors` keeps its 30-day purge
- S2 dependency failure: C30
- S2 state transitions: C21, C22 (no read yet → read)
- S2 observability: n/a - no new event; the analytics plan's S2 line

## Handoff

- **Settled mid-build:** none (S1). S2: none from the owner; the S2 plan review's changes are in the plan
- **Dispatched (S2):** first-glance before (owner persona, `585-admin/shots/before/admin--360-light-fold.png`) - returned: wrong ("nothing to do"); plan review, owner + product strategy - returned: approve with changes, both; adversarial - returned: approve with changes; first-glance after (`585-admin/shots/after/admin--360-light-fold.png`) - returned: right; the orchestrator runs /pr-review and the Verifier on the PR
- **Dispatched:** none by the builder; the orchestrator's /pr-review and Verifier on PR #620 returned Approve with comments (C4 not reproducible from code alone), fixed in the review commit
- **Review fixes (PR #620):** the Raid Shield Save refreshes the page, so its index row updates (walk); `not_allowed` names the switch Save stopped at and keeps the rest of the draft (`settings-save.test.ts` "names the switch the owner turned off"); the save bookkeeping is pure (`afterSave`, `shownOn`; "shows what a Save stored"); `DiscordBot` draws exactly `botLines().keys`; the page uses `siteBotOff`; `discord.bot.unset` removed
- **Boundary:** C1-C16 at the slice-1 commit; C17-C30 at the S2 commit
- **Abandoned:** none
- **Walked:** see the handoff `docs/handoff/feat-585-settings-admin.md`
