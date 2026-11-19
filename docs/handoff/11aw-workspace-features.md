# 11aw — Turn features on or off per workspace, with daily caps on AI and Discord translate (issue 450)

## Built

- **Storage** (migration `0049_workspace_features`, `lib/schema-features.ts`):
  - `workspace_features`: one row per workspace once the owner changes something. It holds the features turned off and the two daily caps (`ai_per_day`, `translate_per_day`; null means no cap).
  - `workspace_usage`: the count per workspace, allowance and UTC day.
  - `allowance_pauses`: the owner's global pause of a paid allowance.
- **Catalog** (`lib/workspace-features.ts`, shared by /admin, `lib/private` and the squads read). 17 switches in four groups:
  - Tabs: roll call, garrison, thefts, follow-up, caravans, notices, members' board.
  - AI: Notice Translate, Improve writing, Shorten to 1,000, the weekly thanks draft, Read from a screenshot.
  - Discord: Send to LAPTracker, Translate for me, Translate for everyone.
  - Data: squads read, notice pictures.
  - Also in the catalog: which features are paid and which allowance each spends, the defaults, `switched` and `capped`.
- **Helpers** (`lib/private/features.ts`): `featureOn`, `useAllowance`, `featuresBySlug`, `featuresById` and `writingOff`.
  - `requireWorkspace` and `requireBoard` read the served features with the session (one more query, run in parallel). `WorkspaceAccess`, `BoardAccess` and the Discord `officerAccess` carry them.
- **Enforcement:**
  - **Pages:** the shared openers `openRollCall`, `openCalendar` and `noticePage` return the calm `TurnedOff` page and skip the page's own reads. Thefts, Start here and the board check directly. The board hides its notices when notices are off. Home drops review requests and pictures due.
  - **Navigation:** `DeskNav` (tabs, rail, sidebar, the "See what members see" link), `CalendarNav`, and the Calendar week's roll-call, garrison, caravan and notice links (through a context in `CalendarAgenda`).
  - **API routes** answer `403 turned_off`:
    - each tab's routes;
    - the notice routes, including publish, reviews and delete;
    - the four picture routes;
    - `start-here`;
    - `shots/read`;
    - `notices/draft`, checked per kind;
    - `thanks/draft`;
    - the Calendar route, for a caravan add or a Coachman/second-seat edit.
  - `/img/notice/[id]` answers 404 while pictures or notices are off. "Publish to Discord" leaves the picture out.
  - **Discord:** the import command checks `discord_send`. The Translate commands check their switch, and so does every picker or language button press; a press now looks up the server's workspace too.
  - **Squads tick:** `squadTargets` leaves out a workspace whose squads read is off.
- **Allowance:** one atomic `insert … select … where units <= cap on conflict … do update … where used + units <= cap returning used`.
  - AI units: one per language for Translate, one for Improve or Fit, three for the thanks draft.
  - Translate units: one per language asked in Discord. They are counted inside `quota()` after the per-person and app-wide checks.
  - When the cap is reached, the reply is `429 cap_reached` on the routes, and the plain line in EN/PT-BR/FR in the editor, the thanks sheet and Discord.
- **Editors:** the notice editor and Start here hide each writing help that is off. With all of them off they show "Writing help is turned off for your alliance." The notice editor has no picture field while pictures are off.
- **/admin** (PIN, `POST /api/admin/workspaces/features`):
  - Each workspace card has a "Features: n of 17 on · AI today · translations today" disclosure. Inside: the grouped one-tap switches, the two caps with "Today: 12 of 50", and "Copy settings from" (asked first).
  - Above the list, "Paid features, every workspace" has Pause and Resume for AI and for Discord Translate.
  - Each change sends `ws_action` `features` / `turn_on|turn_off|cap|copy|pause|resume`, with no person and `area` admin.
- **Docs:**
  - D126 and its index line.
  - Dated amendments in D101 and D124.
  - An ARCHITECTURE entry.
  - A tracking-plan row.
- **Tests:**
  - `lib/private/features.test.ts`: the defaults (OGs everything on with no cap; a new workspace with the paid features off), the global pause, the cap and its UTC-day reset, and requests at the boundary.
  - The thefts route test: a turned-off tab leaves the navigation and the route answers 403.
  - `discord-translate-me.test.ts`: a turned-off command answers the line and counts nothing; the cap line in Discord.
  - `app/api/admin/workspaces/features/route.test.ts`: the PIN is needed; copy works.

## Decisions

- **D126** (new). D125 is #449's.
- **Defaults come from code, not a data migration.** A workspace without a row gets its defaults: `OWN_ALLIANCE_ID` everything on with no cap, any other the six paid features off. So OGs keeps today's behaviour whatever order migrations run in. Existing non-OGs workspaces get the new-workspace defaults, as D126 says.
- **"Draft the weekly thanks" was added to the AI group.** It calls Groq three times (D114). Without a switch, a new workspace could spend Groq through it.
- **"Read from a screenshot" stays in the AI group, as the issue lists it, but it is free.** It runs Tesseract on our server (D74), counts against no allowance, and is on by default.
- **What each switch hides:**
  - **Caravans:** the Caravans view, and adding or picking caravans. Existing caravan entries stay on the week.
  - **Squads:** the nightly read only. Stored squads are still shown.
  - **Notice pictures:** the picture field, serving pictures, and posting them to Discord. Stored pictures stay.
- **A request counted and then failed at Groq is not given back.** This keeps the count to one statement.
- **The `ws_action` feature is named `features`, not `workspace_features`.** The longer name widened the tracking-plan table, and prettier then rewrote every row of it (a merge conflict with #449).

## Deviations

- **The squads tick uses the catalog's rule directly, not `featureOn`.** `lib/` cannot import `lib/private` (D71's lint fence). `lib/repo/workspace-features.ts` plus `resolveFeatures` give the same answer.
- **Export (D125) is not switched.** D125 is not on `dev` yet. When #449 and this PR are both merged, three steps are left:
  1. add `"export"` to `FEATURE_GROUPS.data`;
  2. add `if (!featureOn(access, "export")) return privateError(403, "turned_off");` in `app/(private)/api/w/[slug]/data-export/route.ts` after its access check;
  3. hide the Download button in `WorkspaceDataForm` when it is off.
- **Read from a screenshot is not hidden while off.** A press says "Reading screenshots is turned off for your alliance." Hiding it needs a flag passed through three word lists (`facts-form.ts` and the garrison page).
- **The thanks sheet is not hidden while its switch is off.** It reads like "no writing help" ("Writing help is off here. Write the thank-you yourself below.").
- **/admin is English only (D48).** Its screenshots are EN at 360 and 1280, light and dark. The desk ones are EN and PT.
- **Size and complexity fixes for lint:**
  - `stale()` moved out of the Calendar route;
  - `Helps` was split from Start here's `Actions`;
  - `Picture` was split from `NoticeEditor`;
  - `pathOf` was added in the roll-call page;
  - the Discord switch tests went into `discord-translate-me.test.ts` (the other file was at 300 lines).

## Verified

- `pnpm check` passes: prettier, eslint, tsc, 218 test files (1,183 tests), migration drift, i18n.
- All 50 migrations, `0049_workspace_features` included, applied with `pnpm db:local:migrate` on a local Postgres 18.
- **The concurrency check on real Postgres 18** (a Neon pool through the local bridge): 40 simultaneous `spend` calls of 1 unit against a cap of 25 let exactly 25 through. The stored count was 25, and the next UTC day started at 1. PGlite serializes queries, so the unit test alone could not show this.
- **Local e2e** on the production build, with a local Postgres, the Discord stand-in and a dummy `gsk_` key (every https call blocked). 100 of 100 checks passed:
  - **Desk** (EN light 360, PT dark 1280, EN dark 1280, PT light 360):
    - a new alliance's editor shows the writing-help-off line and no Translate;
    - turning Roll call and Thefts off removes them from the navigation and the Calendar views;
    - `/w/nse/roll-call` shows the calm page with its name;
    - the thefts route answers 403 `turned_off` and stores nothing;
    - no sideways scroll;
    - turned on again, the page and the route are back.
  - **/admin** (light and dark, 360 and 1280):
    - defaults "11 of 17 on", with the paid switches Off;
    - switches at least 44 px, no sideways scroll;
    - one tap turns Roll call off in the database;
    - a cap of 50 is saved, and "Today: 12 of 50" shows beside it;
    - "Copy settings from" asks first, then takes OGs' settings;
    - Pause marks the paid switches "paused for every workspace", and Resume clears it.
- 24 screenshots are in the scratchpad's `11aw-shots/`.
- No name from the 128 in the fixture rosters appears in the diff. gitleaks found no leaks (pre-commit).

## Open issues

- Deep links from other screens to a turned-off page still show; they land on the calm page. Examples: the thefts link on Follow-up, "Review" in the secret ops draft, the board link in the share-thanks sheet.
- The Home tab's count (`toReviewCount`) still counts notice review requests while notices are off.
- The ws_action event for /admin carries no person. Admin changes are therefore not tied to the admin page's replay id.

## Next

- Model/effort: keep. Issue 438's later steps and #441 are forms of the same shape.
- What the owner must do first:
  1. After the release, open /admin → Workspaces. Every workspace other than OGs has AI and Discord Translate off. Turn on what each alliance should have, and set caps if wanted.
  2. To protect the Groq free tier quickly at any time, use "Paid features, every workspace" → Pause.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; this work runs from issue 450.

<adjustments>
- A new desk feature with its own page should take a switch: add its key to `FEATURE_GROUPS`, pass it to the page opener (or check `featureOn` directly), and add `if (!featureOn(access, key)) return privateError(403, "turned_off")` to its routes.
- Anything new that calls Groq must call `useAllowance(db, access, "ai", units, now)` before asking, and add a switch to the AI group (paid features start off for new workspaces).
- When #449 merges, add `export` to the Data group (see Deviations).
</adjustments>

PR: (added by the orchestrator)
