# 07f — Discord message templates

Branch `fix/discord-templates`, cut from `origin/dev` after PR #32 (07d) was merged. The owner approved the templates on 2026-11-05 ("Yes, as proposed"), including the movers block, and asked for the webhook name override to be removed.

## Built

Every message the two webhooks send, rebuilt:

| Message | Webhook | When | New text (example) |
| --- | --- | --- | --- |
| Snapshot result, Before snapshot done | public | each real snapshot | embed, title `✓ Last updated: done at Sat, Nov 7, 10:01 server` (link to `/events/<id>`), body `4/4 alliances` / `Next update scheduled at Sat, Nov 7, 14:00 server` |
| Snapshot result, After snapshot done | public | same | title as above, then `4/4 alliances`, `**Might ▲**` + top 3 gains `[OGs] OldGrandmas ▲ +85.8M (+2.0%)`, `**Kills ▲**` + top 3 gains |
| Snapshot result, partly done | public | same | `⚠ Last updated: partly done at …`, `3/4 alliances`, `○ 1 stale: [OGs] OldGrandmas`, gains from the alliances with good data only |
| Snapshot result, failed | public | same | `✗ Last updated: failed at …`, no body |
| Snapshot run | admin | every snapshot | `⚠ After snapshot: partly done · Sat, 11/07/2026, 14:02 server` / `due Sat, 11/07/2026, 14:00 server · started +1 min` / `21 calls · 779 requests left · 52.0 s` / `✗ failed [IMPA]: upstream_timeout` / `○ stale [URSA]` / `[Run 41 ↗](<…/admin/runs/41>)` |
| Rehearsal verdict | admin | after a rehearsal's After snapshot | `[rehearsal] ✗ Fail · Sat, 11/07/2026, 14:46 server`, the ✓/✗ verdict lines, `[Runs ↗](<…>)` |
| Rehearsal skipped | admin | tick, scheduled rehearsal refused | `[rehearsal] skipped · Sat, 11/07/2026, 18:00 server: Not on the event day or the day after.` |
| Weekly API quota check | admin | Friday tick; `/api/quota/check` when low | `✓ Weekly API quota check · Fri, 11/06/2026, 20:01 server` / `⚠ 812 requests left (⚠ under 900)` / `✓ Database 123.4 MB` / `Before snapshot …` / `After snapshot …` |
| PIN locked | admin | 20th wrong PIN in an hour | `🔒 PIN entry is locked for an hour: 20 wrong PINs. The scheduled tick and workflow_dispatch still work.` |
| App error | admin | first app error in an hour | `✗ App error on /api/events/[id]: route TypeError · digest 123 · /admin/errors` |

Files:
- `lib/copy-discord.ts` (new): the messages' strings, re-exported as `copy.discord` from `lib/copy.ts`. Public messages reuse `copy.status` (`Last updated: …`, `Next update scheduled at …`, done / partly done / failed); admin messages reuse `copy.admin.phase`, `copy.admin.rehearsal.pass/fail` and `copy.admin.run.refusals`.
- `lib/notify.ts`: the public webhook sends one embed (colour bar sage / yarn / seal by state); admin stays plain text. New builders `rehearsalSkippedMessage`, `quotaReportMessage`, `pinLockedMessage`, `appErrorMessage`; `discordClock` formats `Sat, Nov 7, 14:01 server` (public) and `Sat, 11/07/2026, 14:01 server` (admin, the same shape as `/admin`). The rehearsal prefix is `[rehearsal]` (was `[TEST]`). No `username` in any payload.
- `lib/run.ts`: the public message reads the event through `getEventDetail` (lib/queries) for counts and gains; the weekly check builds through `quotaReportMessage`.
- `lib/tick.ts`, `lib/auth.ts`, `lib/app-errors.ts`: use the new builders.
- `lib/schedule.ts`: `describeInstant` removed (no caller left).
- `lib/notify.test.ts` (new): one test per message type, plus one on the sent payloads (no webhook URL, no PIN, no blocked roster key even when the query row carries `x`, `y`, `online`, `avatar_url`, no `username`).
- `lib/app-context.test-helpers.ts`: recorded posts keep the parsed body (public posts have no `content`). Three route tests updated to the new words (`[rehearsal]`, `PIN entry is locked`, `✓ Pass` / `✗ Fail`).
- `docs/ARCHITECTURE.md`: dependency rule now reads `lib/run → lib/{collector, queries}`.

## Decisions

- Public message as an embed: the colour bar is the third channel next to the icon and the word (DESIGN.md "three channels"); the title is the link, so no bare URL line. Colours are the DESIGN.md tokens sage `#586750`, yarn `#805c12`, seal `#8c2f2f`.
- The public link is `/events/<id>`, not `/`: a message read next week still opens its own event.
- Gains: top 3 by Might gain and top 3 by Kills gain, positive gains only, alliances fresh and not failed in both snapshots only (the same rule as `compute.delta`). A heading is left out when no alliance gained.
- Numbers and dates use one fixed `en-US` format: a webhook has no viewer locale. `lib/` may not import `app/_ui/format.ts`, so `lib/notify.ts` has its own small formatter with the same options (3 significant digits, one-decimal percent, real minus `−`).
- The finish time in "Last updated … at" is the notify time (`ctx.now()` after the row is final), not the start time.
- A negative lag in the admin run line reads `started −2 min`.

## Deviations

- IMPLEMENTATION_PLAN.md Phase 6 asks for public messages with "no numbers that need explaining", in fixed sentences, with `username: "LAPTracker"` and an `avatar_url`, and `[TEST]` on admin lines. The owner approved the new templates, the gains block and dropping the name override; the plan text is not edited here.
- `avatar_url` was never sent (the plan line was not implemented before this change); nothing changed there.

## Verified

- `pnpm check` → prettier clean, eslint clean, `tsc --noEmit` clean, `Test Files 24 passed | 1 skipped (25)`, `Tests 96 passed | 1 skipped (97)`.
- The old messages were rendered by running the old `lib/notify.ts` functions with sample values (Node 26 type stripping), before changing anything.
- No message was posted to either webhook; no upstream call was made.
- Not verified: how the embed looks in the Discord phone app. That needs a test post, which only the owner can ask for.

## Open issues

- A test post to each webhook would show the embed on a phone; not done, by the task's rule.
- `getEventDetail` runs once more per real snapshot (one read of the event's rows); a failure there falls back to an empty list and the message still goes out with `0/0 alliances`.

## Next

Session: 8 — Deploy, GitHub Actions, env, webhooks
Model / effort: keep (sonnet · medium) — no signal from this change about deploy work.
Owner must do first: merge this PR into `dev`; PREREQUISITES.md §6 row "Session 8".
Plan changes needed: IMPLEMENTATION_PLAN.md Phase 6 "Notifications" (the public templates, `username`/`avatar_url` override, `[TEST]` prefix) and §3.1 (verdict posted as `[TEST] Rehearsal PASS/FAIL`) describe the old messages.

<adjustments>
- Rehearsal admin messages now start with `[rehearsal]`, not `[TEST]`; the verdict's first line is `[rehearsal] ✓ Pass · <date> server` or `[rehearsal] ✗ Fail · …`. Step 4's "paste the two `[TEST]` admin messages and the verdict" means these.
- Discord messages no longer carry UTC. To check `before_at` / `after_at` in UTC, read the DB, not the message.
- The Friday message lines are `✓ Weekly API quota check · …`, `✓|⚠ N requests left`, `✓|⚠ Database N MB`, `Before snapshot …`, `After snapshot …`. The schema-version line asked for in the owner's adjustment goes into `quotaReportMessage` in `lib/notify.ts`, with its words in `lib/copy-discord.ts`.
- Payloads have no `username`: Discord shows the webhook's own name ("KvK Scout", "LAP Tracker Admin") and avatar as set in Discord.
</adjustments>

<adjustments for="Session 9">
- Step 1 waits for `[rehearsal] ✓ Pass` / `[rehearsal] ✗ Fail`, not `[TEST] Rehearsal PASS/FAIL`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/35
