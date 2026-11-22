# test: follow-up issue tests and two small rule moves (#526, #512, #507, #516)

## Built

Each row below names the deliberate code change that makes its test fail. Every break was undone after its run. Base: origin/dev f13ecce6.

| Issue | Item | Test | Break that proves it |
|---|---|---|---|
| #526 | Tip edge: exactly 5 days below the cap, plus 2 days with no read | `lib/private/follow-up-rules.test.ts` "gives the coins tip at exactly 5 days below 1,000 when the other 2 days have no read (D140)" | `>= COINS_TIP_DAYS` → `>` in `coinsTip`: this test and the existing coins test fail. |
| #526 | Tip edge: the 7-day newcomer grace | `lib/private/follow-up.test.ts` "holds the coins tip back from a newcomer until 7 days after they were first seen (D127, D140)": 6 days after the first read, no tip; 7 days after, the tip | `!m.settling &&` removed in `tipsOf`: fails (tip at 6 days). `OFFLINE_GRACE_DAYS + 1` in `rowOf`'s `settling`: fails (no tip at 7 days). |
| #526 | Tip edge: a member on a break | `lib/private/follow-up.test.ts` "leaves a member on a break off the list for the coins tip (D75, D140)": the status is set through `saveFacts`, so no follow-up row resolves the member | `&& !who.includes("break")` removed from `worklist`'s tip: fails. |
| #526 | Reuse the newcomer date logic | `MemberRow.settling` (new field), set once in `members.ts` `rowOf` from `isNewMember(…, OFFLINE_GRACE_DAYS)`. `tipsOf` reads `m.settling` and no longer has its own date math. No behaviour change: covered by the grace test above. | (see the grace row) |
| #526 | Say whether no-read days count in the 7-day window | `tipsOf`'s comment: the window is 7 calendar days; a day with no read stays in it and counts as no data, never as a day below 1,000. | — |
| #526 | `WORKSPACE_LANGUAGES` in the browser bundle | `FollowUpPanelParts.tsx` maps over `LANGUAGE_CHOICES` from `app/(private)/_ui/languages.ts` (already client-safe, same order) instead of importing the dictionary module. | Build check: see Verified. |
| #512 | Discord commands after an alliance switch | `app/(private)/api/w/[slug]/features/route.test.ts` "registers the server's Discord commands again without the one its officers turned off (D129)" | The `changesCommands`/`syncCommands` block removed from `setAllianceFeature`: fails (no PUT). |
| #512 | Discord commands after a default change | `app/api/admin/workspaces/features/route.test.ts` "re-registers a server that had commands after a default for new alliances changes (D129, D134)" | `"default_switch"` removed from `changesCommands`: fails (no PUT). |
| #512 | "Equal to the default is no override" into lib, cap case tested | `isDefaultSwitch` and `isDefaultCap` in `lib/workspace-features.ts`, used by the route's `capChange`/`switchChange` and by `copiedOverrides`. Test: "stores a cap equal to the default as none, so the alliance follows a new default (D134)" | `isDefaultCap` → `false`: fails. `|| isDefaultCap(…)` removed from the route: fails (`{ ai: 20 }` stored). |
| #512 | Hard-coded "106" and "200" | `lib/copy-admin-features.ts` builds `callsHelp` from `TRACKER_CALLS` (`per100`). The text is unchanged: printed with `tsx`, it is the same string as before. | — |
| #512 | ARCHITECTURE.md | The `lib/workspace-features.ts` entry now describes D134's two layers, the editable defaults over `CODE_DEFAULTS`, the override rule, and lists `lib/private/alliance-features.ts`. | — |
| #507 | The newcomer test does not bite | `lib/squads-read.test.ts` "queues a member who joined…": member 1's older roster now carries uid 8 (left since), which member 2's newer roster does not. | ` && roster.updatedAt > call.rosterAt` removed in `squads-call.ts` `keep`: the new test fails (8 is called). The old test passed with the same break (run against origin/dev's test file). |
| #507 | The daily read runs the 90-day purge | `app/api/tick/daily-jobs.test.ts` "clears player reads' raw bodies older than 90 days (D132)" | The `clearOldPlayerRaw` call removed from `lib/tick.ts`: fails. |
| #516 | `versionLines` | `lib/private/member-card.test.ts` "lists every earlier value of each fact, newest first, and leaves out the current one" | The `version < newest` filter removed: fails (5 lines). Sort reversed: fails. |
| #516 | Fine / No data status | `lib/private/members-sheet.test.ts` "says No data when the newest read left something out, and Fine when it told everything" | `return "fine"` always: fails. `missing.length >= 0`: fails. |

## Decisions

- #526: `settling` is a field of `MemberRow`, computed where `isNewMember(…, OFFLINE_GRACE_DAYS)` already ran. `tipsOf` has no `oldest` day, so calling `isNewMember` there would have needed `oldest` exposed as well. Five test row literals gained `settling: false`.
- #526: the issue said "a small module of its own". `LANGUAGE_CHOICES` in `app/(private)/_ui/languages.ts` already is one (it imports the dictionary as a type only), so no new file was added.
- #507: `app/api/tick/route.test.ts` was at the 300-line `max-lines` cap. The new purge test went into a new file, `app/api/tick/daily-jobs.test.ts`, and the existing app_errors purge test moved there with it (same setup, same behaviour: the daily jobs after the first read). The moved test still bites: with the `purgeOldAppErrors` call removed, it fails.
- #512: the cap test's first assertion uses `toEqual` on `stored.caps`. A `toMatchObject({ caps: {} })` matches any object, so it would not fail on its own.

## Deviations

- None from the task list.

## Verified

- `pnpm check`: exit 0. Prettier and ESLint clean, tsc passes. Vitest: 313 files passed and 2 skipped; 1665 tests passed and 4 skipped. Drift check passes. "i18n: 17 languages up to date with English".
- Break runs: every break in the table was run, and the named test failed. Each break was undone.
- Bundle (#526): `next build` (exit 0) with this change: `grep -rl "Bureau des officiers" .next/static` (the French dictionary's `app.name`) finds 0 client files; `.next/server` has 28 (positive control). The same build with origin/dev's `FollowUpPanelParts.tsx` finds 1 client chunk.

## Open issues

- #512, not done here and not in the triage: "avoid extra Discord calls when a default changes". A default change re-registers every server that had commands, even when that server's commands do not change.
- #507, not done here: the "/admin signal" for a failed purge. A failure is logged and sent to PostHog as a handled exception (`tickJobFailed`), with no line on /admin. The Settings page item (`settings/page.tsx:32`) looks done already on dev: the page uses `squadsReader` from `lib/private/squads-today.ts`. The owner or orchestrator should confirm it before closing #507.
- #516, not done here: the card JSON test is already on dev (`members/[uid]/route.test.ts` "carries no photo URL and none of the roster's raw private keys"). The short squad's empty slots and the `daily_rosters` index are untouched, and so are the feature items and History.
- Pre-existing, not changed: `callsHelp` says the Raid Shield check is "about 200 calls on Friday night per 100 members". D137 has two reads, Friday 23:30 ST and Saturday morning, and with the squads read on only the morning read is extra.
- Pre-existing, not changed: the existing "stores only what differs from the defaults" test uses `toMatchObject({ switches: {}, caps: {} })`, which matches any object ("tighter asserts" was dropped by the triage).

## What was missing from the task prompt?

The task did not list #512's "avoid extra Discord calls when a default changes" or #507's "/admin signal" for a failed purge, so this PR could close only #526.

## Next

- #512: avoid re-registering a server's Discord commands when a default change leaves its commands as they were.
- #507: a line on /admin when the daily read's 90-day purge fails (today it only reaches the log and PostHog); confirm the Settings item is done; the partial index and the requeue are in the database-cost PR.
- #516: the card's Follow-up action and Shield line, the short squad's empty slots, the `daily_rosters` index; History waits for the owner.
- `callsHelp`'s Raid Shield calls text (two reads, D137).
- Model/effort: keep. Each item was S and mechanical once the code was read.
- The owner must do nothing first. The plan needs no change.

<adjustments>
- `MemberRow.settling` exists: first seen under OFFLINE_GRACE_DAYS ago (D127). Use it rather than recomputing the newcomer grace.
- `isDefaultSwitch` and `isDefaultCap` (`lib/workspace-features.ts`) are the one place for D134's "equal to the default is no override" rule.
- `app/api/tick/route.test.ts` is near the 300-line cap; a new tick daily-job test goes in `app/api/tick/daily-jobs.test.ts`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/630
