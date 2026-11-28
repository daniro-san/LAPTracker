# feat/788-plans — plans per alliance (issue 788)

## Built

- `workspaces.plan` (`free` | `premium`, default `free`) and `workspaces.plan_grandfathered_until` (timestamptz, null: not grandfathered). Migration `drizzle/0093_plans.sql` comes from `pnpm db:generate`; it was renamed from `0093_fluffy_spirit` and its journal tag changed to match. One statement was added by hand at the end: `UPDATE "workspaces" SET "plan_grandfathered_until" = now() + interval '3 months';`. The same migration widens `workspace_usage_allowance_check` to `('ai', 'translate', 'ocr')`.
- `lib/workspace-features.ts`:
  - The plan model: `PLANS`, `PlanState` (`plan`, `grandfathered`, `grandfatheredUntil`), `NEW_PLAN`, `PLAN_FEATURES` (the one mapping), `isPremium`, `planLocked`, `allowed`.
  - New in this update: `GRANDFATHER_MONTHS` (3), `FREE_SHOTS_A_WEEK` (20), `shotsWeek` (the UTC Monday of a date) and `planShotsAWeek`.
  - `FeatureSettings` and `WorkspaceFeatures` carry `shotsAWeek` (null: no cap) and `grandfatheredUntil` (null for OGs and for a workspace that is not grandfathered).
- `lib/repo/workspace-features.ts`:
  - The settings read computes `grandfathered` as `plan_grandfathered_until > now()` on the database's clock, in the same query.
  - `setPlan(db, id, { plan, grandfathered? })`: `true` sets the end to now plus 3 months, `false` clears it, and leaving it out keeps it.
  - `spend` also takes `ocr`. `usageOn` skips `ocr` rows, so /admin's daily AI and translation counts are unchanged.
- Raid Shield split (owner, 2026-11-28). No new key was needed: the code already gates exactly the owner's premium parts on `shield_check` (the night, after-reset and morning reads, "Accept the tracker's", the auto-filled "To check by hand", the counts post, the read times from #859). The manual marks and the copies belong to `roll_call`, and the reminder is `post_shield_up`; both stay free.
- OCR cap. `ocr` is no longer premium. `lib/private/features.ts` `useShotReads(db, ws, pictures, now)` counts the pictures against the week's cap in one statement, or refuses with nothing counted and nothing read. It is called from:
  - `/api/w/[slug]/shots/read` (one picture, used by Send screenshots and Read from a screenshot): on refusal, 429 `cap_reached`.
  - `/w/[slug]/share` (all shared pictures): on refusal, Home shows `?shared=cap`.
  - The Discord command job `lib/private/import-discord.ts` (the message's pictures): on refusal, the reply says so and the pictures can be sent again.
  - The clients show the `shots.cap` line (EN, PT-BR, FR). `post` now carries the response's `code` as the error's `cause`, so a 429 `cap_reached` is told apart from a 429 `busy`. Send screenshots still makes drafts from the pictures it read before the cap.
- Grandfathering notice: `app/(private)/_ui/GrandfatherNotice.tsx` on Home (officers only) says until when the alliance keeps everything, with a "See plans" link. The Plans page's first line says the same, and the page also gives the weekly screenshot limit. The date uses `deletionDate` (UTC, with year).
- /admin:
  - "Set Premium / Set Free" sends only the plan.
  - "Grandfathered: On" starts a new 3-month window; Off ends it.
  - The card line reads "Plan: Free · grandfathered until YYYY-MM-DD (keeps what it had)".
  - The help text gives the weekly screenshot limit and the 3 months.
- `recruit_check` was added to the premium set.
- D162 updated: the owner's tiers, the cap, the window and OGs forever.
- Tests, one per behaviour:
  - `lib/private/raid-prep.test.ts` "Raid prep on the free plan": an officer's Shield and Squads-off-the-wall marks are saved and listed, and `roll_call` and `post_shield_up` are on. A second test checks that the automated reads are off: no hints, no counts, no To check by hand, no summary, and Accept the tracker's is refused. The same alliance on premium reads them.
  - `lib/private/features.test.ts`:
    - The mapping test now includes recruit_check as premium and ocr as free.
    - The OCR cap: 20 a UTC week, refused with nothing counted, a new count on Monday, and no cap on premium.
    - The grandfathering window: about 3 months, then the free plan applies and the notice date goes away.
    - OGs keeps everything forever: no cap and no end date, even with grandfathering on.
  - `app/(private)/w/[slug]/turned-off.test.ts`: a member's board on a free, still-grandfathered alliance renders with none of the plan words in EN, PT-BR or FR, and no "premium" anywhere.
  - Fixtures whose non-OGs workspace switches on premium features are now on premium: recruit-check route, glossary route, shield-reset second alliance. `lib/private/dictionary.test.ts` traces the new date sentence to its caller.

### Tiering table (for the owner to review)

Rule used: features that read the tracker or call the model are premium; features for people and safety, and features that only store what officers write, are free.

| Feature (switch) | Tier | Why |
| --- | --- | --- |
| roll_call (includes Raid prep's own marks, Copy n names, Copy one message) | free | Officers' own marks; stored only. Owner, 2026-11-28. |
| garrison | premium | Owner's example; the suggestion reads the squads read. |
| thefts | free | The officers' log; stored only. |
| follow_up (hellos, joined this week, buddy, KvK follow-ups) | free | People first (D75); stored data. |
| insights (Insights → KvK map included) | premium | Owner's example; computes over history on each open. |
| caravans | free | Calendar basics. |
| notices (KvK plan and KvK claims ride on it) | free | Discord sending of what officers write; members ask for a role. |
| board (away days included) | free | The members' board. |
| notice_translate, notice_improve, notice_fit, thanks_draft | premium | The model (AI). |
| glossary (no switch of its own; shows while a translating feature is on) | premium in effect | Part of the AI features, as asked. |
| ocr (screenshot reader) | free, capped at 20 a UTC week | Owner, 2026-11-28: a cap, not a lock. |
| discord_send | free | The officers' own message. |
| discord_translate_me, discord_translate_everyone | premium | The model (AI). |
| post_callouts | free | The officers' own line on our posts. |
| post_week, post_summary, post_kvk, post_kvk_soon | free | Members read them; stored data, no tracker call, no model. |
| post_shield_up | free | Safety reminder. Owner, 2026-11-28. |
| post_welcome | free | Members need it. |
| squads | premium | About 106 tracker calls a day per 100 members. |
| shield_check (automated reads, Accept the tracker's, To check by hand, the counts post, read times) | premium | Owner, 2026-11-28. |
| raid opponent (#865, D165, on dev; behind `shield_check`) | premium | Tracker reads of the opponent; follows `shield_check` with no code change. |
| recruit_check | premium | Up to 20 tracker reads a day. |
| notice_pictures | free | Members see them; storage, not processing. |
| export | free | Export and delete are never paid. |

Areas with no switch (Members, member card, last seen, joins and leaves, the public alliance and player pages) are not gated by a plan and stay free.

## Decisions

- D162 is still free on origin/dev (dev has D160, D161, D163 to D166), so the decision keeps its number.
- The grandfather flag became an end date (`plan_grandfathered_until`). The window is checked in SQL with `now()`, so one read cannot disagree with itself. `planLocked` stays pure and takes the computed boolean.
- The OCR count reuses `workspace_usage` with `allowance = 'ocr'` on the week's Monday. It does not join `ALLOWANCES`, so /admin shows no new cap or pause for it. A batch (a share or a Discord message) is counted all at once and refused as a whole if it would pass the cap. "Send screenshots" reads one picture per request, so it stops at the cap and keeps what it read before.
- A failed read is not given back to the screenshot count, unlike the AI allowance. The count is what our server was asked to read.
- The grandfathering notice is on Home, not on every page. Home is the officers' landing page, and members never reach it.

### Rebase onto dev (2026-11-28, second time)

- Local branch `feat/788-plans-v2`: `feat/788-plans` is checked out in another worktree. It was rebased onto origin/dev 51d748f3 (newest migration 0091). #865 merged during the session and added `0092_raid_opponent`, so I rebased again onto origin/dev 6298105c and regenerated the migration as 0093.
- Migration: I took dev's `drizzle/meta`, dropped this branch's `0086_fluffy_joystick.sql` and `0086_snapshot.json`, changed the schema (end date instead of the flag, and `ocr` in the usage check), and ran `pnpm db:generate`. The result is `0093_plans.sql` with `meta/0093_snapshot.json` and journal entry 93, and the backfill was re-added by hand.
- Conflicts resolved: `lib/analytics/server.ts` (dev's `decline`, then this branch's `plan`; the leftover comment saying D160 now says D162); `docs/analytics/tracking-plan.md` (dev's table, with the `plan` phrase re-added and Prettier run); `turned-off.test.ts` (both imports); the admin route test (dev's `recruit_check` plus `locked`); the decisions README (D162 before D163).

## Deviations

- None from the task. No price, provider or payment code anywhere.

## Verified

- `pnpm vitest related --run <changed files>`. The first run had 19 failures in 8 files. Fixtures without a plan accounted for 14, and one more was the dictionary's date-sentence test. Four were timeouts in cross-workspace, tick, squads-read and discord-interaction while all 422 files ran at once: three passed when run alone, and discord-interaction was a real failure, because the cap check read the clock once more than before. After the fixes, the related runs are green.
- On base 51d748f3, `pnpm check` (prettier, eslint, tsc, vitest, drift "No schema changes", i18n) was green: 420 files passed and 2 skipped; 2320 tests passed and 4 skipped.
- On base 6298105c, after #865 merged: `vitest related` showed 4 failures in #865's raid-opponent fixtures (a non-OGs workspace with no plan). They were put on premium, and both files pass. `pnpm check` was then run twice. Prettier, eslint and tsc pass. Vitest: 2330 tests pass, and the same 2 fail both times by hitting the 10 s timeout: `lib/squads-read.test.ts` "reads every member once…" and `cross-workspace.test.ts` "is refused every time…". Run alone, both pass on this branch (12.7 s and 17.4 s) and take the same time on origin/dev 6298105c (13.2 s and 16.1 s). They are existing slow tests that time out when the full suite loads this machine; this change does not cause them. Because vitest failed, `pnpm check` stopped before the drift and i18n steps on this base, so I ran both on their own: `scripts/check-drift.ts` passes and i18n reports 17 languages up to date.
- Not checked in a browser. Home's notice, the Plans page and the cap lines were exercised only by the tests above.

## Open issues

- `app/(private)/api/w/[slug]/kvk-castle/route.ts` checks no feature (it was like this on dev before plans), so a free alliance can save a castle point for the Insights map it cannot see. This is an existing bug and was not changed here.
- Before plans, Garrison, Insights and Read from a screenshot were allowed by default for new alliances. Now Garrison and Insights are locked until the owner sets Premium. Screenshots are free up to 20 a week.
- docs/GLOSSARY.md has no entry for "plan" or "grandfathered".

## Next

- Owner: review the tiering table above. Moving a feature between tiers is a one-line change to `PREMIUM` in `lib/workspace-features.ts`. The cap is `FREE_SHOTS_A_WEEK`.
- If another migration lands on dev before this PR merges, rebase and regenerate this one onto the next number.
- Follow-up: gate `kvk-castle` on `insights`.
- Follow-up: a designer-persona review of Home's notice, the Premium note and the Plans page at 360, 640 and 1280 px, in light and dark.
- When payment exists: set the Plans page's `PAYMENT_HREF`, add the callout, and link it from the Premium note. Members still never see it.

What was missing from the task prompt? Whether one shared or Discord batch that would pass the weekly cap should read part of the batch or none of it. I read none (one statement, all or nothing); Send screenshots reads one picture per request, so it stops at the cap.

PR: (added by the orchestrator)
