# feat-476 — Two-layer switches, defaults for new alliances, tracker-call estimates (D134)

## Built

- **Two layers** (`lib/workspace-features.ts`). A feature is on when all three hold:
  - the owner allows it on /admin (D126's switch, now read as "allowed");
  - the alliance has it on in Alliance settings;
  - its allowance is not paused.
  - `resolveFeatures` applies the rule, so `featureOn`, the squads read, Discord command registration and the picture cleanup all follow it with no other change.
- **Alliance settings → Features** (`app/(private)/_ui/AllianceFeatures.tsx`, `lib/private/alliance-features.ts`, `POST /api/w/[slug]/features`).
  - Officers only, after `requireWorkspace`.
  - One checkbox per allowed feature, by group, saved at once. The box shows the tap at once and goes back on a refusal.
  - A feature the owner did not allow is not listed, and the route answers `403 not_allowed` for it.
  - Rate limit: 60 changes per 15 minutes per workspace, through `auth_attempts`.
  - Each change counts as `ws_action` `features` / `turn_on` or `turn_off`.
  - A Discord command's switch registers that server's commands again (D129).
  - EN, PT-BR and FR words are in `lib/private/dictionary.switches.ts`, spread through `dictionary.features.ts`.
- **Tracker-call estimates** (`TRACKER_CALLS`, `trackerEstimate`):
  - squads: 1.06 calls per member a day;
  - Raid Shield check (`shield_check`, new catalog key, not built yet): 2 calls per member, once a week.
  - The member count is the newest daily roster's (`latestMemberCounts` in `lib/queries/rosters.ts`), or 100 before any read.
  - Alliance settings shows the total line and each feature's own calls. /admin shows the same total on each card.
- **Defaults for new alliances** (/admin, `app/_ui/admin/FeatureDefaults.tsx`): one on/off value per feature and one value per cap, stored in the one-row table `feature_defaults`.
- **Only overrides are stored.**
  - `workspace_features.switches` and the new `caps` jsonb map hold only the values that differ from the defaults.
  - A value set equal to its default stores nothing, and "Reset to default" removes the key.
  - The alliance's switches are in `alliance_switches`.
  - Each workspace card on /admin shows "Default (On)" or "Changed: On", "Reset to default", and "the alliance turned it off". Caps read "Default (30)" or "Changed: 50 · default: 20".
- **"Copy settings from"** stores only what differs from the target's defaults. It does not copy the alliance's own switches.
- **Migration `0057_two_layer_switches`** (generated again after the rebase onto dev with #505, #506, #508 and #510):
  - adds `feature_defaults`, `workspace_features.caps` and `alliance_switches`;
  - moves each cap the owner had set into `caps` (a data step, hand-added between the generated statements);
  - drops `ai_per_day` and `translate_per_day`.
- **New analytics actions**: `reset` and `default` (tracking plan updated).
- **Docs**: D134; dated amendments to D126, D129 and D130.

## Decisions

- **D134**, written up in `docs/decisions/`.
- **Every catalog feature has both layers**, tabs included. The alliance's switch is on by default, except for features that spend tracker calls: those wait for the officers, so a new alliance spends no tracker call until both layers say on. OGs: everything on, as before.
- **OGs ignores the defaults panel**: everything allowed, no caps, from code, as in D126.
- **The code's default caps are 20 Groq texts and 20 Discord languages a day.** The owner asked for "a small number".
- **Toggling a switch to its default's value removes the override**, so "Changed" always means different from the default. "Reset to default" is also shown, as the owner asked.

## Deviations

- **"Details lookups"**: no feature spends tracker calls on a details lookup today. D98's member details are read from our own database. So the catalog has no entry for it, and a future one adds a `TRACKER_CALLS` entry.
- **Raid Shield check**: the switch and its estimate exist, but the read is issue 474.
  - /admin names it "not built yet, issue 474".
  - It is off by default for every alliance but OGs.
  - The estimate uses the task's "about 100 per read, 2 reads": the upper bound, since issue 474's second pass reads only those not yet shielded.
- **Not built here**:
  - a per-workspace tracker-calls cap (the squads read's own 120 cap stays);
  - enemy KvK reads (issue 306);
  - our own key's planned use on /admin (issue 485).
- **"Today's use" on Alliance settings** is the key card's existing "Quota left" and D132's "Squads today" line beside it.

## Verified

- **`pnpm check` passes** after the review fixes: Prettier, ESLint, typecheck, Vitest (1,328 tests in 250 files), drift and i18n.
- **New tests**:
  - `lib/private/features.test.ts`: a default change moves only workspaces on it; both layers; the estimate.
  - Admin route test: only differences stored; Reset; defaults and their PIN.
  - New `app/(private)/api/w/[slug]/features/route.test.ts`: only allowed features listed and settable; the estimate from the roster; the rate limit; no session.
  - The issue 471 isolation suite: Alpha changes only its own switches; Alpha's session at Bravo's address is `401`; only Alpha is counted.
  - The member-session fixture for the new route.
- **Updated tests**: `workspace-keys.test.ts` and `tracker-key/route.test.ts`. Squads is now off by default for non-OGs, so their setup turns it on.
- **Migrations**: all 58 applied to an empty local Postgres 18. A seeded test proves 0057's cap step: caps set under the 0056 schema move into the `caps` map, and nulls are left out.
- **Local production build**: `next build` and `next start`, local Postgres, invented data (OGs with 101 members; guest "wolf" with 87 members, squads allowed and on, Thefts off by the alliance, defaults with Download off and an AI cap of 30). **116 of 116 checks pass**:
  - each settings page answers 200, with no sideways scroll and no private field in the HTML, at 360 and 1280, light and dark, EN and PT (FR at 360);
  - the estimate reads 93 a day for 87 members;
  - features the owner did not allow are absent;
  - labels are at least 44 px;
  - a tap off moves the estimate to 0, and a tap on brings back 93;
  - OGs reads "about 108 a day, and 310 on Saturdays (UTC)";
  - /admin shows the defaults, Changed, Default, the alliance's own off and the caps;
  - Reset puts the squads read back to "Default (Off)";
  - allowing the squads read by default asks first.
  - Screenshots are in the scratchpad's `476-shots/`.
- **Persona panel** (the owner, a guest R5 reading PT and EN, product strategy). Five agreed fixes, all applied and checked again in the e2e:
  - the quota line says "of the 1,000 calls a key has each day";
  - the alliance's peak day is named "the Raid Shield day (Friday night, server time)", one time base with the feature's own line;
  - /admin shows the estimate in each card's summary, and the feature labels are shorter ("Squads read (own key)"), with one help line for the calls;
  - allowing a feature that spends quota in "Defaults for new alliances" is asked first;
  - the PT lead reads "Se você desligar um recurso, ele some…";
  - /admin's "Notice Translate" now reads "Translate a notice", the same as Alliance settings.
- **The panel's "not now" items**, for the owner to decide:
  - a table comparing every alliance's estimate on /admin;
  - one line under each feature name;
  - moving "Notice pictures" and "Download our data" out of the tracker-calls group;
  - a way for officers to ask the owner for a feature that is absent.
- No upstream, Discord or PostHog call was made.

## Open issues

- **Review of PR 511**, fixed here:
  - a changed default for notices or notice pictures restarts the picture warnings of every workspace on it (`setDefault`);
  - a seeded test covers 0057's cap step;
  - after a save, the checkbox shows the switch as the server stored it;
  - D134 points the parts not done to issues 306 and 485.
- **Left for a follow-up the orchestrator files**:
  - tests for re-registering the Discord commands after a switch;
  - moving the "a value equal to its default is no override" rule out of the /admin route into the repo;
  - the review's suggestions.

- **After the release**, every alliance other than OGs without its own value has its squads read off, and its caps become 20. The owner allows squads on its card, and its officers turn it on in Alliance settings.
- A row written earlier by "Copy settings from" has every switch stored, so the card shows "Changed" even for values equal to the default. "Reset to default" clears each one.
- **Rebased onto dev** after #505 (D132), #506 (hidden turned-off features), #508 (D133) and #510. Conflicts resolved:
  - the settings page reads both D132's "Squads today" and D134's Features;
  - /admin Workspaces keeps #508's alliance choices and adds the defaults;
  - `dictionary.features.ts` keeps #506's deletions and adds the switches;
  - the /admin Features help keeps #506's "its address goes to Home";
  - the decision index, D126 and D130 keep both sides' amendments.
  - The migration was generated again as 0057.
- **The #506 rule holds**: a feature the owner did not allow is absent from Alliance settings, with no line about it. A feature the alliance turns off is hidden by the same openers as an owner's "off".
- After a successful tap, the Features card keeps showing that tap until the next one. If another officer changes the same feature meanwhile, the page shows the old tap until reload.

## Next

- Model/effort: keep.
- **Owner first**:
  - after the release, open /admin → Workspaces → "Defaults for new alliances" and check the values;
  - allow the squads read on each guest alliance's card that should keep reading squads;
  - tell their officers to turn it on in Alliance settings → Features.
- Plan change: none.

<adjustments>
- #474: the switch is `shield_check`. Gate the read with `featureOn(access, "shield_check")`; `squadTargets`-style code uses `resolveFeatures`. Its estimate is in `TRACKER_CALLS`: replace `perMember: 2` once the real second pass is measured. Remove "not built yet, issue 474" from `lib/copy-admin-features.ts`.
- #306: add a `TRACKER_CALLS` entry if it reads on a workspace key. It runs on our key, so the estimate may belong to /admin's own-key line (#485) instead.
- #485: per-workspace estimates already exist (`trackerEstimate` plus `latestMemberCounts`). Reuse them.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/511
