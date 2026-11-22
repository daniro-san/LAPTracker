## D134 — Two-layer switches: the owner allows a feature on /admin, the alliance turns it on in Alliance settings, over "Defaults for new alliances"; every feature that spends tracker calls is a switch with an estimate (2026-11-20, owner, issue 476; amends D126, D129, D130)

Why: the owner (issue 476, 2026-11-20) wants every feature that spends quota to be controllable, and some switches in the alliances' own hands. The owner's comment of the same day adds defaults: one value per feature and per daily cap, set once on /admin, which a new workspace starts with and a workspace follows until the owner changes its own value.

**Two layers.** A feature is on when all three hold (`resolveFeatures` in `lib/workspace-features.ts`, so `featureOn`, the squads read, the Discord commands and the picture cleanup all follow it):

1. **The owner allows it** (/admin, D126's switch per workspace, now read as "allowed").
2. **The alliance turns it on** (Alliance settings → Features, officers only, after `requireWorkspace`).
3. **Its allowance is not paused for everyone** (D126, unchanged).

- A feature the owner does not allow is **not listed** in Alliance settings at all, and `POST /api/w/[slug]/features` answers `403 not_allowed` for it (a stale page). There is no "Not available for your alliance" line (D126 amendment of issue 483: turned-off features are hidden, never announced).
- **Every catalog feature has both layers.** The alliance may turn off anything the owner allows, tabs included.
- **The alliance's switch defaults to on**, except for a feature that spends tracker calls on its own key (`TRACKER_CALLS`): that one waits for the officers to turn it on, so a new alliance spends no tracker call until both layers say on. OGs (`OWN_ALLIANCE_ID`): everything on, as before.
- Turning a feature off never deletes data (D126).
- **The officers' switch** is one tap on a checkbox, saved at once. It is rate limited to 60 changes per 15 minutes per workspace (`auth_attempts`, the same limiter as D129's Check). It counts as `ws_action` `features` / `turn_on` or `turn_off` on the officer's pseudonymous id.
- A Discord command's switch registers the alliance's commands again when its server had them (D129), like the owner's switch.

**Defaults for new alliances.** /admin has a "Defaults for new alliances" panel above the workspaces: one on/off value per feature and one value per daily cap (a number, or empty for no cap).

- They are stored in `feature_defaults`, one row, holding only the values the owner set. A missing key keeps the code's defaults (`CODE_DEFAULTS`):
  - the free features allowed;
  - every feature that spends the owner's Groq limit, a Discord translation or tracker calls not allowed;
  - each daily cap at 20 (Groq texts; Discord languages).
- **Only overrides are stored per workspace.** `workspace_features.switches` and the new `workspace_features.caps` map hold only the values that differ from the defaults. A missing key means "the default". So changing a default moves every workspace still on it at once, and leaves a workspace whose value was changed as it is.
  - Setting a workspace's value equal to its default stores nothing.
  - "Reset to default" removes the key.
  - The alliance's own switches are stored in `workspace_features.alliance_switches`.
- **OGs ignores the defaults panel**: everything allowed, no cap (D126, from code).
- **/admin's card** shows each switch as "Roll call: Default (on)" or "Squads read: Changed: on", with "Reset to default" beside a changed one, and "the alliance turned it off" when the alliance did. Each cap shows "Default (20)" or "Changed: 50 · default: 20" with "Reset to default".
- **Copy settings from** now stores only what differs from the target's own defaults, so the copy keeps following the defaults where the source did. The alliance's own switches are not copied.

**Quota-spending features in the catalog, with estimates.** `TRACKER_CALLS` lists the calls per member each feature spends on the alliance's key, from real numbers:

| Feature                                     | Calls                                                                                                                      | Source                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Squads read (`squads`)                      | 1.06 per member, every quota day: about 106 per 100 members                                                                | the read of 2026-11-18: 106–107 calls for 101 members (5 of 100 answered 502 and were tried again), D132 |
| Raid Shield check (`shield_check`, new key) | 2 per member, once a week (two reads on Friday night, server time, in Saturday's UTC quota day): about 200 per 100 members | issue 474: about 100 calls per read, a second read                                                       |

- **The Raid Shield check is not built yet** (issue 474). Its switch exists so the owner and the alliance can decide before it ships, and its code checks `featureOn(access, "shield_check")`.
  - It is off by default for every alliance but OGs.
  - /admin names it "not built yet, issue 474".
  - Allowing it now changes nothing but the estimate.
- **Estimates.**
  - The member count comes from the alliance's newest daily read with a count (`latestMemberCounts`), or 100 (an alliance's capacity) before any read.
  - Alliance settings says "Tracker calls with your choices: about {daily} a day, and {peak} on the Raid Shield day (Friday night, server time), of the 1,000 calls a key has each day. Counted for {members} members." Each tracker feature also says its own calls, in EN, PT-BR and FR.
  - /admin shows the same line on each workspace's card. It counts what is on now, both layers and the pauses.
- Today's use stays where it is: the key card's "Quota left", and D132's "Squads today" progress line beside it.
- **Details lookups spend no tracker call today.** D98's member details are read from our own database on open, so they are not in the catalog. A future feature that calls the tracker adds a `TRACKER_CALLS` entry and is a switch.
- **Not done here, tracked elsewhere:**
  - enemy KvK reads: issue 306;
  - our own key's planned use on /admin: issue 485;
  - a per-workspace cap on tracker calls: a line in issue 485. Until then, the squads read's own cap stays 120 calls a day (D117, D132).
- **When a default for notices or notice pictures changes**, D119's warnings start again in every workspace that follows it (every one but OGs and those with a value of their own), as the owner's switch on one workspace does (D126). A picture is never deleted without a full 7-day warning on Home.

**Existing workspaces after the release.** An alliance other than OGs with no override of its own follows the new defaults.

- **Its squads read is off** until the owner allows it on its card and its officers turn it on in Alliance settings.
- **Its two caps become 20** where the owner had not set one.
- The migration moves each cap the owner had set into the `caps` map. A row whose switches were all stored by an earlier "Copy settings from" shows every value as "Changed", even when it equals the default. "Reset to default" clears it.

**/admin's words (English only, D48).** D126's "Notice Translate" now reads "Translate a notice", as in Alliance settings. In "Defaults for new alliances", allowing a feature that spends tracker calls or a paid allowance is asked first: "Every alliance whose card says Default for {name} gets it allowed now, and starts spending once its officers turn it on. Allow it by default?"

**Analytics.** New `ws_action` actions for `features`:

- `reset`: an /admin value back to its default;
- `default`: a default for new alliances changed;
- `turn_on` and `turn_off` also count the alliance's own switch, with the officer's id and `area` desk.

**Tests.**

- `lib/private/notice-picture.test.ts`: a default that turns pictures off and on between two cleanups gives the picture a fresh 7-day warning.
- `lib/repo/workspace-features-migration.test.ts`: migration 0057 moves each cap that was set into the `caps` map, from rows seeded under the 0056 schema, and leaves out the caps that were null.
- `lib/private/features.test.ts`:
  - a changed default moves the workspaces on it and never one with its own value, nor OGs;
  - a feature is on only when both layers say on;
  - the estimate.
- `app/api/admin/workspaces/features/route.test.ts`:
  - only differences are stored;
  - Reset;
  - the defaults route and its PIN.
- `app/(private)/api/w/[slug]/features/route.test.ts`:
  - only allowed features are listed and can be turned on, and the answer carries the switch as stored;
  - the estimate from the newest roster;
  - the rate limit and a missing session.
- The issue 471 isolation suite: Alpha's officer changes only Alpha's switches, Alpha's session at Bravo's address is `401 signed_out`, and only Alpha is counted.
- The member-session suite has the new route's fixture.

**Amendment (2026-11-20, owner, issue 474, D137): the Raid Shield check is built.** /admin no longer says "not built yet, issue 474". Its estimate is one read per member when the squads read is on (Friday's read is the squads read), two when it is off: about 206 calls on Saturday's quota day for 100 members with both on. See D137.

**Amendment 2026-11-22 (orchestrator under the owner's standing approval, issue 585 batch 2b): the officers' switch saves on Save.** In Alliance settings → Features a tick now changes only a draft; the card shows "Not saved yet: n changes" until the officer taps Save, and the browser asks before a reload or close while changes wait. Save sends the same `POST /api/w/[slug]/features`, one switch at a time, and stops at the first refusal, keeping the switches not yet sent as the draft. The route, its limit (60 changes per 15 minutes) and `ws_action` `features` / `turn_on` or `turn_off` (one per switch that went through) are unchanged. Why: the page had two save models side by side (Features at once, the Raid Shield check with a Save button), and one tap hid a tab from every officer with nothing saying so (#585, F28).

**Amendment 2026-11-22 (issue 713, D156).** The catalog gains `post_callouts` in the Discord group ("Your line on our posts"; /admin "Alliance's line on our posts"). It spends nothing, so it is allowed and on by default. Off, saved lines stay and no post carries one.
