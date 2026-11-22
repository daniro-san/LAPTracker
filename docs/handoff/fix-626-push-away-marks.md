# fix-626-push-away-marks: the officers' Raid Shield push leaves away members out of its count; Raid prep reads the Shield marks once (issue 626)

Branch `fix/626-push-away-marks` from `origin/dev` (f13ecce6). **Size S**: a bug fix that restores the rule D137's 2026-11-22 amendment set for the summary, plus one read that is no longer repeated. There is no migration, no new route, no new decision (one bullet added to D137's 2026-11-22 amendment) and no change to how private roster fields flow.

## Built

- **The push count leaves away members out** (`lib/push-uses.ts`, `pushShield`).
  - `membersOfRaid(db, target, day, zone)` (new, exported from `lib/shield-post.ts`) returns the alliance's members and the uids away on the raid's Saturday (`addDays(day, 1)`), by `awayFacts` and `awayOn`. This is the code `messageOf` had inline. The summary's `messageOf` and `pushShield` both call it now, so their numbers come from the same members and the same away set.
  - `pushShield` passes that away set to `summarize`. `n` is `notSeen.length`, which no longer includes away members.
  - "every member read was seen with a shield" (`shieldNone`) is sent only when `n` is 0 and no away member was left out unseen. When only away members were not seen, the text is "0 not seen with a shield yet".
- **Before / after** (invented numbers: 5 members not seen with a shield on Friday night, 2 of them away on Saturday):

  ```
  before: Night check: 5 not seen with a shield yet. Tap to review in Raid prep.
  after:  Night check: 3 not seen with a shield yet. Tap to review in Raid prep.
  ```

  The summary for the same read says "Not seen yet: <3 names> · 2 away, left out".
- **One read of the Shield marks on the mark page.** `Loaded` (`lib/private/roll-call-view.ts`) now also holds `marks`, the newest marks of the roll call's own part that `callRead` already read. `prepView` (`lib/private/raid-prep.ts`) takes `loaded.marks` as its `main` marks. It reads them itself only when no `loaded` is passed (its unit tests and the isolation suite), as it does for the roster and facts. The wall marks are still read in `prepView`: `callRead` does not read them.
- **D137**: one bullet added to the 2026-11-22 amendment.
- **Tests**:
  - `lib/push-uses.test.ts`, "Raid Shield: leaves a member away on the raid's Saturday out of the count, as the summary does". Two members are not seen on Friday night, and one of them is away from Saturday. The push says 1. A later tick sees the other with a shield, and the push says 0 with the "not seen" text. The push service is the existing stub (`pushService()`); nothing is sent.
  - `lib/private/raid-prep.test.ts`, "takes the Shield marks the mark page's roll call read instead of reading them again". After the tick's fill, `prepView(…, callRead's loaded)` equals `prepView` without `loaded`, and shows the tick's marks to check. An officer's ✓ written after `callRead` does not show in a second `prepView` with the same `loaded`.

## Decisions

- **Away is judged on the raid's Saturday**, as the summary judges it (#624). The push has no roll call day either.
- **The away rule moved into one exported function** (`membersOfRaid`) instead of a second inline copy in `pushShield`. The issue asks that the two numbers agree, and one function keeps them from drifting apart.
- **`shieldNone` is sent only when no away member was left out unseen.** With away members left out, `n` can be 0 while away members had no shield seen, and "every member read was seen with a shield" would then be untrue. The push still carries a count only, no away count: its text is one line on a lock screen, and the issue asks only that the two numbers agree.
- **The push mark stays `pass:n`.** A change in who is away changes `n`, and that sends the push again. This is the existing "again only when its count changed" rule.

## Deviations

- None.

## Verified

- **`pnpm check` passed**: prettier, eslint, tsc, vitest (312 files passed, 2 skipped; 1658 tests passed, 4 skipped), drift (no schema changes), i18n (17 languages up to date).
- **Each new test fails when the code is broken on purpose** (one break at a time, then restored; `lib/push-uses.test.ts`, `lib/shield-post.test.ts` and `lib/private/raid-prep.test.ts` run):

  | Break | Tests that fail |
  | --- | --- |
  | `pushShield` passes no away set to `summarize` | the push test |
  | `membersOfRaid` judges away on Friday (`day`) instead of `addDays(day, 1)` | the push test and both summary away tests in `lib/shield-post.test.ts` |
  | `pushShield` sends `shieldNone` whenever `n` is 0 | the push test |
  | `prepView` reads the Shield marks again even when `loaded` is passed | the marks test |
  | `callRead` hands `marks: []` in `loaded` | the marks test |

- **Existing tests unchanged and green**: the first Raid Shield push test ("once when a read is over, again only when its count changed"), the summary tests, `lib/shield-read.test.ts`, `lib/raid-prep-fill.test.ts`, the rest of `lib/private/raid-prep.test.ts`, the isolation and member-session suites.
- **e2e**: `pnpm test:e2e e2e/desk.spec.ts -g "Raid prep"` on a production build and a local Postgres 18 cluster (`.pglocal`, port 54320, stopped afterwards): 3 passed, 1 skipped (the mark flow runs on the phone project only). This covers the mark page's `readMark` → `callRead` → `prepView(…, loaded)` path.
- Nothing was pushed to a real device or posted to Discord. No production call, no quota use.
- **Analytics plan: no change.** No event, property or funnel step is added, changed or removed.
- **Privacy**: the push holds a count and a link only, as before. The away facts stay inside the tick. `loaded.marks` holds the same rows `callRead` already read for the view, and the mark page passes `loaded` only to `prepView`.

## Open issues

- **Away day for a Raid prep dated on another weekday** (carried over from #624). The desk judges away on the roll call's own day. The summary and the push judge it on the raid's Saturday. They differ only for a member whose away dates start or end between the two days.
- `.pglocal/` (gitignored) is left in the worktree from the e2e run; the cluster is stopped.

## Next

Nothing follows from this issue. The D148 table's "none" text ("every member read was seen with a shield") is unchanged; D137's amendment records when it is sent.

What was missing from the task prompt? What the push should say when every member not seen is away (`n` is 0). This PR sends "0 not seen with a shield yet" then, so the text stays true.

PR: (added by the orchestrator)
