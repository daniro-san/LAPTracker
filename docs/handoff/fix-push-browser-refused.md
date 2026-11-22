# fix/push-browser-refused

## Built
- `enableDevice()` in `app/(private)/_ui/PushSettings.tsx`: runs the browser subscription and the server save as separate steps.
  - A `subscribe()` that rejects with a DOMException named AbortError shows `push.serviceRefused`; any other rejection (failed registration, bad key) shows `push.failed`. Nothing is sent to the server.
  - A `subscribe()` that does not settle within 20 s shows `push.timedOut`. The `finally` in `enable()` then resets `busy`, so the button comes back.
  - A failed save to our server still shows `push.failed` (or the signed-out note on 401).
- New strings in EN, PT-BR and FR (`lib/private/dictionary.push.ts`): `push.serviceRefused`, `push.timedOut`, `push.brave` (a Brave line in the card's help list, after the Android line).
- `PushSettings.test.ts`: eight tests (AbortError, other failures, 401, save rejects, subscribe rejects, subscribe never resolves with fake timers, failed save, success).

## Decisions
- Analytics: no push failure event exists (only `ws_push_enabled` and `ws_push_disabled`), so nothing was added to the tracking plan.
- The 20 s timeout covers `deskWorker` (service worker registration, then `navigator.serviceWorker.ready`) and `pushManager.subscribe`, since `subscribe()` in `push-client.ts` does both. `Notification.requestPermission` is not timed out: it waits on the person.
- The logic sits in an exported function because the repo's tests run in a node environment with no DOM; this lets the test call it directly.

## Deviations
- The task's suggested EN wording was used for `push.serviceRefused`. `push.timedOut` uses the coordinator's wording.

## Verified
- `pnpm vitest related --run` on the three changed files: 78 files, 413 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n).
- Not run: a real Brave session. Brave's behaviour comes from public reports, not from reproduction.

Sources for Brave's behaviour (no official Brave doc found; these are issue reports):
- https://github.com/brave/brave-browser/issues/58188: in a fresh profile with the toggle at its default, the first `subscribe()` fails fast with "AbortError: Registration failed - push service error". With the toggle on, later attempts on macOS hang (GCM client stuck in LOADING).
- https://github.com/kuboon/browser-how-to/issues/15: Brave desktop, `subscribe` fails with AbortError; turning on "Use Google services for push messaging" at brave://settings/privacy and restarting fixes it.
- Several downstream PRs describe the same (for example https://github.com/hienlh/ppm/pull/53).

## Open issues
- Second symptom (button greyed, nothing happens after turning the setting on) matches brave-browser #58188: `subscribe()` hangs with the toggle on. The 20 s timeout turns that into a visible message; it does not fix the hang, which is in the browser.
- `deskWorker` awaits `navigator.serviceWorker.ready`. That promise never settles if the registration's worker never activates (install stuck or registration for a scope that does not control the page). This is a second possible cause of the hang; not reproduced. The timeout covers it too.
- After a timeout the pending `subscribe()` may still complete later in the background. A later tap on Enable unsubscribes any existing subscription first, so it self-heals.

## Next
- Optional: reproduce in Brave with the toggle on to see whether the hang is `ready` or `subscribe`; if `ready`, check why `/sw.js` does not activate.
- Optional: a `ws_push_failed` event with a closed `stage` (`subscribe`, `timeout`, `save`) if the owner wants to measure these.

What was missing from the task prompt? The second symptom (a hang, not a rejection) and that the repo has no DOM test setup, which shaped the testable design.

PR: (added by the orchestrator)
