# feat-486 — onboarding analytics and the Workspaces dashboard

## Built

- Six of the issue's eight events were already on dev, added by the #451 and #453 builders: `ws_access_requested`, `admin_workspace_approved`, `ws_invite_opened`, `ws_invite_completed`, `ws_bot_installed` and `ws_webhook_set`. This change adds the other two and one server action.
- `ws_key_saved` `{state}` (`lib/analytics/events.ts`, `TrackerKeyState`). It fires in `app/(private)/_ui/TrackerKeyForm.tsx` after "Save and test" goes through, with the state the route answered. A refused key (422) sends nothing. Remove sends nothing.
- `admin_feature_changed` `{feature, on}`. It fires in `app/_ui/admin/WorkspaceFeatures.tsx` from `run`'s `ok` callback, which runs only on a 2xx answer, when one workspace's switch is pressed or Reset, or a cap is saved or Reset. `feature` is a D126 switch or `ai_cap` / `translate_cap`. `on` is the value afterwards; for a cap it means "not 0". The event fires only when the value changes. Reset uses the workspace's default, so `FeaturesView` gained `defaultOff` (`features-view.ts`). The cap's Save and Reset are now disabled while a press is on its way, like the switches.
- Server `ws_action` `workspace` / `create`, sent from `POST /api/w/invite` after "finish". It goes through `counted` on the new officer's pseudonymous id, with `workspace` and `alliance`. `inviteStep`'s finish result now carries `userId`, which is never put in the answer. `counted` now takes the three fields it reads instead of a whole `WorkspaceAccess`. `DESK_FEATURES` gained `workspace` and `DESK_ACTIONS` gained `create`.
- `docs/analytics/tracking-plan.md`: rows for the new events and action, and the funnels rewritten.
- Tests: `events.test.ts` has four type-level lines for the two events. `lib/private/invite.test.ts` checks that finish returns her user id. The new `app/(private)/api/w/invite/route.test.ts` checks the `workspace/create` payload.

## Decisions

- An amendment to D115 (2026-11-21), not a new Dnn. It says why the way in is counts and the setup funnel runs on server `ws_action` steps.
- The way in and the setup are not one funnel. Nothing joins them: the request comes from a visitor with no id and the approval from the owner. A signed-out `/w` page gets a new random id on every load, and nothing carries `workspace` before the workspace exists. The setup funnel starts at `workspace/create` and is aggregated by `properties.workspace`.
- The setup steps are server events, because browser events are lost when a tab closes, to ad blockers, and outside production. `ws_bot_installed` is not a step: an invite's "finish" marks the bot seen, so Check never reports it seen for the first time in an invited alliance. The tracker key is optional (D134), so it is a column in the table, not a funnel step.
- `admin_feature_changed` covers one workspace's switches and caps only, the issue's "turns a feature on or off, or changes a cap". It does not cover "Copy settings from", the global pause, the defaults for new alliances, or the alliance's own switch. Those are still counted by `ws_action` `features`.

## Deviations

- The issue's funnel is "requested → approved → bot installed → key saved → first roll call → first notice". What was built instead:
  - The way in shows as weekly counts.
  - The setup funnel runs created → webhook → roll call marked → notice published.
  - A per-alliance table holds the key and the `add` steps.
- I made no PostHog changes. The spec is below, for the orchestrator.

## Verified

- `pnpm check` exits 0 (prettier, eslint, tsc, vitest, drift, i18n).
- The QA panel ran a local production build at `70162ba2`, with every PostHog request caught in the browser and the tracker-key route answered by Playwright, so no upstream call was made. 33 of 33 checks passed:
  - `ws_key_saved` was sent once with `state` plus `workspace` and `alliance`, and nothing was sent on a 422.
  - `admin_feature_changed` was sent exactly once per change, with no workspace or alliance, and nothing on a same-value save or a 429.
  - No payload held the key, its last 4 characters, the PIN, a name or a path.
  - Files are in the orchestrator's `scratchpad/486/`.
- QA did not run the invite's `workspace/create`. The new route test covers it: one `ws_action` event on `analyticsPersonId(her id)`, `feature: workspace`, `action: create`, `workspace: wack`, and no Discord id or guild id in the payload.
- Panel: the adversarial and product-strategy reviews both reached me. I applied their MUSTs: the Reset value, the impossible person funnel, the bot step, the server-event steps and the funnel start. I also applied the SHOULDs: same-value cap, busy cap buttons, the plan saying which event the dashboard uses, refusals not counted, `mark` / `publish` steps, the webhook step, retention for officers and members, and leaving out OGs and test workspaces.

## Open issues

- On a same-value cap save, the server's `ws_action` `features` / `cap` still fires. This was already the case before this change. Follow-up.
- `ws_invite_completed` runs `track` right before `window.location.assign`. If PostHog is still loading, the event is lost. This was already the case before. `workspace/create` now counts the same moment on the server.
- `ws_bot_installed` is never sent for invited alliances (see Decisions). It still counts alliances set up by the owner on /admin.
- If a check's answer is lost after the server recorded `firstSeen`, the retry gets `firstSeen: false`, and `ws_bot_installed` never fires. This is rare.
- `TrackerKeyForm` still makes its request id with `crypto.randomUUID`, not `newRequestId()`. This was already the case before.
- The issue's alert and the #484 Endpoints are for the orchestrator. The setup table is the query #484's Endpoint can reuse.

## PostHog dashboard (for the orchestrator)

Project 741657. Dashboard name: **Workspaces**. Every setup insight filters `properties.workspace NOT IN ('ogs', <test workspace slugs from /admin>)`. Breakdowns use `alliance`.

1. **Way in (weekly counts)**: Trends, weekly, total count, series:
   - A `ws_access_requested`;
   - B `admin_workspace_approved`;
   - C `ws_invite_opened`;
   - D `ws_invite_completed`;
   - E `ws_action` where `feature = workspace` and `action = create`.

   Formula series `D / C` ("invites completed per invite opened"). It is not a funnel: these steps share no person.
2. **Requests by roster match**: Trends, weekly, `ws_access_requested` total count, breakdown `roster_match`; a second breakdown on `claimed_role`.
3. **Setup funnel per alliance**: Funnel, ordered, conversion window 30 days, aggregated by HogQL `properties.workspace` (`funnelAggregateByHogQL`), steps:
   1. `ws_action` `feature = workspace`, `action = create`;
   2. `ws_action` `feature = discord`, `action = save` (a webhook);
   3. `ws_action` `feature = roll_call`, `action = mark`;
   4. `ws_action` `feature = notice_publish`, `action = publish`.
4. **Setup table per alliance**: a SQL insight, saved for #484's Endpoint. Each empty `days_to_*` cell is the step that alliance has not reached:

   ```sql
   WITH w AS (
     SELECT
       properties.workspace AS workspace,
       argMax(properties.alliance, timestamp) AS alliance,
       minIf(timestamp, event = 'ws_action' AND properties.feature = 'workspace' AND properties.action = 'create') AS created,
       minIf(timestamp, event = 'ws_action' AND properties.feature = 'tracker_key' AND properties.action = 'save') AS key_saved,
       argMaxIf(properties.state, timestamp, event = 'ws_key_saved') AS key_state,
       minIf(timestamp, event = 'ws_action' AND properties.feature = 'discord' AND properties.action = 'save') AS webhook,
       minIf(timestamp, event = 'ws_action' AND properties.feature = 'roll_call' AND properties.action = 'add') AS roll_call_added,
       minIf(timestamp, event = 'ws_action' AND properties.feature = 'roll_call' AND properties.action = 'mark') AS roll_call_marked,
       minIf(timestamp, event = 'ws_action' AND properties.feature = 'notice' AND properties.action = 'add') AS notice_added,
       minIf(timestamp, event = 'ws_action' AND properties.feature = 'notice_publish' AND properties.action = 'publish') AS notice_published
     FROM events
     WHERE event IN ('ws_action', 'ws_key_saved')
       AND properties.workspace IS NOT NULL
       AND properties.workspace NOT IN ('ogs')
       AND timestamp > now() - INTERVAL 180 DAY
     GROUP BY workspace
   )
   SELECT
     workspace, alliance, created, dateDiff('day', created, now()) AS days_since_created, key_state,
     if(key_saved < toDateTime('2000-01-01'), NULL, dateDiff('day', created, key_saved)) AS days_to_key,
     if(webhook < toDateTime('2000-01-01'), NULL, dateDiff('day', created, webhook)) AS days_to_webhook,
     if(roll_call_added < toDateTime('2000-01-01'), NULL, dateDiff('day', created, roll_call_added)) AS days_to_roll_call_add,
     if(roll_call_marked < toDateTime('2000-01-01'), NULL, dateDiff('day', created, roll_call_marked)) AS days_to_roll_call_mark,
     if(notice_added < toDateTime('2000-01-01'), NULL, dateDiff('day', created, notice_added)) AS days_to_notice_add,
     if(notice_published < toDateTime('2000-01-01'), NULL, dateDiff('day', created, notice_published)) AS days_to_notice_publish
   FROM w
   WHERE created > toDateTime('2000-01-01')
   ORDER BY created DESC
   ```

   `minIf` with no match gives 1970-01-01, hence the `2000-01-01` guards. Add the test slugs to `NOT IN`.
5. **Weekly active officers**: Trends, weekly, unique users of `ws_action` where `tier = officer`, breakdown `alliance`.
6. **Board visitors**: Trends, weekly, unique users of `$pageview` where `section = board` and person `tier = member`, breakdown `alliance`.
7. **Feature use**: Trends, weekly, `ws_action` total count, breakdown `alliance` then `feature`. A second insight: `admin_feature_changed` total count, breakdown `feature` then `on` (the owner's changes, with no workspace).
8. **Officer retention per alliance**: Retention, weekly, start event `ws_action`, return event `ws_action`, breakdown `alliance`.
9. **Member retention per alliance**: Retention, weekly, start event `ws_sign_in_completed` (person `tier = member`), return event `$pageview` with `section = board`, breakdown `alliance`.
10. **Alert: error spike per workspace**: on a Trends insight of `$exception` total count, daily, breakdown `alliance`. Alert when any series is above a low absolute threshold (start at 10 a day), not a percentage.

## Next

- Model/effort: keep. The work was mostly finding which events already existed and which steps a funnel can join. The code change was small.
- Owner first: merge; then let the orchestrator build the dashboard above in project 741657 and add the test workspace slugs to its filters.
- Plan change: none.

<adjustments>
- Six of the eight onboarding events already existed before this branch (#451, #453); this branch added `ws_key_saved`, `admin_feature_changed` and `ws_action` `workspace` / `create`.
- The setup funnel's first step is `ws_action` `workspace` / `create`. Pre-workspace events cannot be joined to a workspace or a person, so do not try to build one funnel from the request to the first notice.
- `ws_bot_installed` never fires for invited alliances; use `ws_action` `discord` steps instead.
</adjustments>

<adjustments for="issue 484">
- The setup table SQL above is the Endpoint's query; the per-alliance trends use `alliance` breakdowns on `ws_action` and `$pageview`.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/542
