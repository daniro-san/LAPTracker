# feat/788-plans — plans per alliance (issue 788)

## Built

- `workspaces.plan` (`free` | `premium`, default `free`) and `workspaces.plan_grandfathered` (default false), migration `drizzle/0086_fluffy_joystick.sql` from `pnpm db:generate` (regenerated after the rebase onto dev; it was `0080_plans.sql`). One line was added by hand to the end of the SQL file, as in 0057: `UPDATE "workspaces" SET "plan_grandfathered" = true;`. Every workspace that exists keeps what it has today, and a workspace made later starts on the free plan. `drizzle/meta` is as generated.
- `lib/workspace-features.ts`: `PLANS`, `PlanState`, `NEW_PLAN`, `PLAN_FEATURES` (the one mapping), `isPremium`, `planLocked`, `allowed`. `storedSettings` / `defaultSettings` take the plan and return `locked`. `resolveFeatures` reads `allowed`, so a premium feature on a free plan counts as one the owner did not allow. OGs (`OWN_ALLIANCE_ID`) and grandfathered workspaces have nothing locked.
- `lib/repo/workspace-features.ts`: the settings read also returns `plan` from the same join, with no new query. `setPlan` is one UPDATE of the two columns, so nothing is deleted.
- /admin: the workspace card shows "Plan: Free · grandfathered (keeps what it had)" (OGs: "Plan: everything (OGs)"). Its Features section has a Plan row with "Set Premium" / "Set Free" and "Grandfathered: On/Off". A switch the plan leaves out says "not in its plan". The route `{action: "plan", workspace_id, plan, grandfathered}` needs the PIN, counts as `ws_action` `features` / `plan` (the tracking plan is updated), and re-registers the Discord commands of a server that had them.
- Desk, officers only:
  - Alliance settings → Features lists a locked feature in its group with a "Premium" tag, the line "Part of the Premium plan. Nothing your alliance saved is lost." and a "See plans" link. The card ends with a link to the Plans page.
  - `/w/[slug]/settings/plans` shows the current plan, the Free and Premium lists (read from `PLAN_FEATURES`) with the reason for each, and "Changing plans deletes nothing."
  - `PlanPaymentSlot` takes the copy key `plans.payment` and renders nothing while the page's `PAYMENT_HREF` is null.
  - Copy in EN, PT-BR and FR is in `lib/private/dictionary.plans.ts`.
- Tests:
  - `lib/private/features.test.ts`, "plans (D162)": the mapping, free hides, premium unlocks, grandfathered keeps, a downgrade deletes nothing, OGs is unchanged.
  - `app/(private)/api/w/[slug]/features/route.test.ts`: on the free plan a feature shows only as a Premium note, and its switch gets 403 not_allowed.
  - `app/(private)/w/[slug]/turned-off.test.ts`: the Plans page sends a member to the board and renders for an officer; a free alliance's Insights page goes to Home.
  - `app/api/admin/workspaces/features/route.test.ts`: the plan action.
- D162 decision record and its index line.

### Persona panel: every FEATURE_GROUPS feature

Panel: product strategist (P), officer of a large alliance (L), officer of a small alliance (S), a member (M), privacy/safety reviewer (V), engineer (E), adversarial (A). The vote is core:premium.

| Feature | Plan | Vote | Reason |
| --- | --- | --- | --- |
| roll_call | core | 7:0 | Attendance basics that officers write; stored only. |
| garrison | premium | 5:2 | Owner's example (the suggestion); it reads the squads read. |
| thefts | core | 7:0 | The officers' log; stored only. |
| follow_up | core | 7:0 | People-first check-ins (D75); stored only. |
| insights | premium | 7:0 | Owner's example; computes over stored history on every open. |
| caravans | core | 5:2 | Calendar basics; its seat suggestion is pure and cheap. |
| notices | core | 7:0 | Discord sending of what officers write. |
| board | core | 7:0 | The members' board basics. |
| notice_translate, notice_improve, notice_fit, thanks_draft | premium | 7:0 | Each calls the model (AI). |
| ocr | premium | 4:3 | Our server reads every screenshot (CPU); typing still works. |
| discord_send | core | 7:0 | The officers' own message saved to the desk; no processing. |
| discord_translate_me, discord_translate_everyone | premium | 5:2 | Each calls the model (AI); the original stays readable. |
| post_callouts | core | 7:0 | The officers' own line on our posts. |
| post_week, post_summary, post_kvk | core | 4:3 | Members read them; stored data in a tick that opens the database anyway (D159); no upstream, no model. |
| post_shield_up | core | 7:0 | A safety reminder to members. |
| post_welcome | core | 6:1 | Members need it; stored data only. |
| squads | premium | 7:0 | Owner's example; about 106 tracker calls a day per 100 members. |
| shield_check | premium | 4:3 | Owner's example; about 200 tracker calls on Friday night per 100 members. |
| notice_pictures | core | 5:2 | Members see them; they cost storage, not processing. |
| export | core | 7:0 | Export and delete are never paywalled. |

Result: 15 core, 11 premium. Panel checks:
- Nothing privacy-related is premium. Export, workspace deletion and the private-field rules are unchanged.
- The safety reminder (post_shield_up) is free.
- Members never see plan words: they appear only in officer-only Alliance settings and on the Plans page, which sends a member to the board.
- The Plans page lists come from the enforced mapping, so the page and the enforcement cannot differ.

Contested items, for the owner to confirm (the split is above):
- `ocr` 4:3 premium. S, M and V: small alliances enter data through it. P, L, E and A: our server's CPU per read, and typing still works.
- `shield_check` 4:3 premium. V, M and S: it is close to safety. It was kept premium because the owner named it and the members' Shield-up reminder stays free.
- `discord_translate_*` 5:2 premium. M and V: members in mixed-language alliances depend on it.
- `garrison` 5:2 premium. S and M: making the pairs by hand is planning, not processing, but the tab is one switch.
- `post_week`, `post_summary`, `post_kvk` 4:3 core. P, E and A: complementary.
- `caravans` 5:2 and `notice_pictures` 5:2 core. P and A count the caravan suggestion as complementary; E and A note the storage cost of pictures.

The persona notes are in the session scratchpad (`788-persona-panel.md`); they are not committed.

## Decisions

- D162 (new): the plan model. The plan is a third check beside the owner's switch (`locked`), not written into the owner's stored switches. A plan change therefore never rewrites or deletes a stored value, and "Copy settings from" still copies only the owner's own values.
- The "Premium" note appears only where officers switch features: Alliance settings → Features. Tabs, buttons and pages that the plan leaves out are hidden as owner-off ones are (D126 amendment, issue 483). This is the reading of "where a premium feature would appear" that the existing hide-not-announce rule supports.
- The Plans page is a page under Alliance settings, linked from the Features card and each Premium note. It is not a new card, so the settings index does not change.
- The payment slot is "configured" by a link constant on the Plans page (`PAYMENT_HREF`, null now). No env var was added.
- Test fixtures that switch on premium features now put their workspace on the premium plan: `seedWorkspace` and the inserts in push-uses, tracker-key, raid-prep, features route, workspace-keys and the admin route test. The cross-workspace isolation suite runs unchanged on premium workspaces and stays green.

### Rebase onto dev (2026-11-28)

- Rebased onto origin/dev f7315fd6 (v5.71.0 patch notes). Dev's latest migration was 0085.
- Migration: took dev's `drizzle/meta/_journal.json` and snapshots, dropped this branch's `0080_plans.sql` and `0080_snapshot.json`, ran `pnpm db:generate`. The plan migration is now `0086_fluffy_joystick.sql` with `meta/0086_snapshot.json` and journal entry 86. The `UPDATE "workspaces" SET "plan_grandfathered" = true;` backfill was re-added by hand, as before.
- Decision number: D160 is dev's event windows and D161 dev's KvK plan, so this decision is now D162 (file `D162-plans-per-alliance-free-core-and-premium.md`, heading, index line, and every plan-related `D160` in code comments, tests, the tracking plan and this handoff). The event-window `D160` references from dev are unchanged.
- Conflicts resolved:
  - `lib/schema.ts` `workspaces`: kept dev's `castle_x` / `castle_y` (issue 791) and this branch's `plan`, `plan_grandfathered` and the `workspaces_plan_check` check, in the branch's table-with-checks form.
  - `docs/analytics/tracking-plan.md` `ws_action` table: took dev's table (new `left_reason`, `kvk_plan` rows, `notice_review` actions) and re-added this branch's one phrase in the `features` row, "D162: `plan` (a workspace's plan or grandfather flag)"; Prettier re-padded the table.
  - `drizzle/meta/_journal.json` and `drizzle/meta/0080_snapshot.json`: dev's, as above.
  - `docs/decisions/README.md`: dev's D160 and D161 lines, then the D162 line.
- `FEATURE_GROUPS` did not change on dev since this branch was cut, so `PLAN_FEATURES` needs no new entries.

## Deviations

- None from the task. No price, provider or payment code anywhere.

## Verified

- Before the rebase: `pnpm vitest related --run <changed files>`: 381 files passed, 2 skipped; 2065 tests passed, 4 skipped. `pnpm check`: green.
- After the rebase: `pnpm vitest related --run <changed files>`: 397 files passed, 2 skipped; 2161 tests passed, 4 skipped. `pnpm check` (prettier, eslint, tsc, vitest, drift "No schema changes", i18n): green, no timeouts.
- Not checked in a browser. The desk and /admin changes were exercised through the page and route tests only.

## Open issues

- How long grandfathering lasts is an owner decision. Today it lasts until the owner turns it off per workspace on /admin.
- New alliances now start on the free plan. Garrison, Insights and the screenshot reader were allowed by default before and are now locked until the owner sets Premium. The AI, translation and tracker-call features were already off by default (CODE_DEFAULTS).
- The local seed (`scripts/seed.ts`) creates workspaces through `saveWorkspace`, so a seeded non-OGs workspace is on the free plan unless the owner sets it on /admin.
- Dev's Insights → KvK map (issue 791) sits in the `insights` tab, so on the free plan it is hidden with Insights. Its write route `app/(private)/api/w/[slug]/kvk-castle/route.ts` checks no feature (it was the same on dev before plans), so a free, non-grandfathered alliance can still save a castle point it cannot see. Follow-up: gate that route on `insights` if the owner wants. Its tier follows `insights`; the owner may decide otherwise.
- docs/GLOSSARY.md has no entry for "plan" or "grandfathered". Add them if the owner wants these words in the glossary.

## Next

- Owner: confirm or move the contested items above. Moving one is a one-line change to `PREMIUM` in `lib/workspace-features.ts`.
- Owner: decide the length of grandfathering.
- Later, when payment exists: set the Plans page's `PAYMENT_HREF` (or read it from config), add the callout, and link it from the Premium note. Members still never see it.
- Follow-up: a designer-persona review of the Premium note and the Plans page at 360, 640 and 1280 px, in light and dark.

What was missing from the task prompt? Whether "where a premium feature would appear" meant only the officers' switch list or every tab and button. I read it as the switch list, to keep D126's hide-not-announce rule.

PR: (added by the orchestrator)
