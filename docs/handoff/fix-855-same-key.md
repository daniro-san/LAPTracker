# fix/855-same-key

## Built
- `lib/workspace-keys.ts`: `isSiteKey(apiKey)` compares an opened key with `process.env.LAP_API_KEY` by `timingSafeEqual` on the two SHA-256 digests (equal-length buffers). `savedIsSiteKey(db, secret, workspaceId)` opens the saved key under the current master key, whatever its status, and returns only a boolean.
- `squadTargets` (through `keyTargets`) and `dailyTargets` give a target whose saved key is the site key `key: null` and keep its `workspaceId` and slug. All squads-read paths branch on `target.key`: `runSquadsBatch` (event pause), `targetBatch` (`squadsReserve`), `startQuota` (no `/quota` call, starts from the day's read), `failedCall`/`keepKeyQuota` (no key marking), `shield-read`, `shield-reset`. So all of them now treat that key as the site key. The daily read counts that alliance in the site key's quota check.
- `lib/private/recruit-check.ts`: on a saved key equal to the site key, `readRecruit` reads only while `remaining - 1 >= squadsReserve(...)`. `remaining` is the alliance's squad-read row's `quotaRemaining`, else the day's read's `quotaRemainingBefore - callsUsed`, and an unknown value refuses. A refusal answers `quota_low` (route: 503). A 401 or 429 on that key marks no workspace key. `RecruitDeps` gains `env`; the route passes `ctx.env`.
- Alliance settings → Tracker key: `settingsKeyView` (this page only) returns `siteKey`; `trackerKeyView`, which Home and the routes read, opens no key (review of PR 856). `TrackerKeyForm` shows "This is the site’s key; reads will share its daily quota and keep the event reserve." under the saved key when it is true. EN, PT-BR and FR are in `lib/private/dictionary.settings.ts` as `key.siteKey`.
- Tests:
  - `lib/workspace-keys-site.test.ts`: reserve kept with no second quota count; paused in the event window; a 429 marks no key and no log line carries the key; a different key is unchanged. `dailyTargets` gives `key: null` for a site-equal key in the own and in another alliance's workspace, and a set key for a different one.
  - Recruit route test: a read below the reserve is refused on the same key; a 429 then a 401 on it leave the key facts unchanged.
  - Tracker-key route test: `siteKey` is true only when the keys are equal.
- Dated amendment to D124.

## Decisions
- Representation: a site-key target is `key: null`, the existing site semantics, and keeps its workspace id. This needed no change in the squads, shield or daily read code.
- A workspace of another alliance that saves the site key is read on it for its own alliance only, under the site reserve and event pause (review of PR 856). D124 and the INVARIANT keys.own-quota-only comments say so.
- `squadsKey` (the rule computed without opening the key) still returns "own" for such a key. The desk's progress lines and /admin's key state still say "own key". Opening keys on every page read to change that wording was not asked for.
- `trackerEstimate` holds no per-key budget; it multiplies features by members. The quota is counted once because the site-key target makes no `/quota` call and counts in the site key's daily quota check. The function itself is unchanged.
- Recruit refusal wording: the prompt said to use existing wording. There is no recruit `quota_low` line, so the 503 shows the existing `recruit.failed` line ("The tracker did not answer. Try again later."). The alternatives were the cap line or the no-key line, and both would say something false.

## Deviations
- None.

## Verified
- `pnpm vitest related --run` on the changed files: 194 files, 1180 tests passed; after the review fixes, 43 files, 292 tests passed.
- `pnpm typecheck`: passed.
- `pnpm check`: passed (419 test files, 2293 tests; drift and i18n checks clean).

## Open issues
- The `switches.estimate` line says "of the 1,000 calls a key has each day". On the site key, those calls are shared with the public reads. The new settings line covers this; the estimate line itself is unchanged.
- The recruit refusal on the site key reuses "The tracker did not answer" wording, which is not exact.

## Next
- Follow-up: a recruit line for `quota_low` ("The site's key is saving its quota for the event. Try again later.") in EN, PT-BR, FR.
- Follow-up: /admin's alliance row could show "site's key" for a saved key equal to it (needs opening the key in the admin read).

What was missing from the task prompt? Which existing words the recruit `quota_low` refusal should show, since the recruit check had no quota_low line.

PR: (added by the orchestrator)
