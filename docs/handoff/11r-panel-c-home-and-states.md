# 11r — Panel batch C: workspace Home, states that told the wrong story, first use

Basis: the review panel of 2026-11-17 (product designer, UI/UX, adversarial, copywriter), batch C. Branch `fix/panel-c-home-and-states` from `origin/dev` (4c99019). Findings fixed: PD-1, PD-3, PD-4, PD-5, PD-8, PD-18, UI-3, UI-4, UI-8, ADV-16, CW-8 (heading only).

## Built
- **Workspace Home is a short digest** (`app/(private)/w/[slug]/page.tsx`). Its heading is "Calendar, members and screenshots". It has three cards:
  - **Today and tomorrow** (`HomeNext.tsx`, `home-digest.ts`): the Calendar's timed entries that start today and tomorrow on the officer's own clock. Each row shows "20:00 ST · 19:00 your time" (`Times` from `YourTime.tsx`) and links to that day in the Calendar. The server reads the server days from yesterday to the day after tomorrow (`digestDays`), so every viewer's today and tomorrow are inside them. Before hydration the rows are grouped by server time; after it, by the browser's zone and minute.
  - **Members this week**: the top 3 donors from `membersView` (the most active when no donation was read), and "n people to check in with" from `whoOf`, linking to `/members?who=checkin`. Before the first end-of-day read it says "Not yet. Thanks and check-ins start with the first end-of-day read…". The old "The Members tab is ready" card (`home.next`) is gone.
  - **To review**: the count in the heading. "Send screenshots" now sits above the waiting drafts (`ToReview.tsx`).
- **"Next draft (n left) →"** on a draft page once it is saved, discarded or gone (`shots/[id]/page.tsx`). It goes to the first other open draft in Home's order. When none is left, it is "Back to Home".
- **Donation, Might and Kills checks are read-only** (`CheckReview` in `DraftReview.tsx`, `checkSummary` in `draft-known.ts`). The page shows:
  - the type and the Daily/Weekly tab, as before;
  - what the check keeps (`shots.where.check`);
  - "Match: 4 of 5" and "Not counted: n (no sure member, or no game data)";
  - one "Save the count" button.
  No row can be edited. Save sends each surely matched member once with the value read. The server counts it as before. Alliance Duel, Member update and Secret Ops reviews are unchanged.
- **One stale rule for runs**: `runAbandoned` in `lib/compute.ts` (`running` for `RUN_STALE_AFTER_MS` or longer). It is used in four places:
  - `Status.tsx`: `StatusChips` and `CaptureWindow` take `now`. An abandoned run reads "Last update failed at …" and "END failed", never "Updating now".
  - `homeEvent(events, now)` (`lib/queries/events.ts`): `/` takes the newest event whose End is done or still to come. An event whose End never ran, failed or was abandoned gives way to the last finished one. `listEvents` now selects `after_at`; `GET /api/events` strips it, so its response is unchanged.
  - /admin: "Last result" shows an abandoned run as `failed`, so it no longer says `running` beside "Running now: Nothing".
- **Card order**: rows without a rank (no End yet) are ordered by their newest might, biggest first, then by tag (`event-rows.ts`).
- **Banner**:
  - only the time keeps to one line, so PT and FR wrap at 360 px (`UpstreamBanner.tsx`);
  - it moved from the root layout to `app/(pages)/layout.tsx`, so it shows on the public pages and /admin, not in the workspace;
  - the Frame's padding rule for it is removed.
- **First use**: a 4th card, third in order: "Calendar, screenshots and Discord" (`intro.desk.*`). It has three lines: the Calendar with Notices and Thefts inside it, Send screenshots on Home, and Apps → Send to LAPTracker in Discord. The "?" sheet shows it too, because it lists the same steps.
- Words in EN, PT-BR and FR: `home.*` (7 new, `home.next` removed, `home.title` changed), `intro.desk.*` (4), `shots.nextDraft.*` (2), `shots.check.*` (4).
- D27 and D28 amended.
- Tests:
  - `home-digest.test.ts` (3): today and tomorrow on the server's clock and on the viewer's clock; the days read.
  - `Status.test.ts`: the stale chip and the abandoned End.
  - `events.test.ts`: the fallback to the last finished result.

## Decisions
- "Send screenshots at the top" is read as the top of the To review card, above the drafts. Home's order is Calendar, Members, then To review. With 8 drafts the button is at about 900 css px at 360 px. Before this change it was at about 1,360.
- "Top 3 to thank" is the thanks list Members already computes (`THANKS_SIZE` = 3): donors first, the most active when no donation was read.
- The check-in count is the same as on Members (`checkin` only). ADV-9 ("Needs help" is outside the count) is not changed here.
- The abandoned rule is the existing `RUN_STALE_AFTER_MS` (150 s). An End not run at all counts as missing from `after_at + RUN_STALE_AFTER_MS`.
- The home falls back to the last finished event instead of adding a line above the cards. This needs no new public string, so the 17 translations are untouched.
- The banner is left out of the whole workspace (ADV-16, first fix), not reworded.
- The new first-use card is a 4th card, not a fuller "?" sheet only. Officers who already finished the cards on this browser see it through "?".

## Deviations
- The Portuguese shots words moved to `lib/private/dictionary.shots.pt-BR.ts`, as the French had already moved. `dictionary.shots.ts` went over the 300-line limit.
- The public error and 404 pages no longer show the banner, because they sit outside `app/(pages)`.
- **Not done: cutting the workspace header to one row** (PD-13, "biggest win" 2). At 360 px the second row holds "Signed in as …" and "Sign out". One row needs Sign out inside the profile sheet. That sheet's internals belong to batch A, and sign-out (ADV-4) belongs to batch B. The banner is now off the workspace, which gives back about 70 css px at 360 px.

## Verified
- `pnpm check` exit 0: 143 files passed, 2 skipped; 726 tests passed, 4 skipped; drift clean; i18n 17 languages up to date.
- **Local production build** (`next build`, `next start -p 3547`, Node 26.13.0):
  - **Setup**:
    - a local Postgres on 54947 with its bridge on 54948, all 26 migrations;
    - `db:local:seed --reset --with-states`, then the invented 100-member atlas seed: workspaces `ogs` (full history) and `afr` (before its first end-of-day read);
    - drafts and notices written through the app's routes;
    - a Discord stub on 54949 and a frames stub on 54946;
    - Groq answered in-process; upstream pointed at a dead port.
  - **Screens**: 51 captures in `scratchpad/panel-c-shots/`. Script: `scratchpad/panel-c-work/shots-all.mjs`.
    - Public home with the Nov 7 End abandoned: it shows the Oct 31 result, with the banner. 8 variants: 360/1280 × light/dark × EN/PT.
    - The Nov 7 event page: "Last update failed", "END failed", cards by might. 8 variants.
    - Public home with that End running for under 150 s: "Updating now". 8 variants.
    - /admin: "Running now: Nothing" with "Last result · failed". 4 variants, EN.
    - Workspace Home for `ogs` and for `afr` (the "not yet" text). 16 variants.
    - First-use card 3 of 4, EN and PT.
    - The Might check before Save (EN, PT), and after Save with "Next draft (7 left)" (EN light, PT light, EN dark). The stored check row was compared, 5; same, 4; differ, 1, as the page said.
  - No page had sideways scroll (`scrollWidth − innerWidth` = 0 on every capture).
- No upstream, Groq, real Discord or `/api/quota` call. All names are invented.

## Open issues
1. A donation check's summary uses our values for the tab the draft was read as. If the officer switches Daily/Weekly, the shown count can differ from the count Save stores, because the server recounts with the chosen tab. `draftView` would need both tabs' values.
2. Home now runs `membersView` (up to 15 end-of-day reads) on every load, as Members does. No timing was taken.
3. On an abandoned event's own page, "Grandma noticed" can still show empty sections (part of PD-3 and UI-4). It was not in this batch's list.
4. `RowsReview`'s `checkKnown` branch can no longer be reached by a check. It stays only to narrow `view.duel`.
5. The workspace header is still two rows (see Deviations).

## Next
Session: the next panel batch the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The batch fit one pass. Most of the time went to the local seed and the captures.
Owner must do first: review the captures in `scratchpad/panel-c-shots/`. Decide whether the header row (PD-13) goes to batch A or B, since it needs Sign out in the profile sheet.
Plan changes needed: none.

<adjustments>
- `runAbandoned(run, now)` in `lib/compute.ts` is the one check for a run left `running`. Use it instead of comparing with `RUN_STALE_AFTER_MS` by hand.
- `StatusChips` and `CaptureWindow` now require `now`.
- `homeEvent` takes `now`, and its events need `afterAt` and each snapshot's `phase` and `startedAt` (`listEvents` gives them).
- The workspace has no upstream banner. A workspace page that needs to say its data is old must say it itself, as Members does.
- A check draft (`view.ours !== null`) renders `CheckReview`. A new check kind needs nothing else on the client.
</adjustments>
