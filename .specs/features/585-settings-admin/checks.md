# Alliance settings and /admin (#585 batch 2b) checks

Build: `pnpm typecheck`; `pnpm lint`
Run unit: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" "app/(private)/_ui/settings-save.test.ts" "app/(private)/_ui/discord-step.test.ts"`
Plan: `.specs/features/585-settings-admin/plan.md`

profile: light

16 checks in 1 slice built here (S1; S2-S4 are later PRs and get their own checks) · 0 one-way doors · 0 open, of which 0 block

## Checks

### S1 - Alliance settings says what is set, what saves, and what needs a look

**C1** - The index lists one row per card shown, in page order, each linking to its card's anchor; Raid Shield check only while the check is on, Notifications only while the site has push keys (AC 1)
Proof: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "lists every card"`

**C2** - Each row carries its card's state in words: the key's state word, "{on} of {allowed} on", "Summary to Discord: on/off", "{set} of {n} channels set" with "commands off on this site" (plan AC 2, wording changed 2026-11-22 after the first-glance test), "Deletion asked: {date}" (AC 2)
Proof: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "lists every card"`

**C3** - Only a refused, out-of-quota or to-enter-again key, a webhook to paste again, the summary on without a usable Raid Shield channel, and an asked deletion mark a row as needing a look; no key, a working key and every channel set do not (AC 3)
Proof: `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "needs a look"`

**C4** - At 360 × 780 the index ends inside the first viewport for `ogs` in EN, FR and PT; at 1280 it is in the margin column (walk)
Proof: walk - `585-2b/shots/after/settings--360-light-{en,fr,pt-BR}-fold.png`, `settings--1280-light-en-fold.png`

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

## Coverage

| Set (size)                             | Member -> proof                                                                                                             | Unproven |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| index rows (6)                         | Tracker key C1 · Features C1 · Raid Shield check C1 · Notifications C1 · Discord C1 · data C1                               | -        |
| key states (7)                         | ok C2 · invalid C3 · out_of_quota C3 · reenter C3 · none C3 · site C2 · off C2                                              | -        |
| attention causes, AC 3 (6)             | key invalid C3 · key out of quota C3 · key reenter C3 · webhook reenter C3 · summary without channel C3 · deletion asked C3 | -        |
| bot steps (3)                          | off C11 · noCheck C12 · ready C11                                                                                           | -        |
| Save outcomes (3)                      | all through C6 · refused C7 · no answer C7                                                                                  | -        |
| source controls: Alliance settings (5) | index link C1 · feature tick C5 · Features Save C6 · Raid Shield Save C9 · in-place help summary C15                        | -        |

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

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none - the orchestrator dispatches the Verifier
- **Boundary:** C1-C16 at the slice-1 commit
- **Abandoned:** none
- **Walked:** see the handoff `docs/handoff/feat-585-settings-admin.md`
