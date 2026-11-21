# feat-558 — Browser notifications for officers (Web Push)

Issue 558, scope confirmed by the owner on 2026-11-21: all four uses, built together. Decision: D148.

## Built

- **Protocol, no dependency** (`lib/web-push.ts`): VAPID (ES256 JWT, 12 h) and aes128gcm payload encryption (ECDH P-256, HKDF, AES-128-GCM) on `node:crypto`. One POST per device, `TTL` 12 h, 5 s timeout, never throws. Endpoints only on the browsers' push services (`PUSH_HOSTS`), checked when a device is saved.
- **Env** (`lib/env.ts`, optional, server only): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (in `secretsOf`, masked in logs), `VAPID_SUBJECT`. Devices are sealed under `WORKSPACE_KEYS_SECRET`. Without all four the feature does not exist (`pushConfig`): no card, the route answers `403 turned_off`, no notification code reads the database. `pnpm push:keys` (`scripts/push-keys.ts`) prints a fresh pair and writes nothing.
- **Storage** (`lib/schema-push.ts`, migration `0065_push_subscriptions`): `push_subscriptions` (workspace, officer, the endpoint's sha256, the sealed subscription JSON, uses, language, created and last-success times; unique per workspace and endpoint; at most 10 devices per officer and workspace) and `push_marks` (each trigger's last value notified, one atomic upsert). Both in `WORKSPACE_TABLES`, never downloaded.
- **Officers only** (`pushRecipients`): not blocked, and an officer session of that workspace that has not ended (7 days after sign-in). Devices are deleted on a push service 404/410, on "Turn off on this device", on Sign out on the device (the browser sends its endpoint with the sign-out), and when a Discord sign-in refuses the person or lets them in as a member only.
- **The four uses** (`lib/push-uses.ts`, `lib/push-tick.ts`, words in `lib/copy-push.ts`, EN · PT-BR · FR, in the device's desk language). Counts and a link only.
  - Raid Shield: in the shield tick's `after` (after the summary and the Raid prep fill), when a read is over and has answers, again only when its count changed. Opens the week's Raid prep roll call. Switch `shield_check`.
  - Night read failed: after the tick's automatic retry still leaves the workspace's alliance without a roster. Once per workspace and day. Off by default on the card ("Nothing to do").
  - "This is me" to approve: a member's pending claim (from the me route, after the answer). Once per member and server day. Switch `board`.
  - Roll call reminders: a Calendar roll call's opening (no number) and about a day later while anyone is not set (`lib/private/push-roll-calls.ts`). Raid prep is left out while `shield_check` is on. Switch `roll_call`.
- Home: a one-time, hideable line for officers, "Get notifications on this phone · Alliance settings →" (`PushHint`, `NotificationsHint`), while the site has push keys and the device has none on.
- The desk's language switch moves the device's notifications to the new language (`followLanguage`, route action `language`).
- **Card** (Alliance settings → Notifications, `app/(private)/_ui/PushSettings.tsx`, `app/(private)/_ui/push-client.ts`, words in `lib/private/dictionary.push.ts`): a switch per offered use, "Enable on this device" (the permission prompt only on that tap), switches that save at once, "Turn off on this device", and lines on counts only, iPhone/iPad (Add to Home Screen), Android and the 7-day sign-in.
- **Service worker** `public/sw.js` (scope `/w/<slug>/`): shows the push, opens or focuses its `/w/…` page on a tap; no cache, no fetch handler. Page CSP gains `worker-src 'self'` (`proxy.ts`).
- **Route** `POST /api/w/[slug]/push` (`subscribe`, `uses`, `unsubscribe`; officers only; 30 writes / 15 min per officer; `ws_action` `push` / `add`, `save`, `delete`). `POST /api/w/[slug]/logout` takes an optional `endpoint`.
- **Analytics**: `ws_push_enabled` and `ws_push_disabled` with `{use}`; `ws_action` feature `push`. Tracking plan updated.
- Docs: D148, the D137 amendment, the decisions index, ARCHITECTURE (the modules and the one fence exception).

## Decisions

- No `web-push` dependency: `node:crypto` does all of it; RFC 8291's test vector proves the encryption.
- **When a roll call "opens" and "closes"** (the desk had no such notion; an assumption the owner can change): open 24 h around its activity's time A, server time. Raid prep (answered before KvK) from A − 24 h to A; Undead Siege, Cheese Trap and Elixir Scramble teams (who took part) from A to A + 24 h. "Open" reminder in the first 3 h when anyone is not set; "left" reminder in the last 3 h while anyone still is. Calendar roll calls only; roll calls added by hand get none.
- **No extra wake of the database** (D141): the roll call reminders and the night read's notification run after the answer of ticks that open the database anyway. D141's heartbeat opens it at least once every 3 hours, so each 3-hour window gets a tick. A reminder can come up to 3 h after its moment, never twice.
- **Officers only = a session that has not ended.** Discord's role is not re-checked without a sign-in, so a person who never signs in again stops getting notifications at most 7 days after their last sign-in. The card says so.
- **One exception to D71's fence**: `lib/push-tick.ts` imports `lib/private/push-roll-calls.ts` only (eslint `except`), so the reminders count exactly as the Roll call page does (away members left out, a team only its members). That module reads only the workspace's own alliance, on `officerAccess` of one of its own officers with a live session, and returns counts.
- Uses whose D134 switch is off are not offered and not stored; the sends check the switches too.
- Notification text is in the language the desk had on the device when it was enabled or last saved.

## Deviations

- Rebased on dev's Raid prep tracker marks (#567): `lib/shield-tick.ts` keeps dev's version, with the notifications added after the summary and the fill.
- The migration is `0065_push_subscriptions`: dev took 0064 (`0064_raid_prep_tracker_marks`) while this was built; regenerated after the rebase with `pnpm db:generate`.
- Tests: the cross-workspace (issue 471) check for the new route is in `push/route.test.ts`, not in `cross-workspace.test.ts`: that suite's environment has no push keys, and adding them would change its webhook and key behaviour.

## Verified

- `pnpm check` on the rebased branch (on `origin/dev` 55f059ea): passes. 292 test files (2 skipped), 1,511 tests (4 skipped), prettier, eslint, tsc, no migration drift, i18n up to date.
- RFC 8291 Appendix A test vector: exact match (`lib/web-push.test.ts`).
- New tests: `lib/web-push.test.ts` (4), `lib/push.test.ts` (3), `lib/push-uses.test.ts` (5), `app/(private)/api/w/[slug]/push/route.test.ts` (5), and the member-session suite's new fixture.
- Panel (3 subagents, all reported back to me):
  - **Adversarial and security**: no MUST. Applied: no redirects for a push; one row per device whatever the endpoint's spelling; the Raid Shield notifications after the summaries and the Raid prep fill, settled together; D148's route wording (`unsubscribe` answers 200). Left for the owner: the 7-day session bound (below).
  - **Officer persona and product**: 4 MUST, 8 SHOULD, 4 NIT, all applied (relayed by the orchestrator): no Raid prep reminder while the Raid Shield check is on; the sign-in line; PT "sem marca" and the "all seen" texts; the "open" reminder without a number; no "last hours" wording; the night read off by default with "Nothing to do"; the iPhone-Safari line, the "Alliance settings → Notifications" and "Share (or ••• → Share)" steps, the Home Screen sign-in line; the claim texts; a one-time hint on Home; the FR shield texts; the shield link to the Raid prep roll call; the device's language following the desk's switch.
  - **QA** on a local production build of 23d65a36's first version (local Postgres with all migrations, invented workspace "qa-bellwick", officer and member sessions set directly, a fetch preload answering push hosts locally, headless system Chrome with `PushManager` stubbed): 34 checks pass, no MUST. Card shown with keys and gone without (`403 turned_off`); `/sw.js` 200 and `worker-src 'self'`; the worker registered at `/w/qa-bellwick/`; Enable → one sealed row (no endpoint or keys in plain text), a switch → its uses, Turn off → row gone; a member's claim → exactly one aes128gcm POST with a VAPID JWT (aud `https://fcm.googleapis.com`, 12 h) that decrypts to counts and a link only, and no second one the same day; sign-out with the endpoint deletes the row; 360 px light and dark, EN/PT/FR, 1280 px: no overflow, targets ≥ 44 px. Applied from QA: the device's state and button above the switches, `role="status"`, switches locked while saving, the night read's help line. Screenshots: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/qa-558/`. QA ran before the panel fixes; those are covered by tests, typecheck and lint, not by a second browser run.

## Open issues

- **Owner decision**: the officers-only rule counts a session that has not ended (up to 7 days after sign-in), not D99's 24-hour role check. Someone who loses the officer role in Discord and never signs in again gets counts for up to 7 days. A shorter bound is one condition on `checked_at` in `lib/repo/push.ts` (`officerNow`); it would also stop notifications for officers who don't open the desk daily.
- Not tested on a real iPhone or Android phone (owner step 4 below).
- Follow-ups, not built: a reminder before notifications pause (sign-in ending); `pushsubscriptionchange`; pruning old `push_marks` rows.
- The roll call reminders read two weeks of the Roll call page's counts per workspace with a roll-call device, on every tick that opens the database. Cheap at today's size (one or two workspaces); worth a look if many workspaces turn it on.

## Next

- Model/effort: keep.
- Owner first, to turn it on (nothing changes until then):
  1. In a terminal in the repository: `pnpm push:keys`. It prints `VAPID_PUBLIC_KEY=…`, `VAPID_PRIVATE_KEY=…` and a `VAPID_SUBJECT=` line to fill.
  2. Vercel → the project → Settings → Environment Variables → add, for Production (and Preview if you want it there): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (mark it Sensitive) and `VAPID_SUBJECT` = `mailto:` plus an address you read. `WORKSPACE_KEYS_SECRET` is already set.
  3. Redeploy. Alliance settings shows the Notifications card. Keep the same pair: a new pair makes every officer tap "Enable on this device" again. Do not paste the private key anywhere else.
  4. On a real iPhone: add the desk to the Home Screen, open it from the icon, sign in if asked, Alliance settings → Notifications → Enable on this device, and check one notification arrives. Same on an Android phone in Chrome.
- Plan change: none.

<adjustments>
- Notifications go only through `notifyOfficers` (`lib/push.ts`) and are claimed once per trigger with `claimPushMark`. A new use adds a `PushUse`, its words in `lib/copy-push.ts` (EN, PT-BR, FR), its card words in `lib/private/dictionary.push.ts`, and its D134 switch in `SWITCH` (`lib/private/push-settings.ts`).
- The roll call open/close windows (`reminderPhase` in `lib/private/push-roll-calls.ts`) are the build's assumption; if the owner defines roll call deadlines later, change them there.
</adjustments>

PR: (added by the orchestrator)
