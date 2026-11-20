# feat-478 — The desk's read status bar (D135)

## Built

- **The bar** (`app/(private)/_ui/ReadStatusBar.tsx`). It sits under the page head of every desk page, after the deletion notice, for officers only.
  - It is a `<details>` in a `section` labelled "Reads from the tracker". It is hidden when no read has anything to say.
  - Closed: one line below 640 px and two from 640 px, each cut with an ellipsis, plus "+n more". The summary is 44 px tall.
  - A tap opens every line in full. A key line links to Alliance settings: inside the list below 640 px, beside the closed bar from 640 px.
  - The dot shows the tone: plum while running (pulsing only when motion is allowed), sage for done or paused, yarn for a line that needs a look.
- **Polling.** While a read runs, the bar asks `GET /api/w/[slug]/read-status` every 30 s, only while the tab is visible. Becoming visible again asks at once. When the read ends, it calls `router.refresh()` once and stops asking. A done line goes 30 minutes after the end, on a timer. A `401` stops the polling.
- **The read model** (`lib/private/read-status.ts`, `readStatus`). It gives lines in the officer's language, counts and server times only:
  - the key: D124 `invalid` or `reenter`;
  - today's roster: failed, or late after its window closed;
  - the squads read (D132): running, waiting for retries, paused (the event window on the site's key, or the reserve), done (30 minutes), stopped or skipped.
  - The key line comes first, then the others, newest first.
- **The frame reads it** (`ReadStatusLine` in `Frame.tsx`). It opens its own connection in a Suspense boundary, on the page's `access`, so the page never waits for it.
- **The route** `app/(private)/api/w/[slug]/read-status/route.ts`: officers of that workspace only, after `requireWorkspace`, `401 signed_out` otherwise. Answers are `private, no-store`, nothing is logged, and no tracker call is made.
- **One rule for whose key reads the squads** (issue 507's first item). `squadsKey` in `lib/workspace-keys.ts` (INVARIANT `squads.key-rule`) is used by `squadTargets` and by `squadsReader` (`lib/private/squads-today.ts`). Alliance settings dropped its own `READING` list and uses `squadsReader`.
- **`squadsToday`** (D132's read model) now also returns `failed`, `dueNow`, the day's row (`status`, `startedAt`, `finishedAt`, `reason`) and the key that reads it. Its callers pass that key.
- **New repo read**: `dayRosterState` in `lib/repo/squads.ts`.
- **Copy**: EN, PT-BR and FR in `lib/private/dictionary.status.ts`, spread through `dictionary.squads.ts` (the three workspace dictionaries are at their 300-line cap).
- **Docs**:
  - D135 and its index line;
  - a dated amendment to D132 (the Settings line follows the shared rule);
  - a "Read status bar" line in DESIGN.md "Workspace components".

## Decisions

- **D135.**
- **The frame opens a connection for the bar.** Before, the frame opened none. The alternative was a read on each of the 19 desk pages. One Suspense boundary is a single injection point, and the page is never held up.
- **Lines and how long they stay.**
  - Stopped and skipped lines stay until the quota day ends: they explain why the cards are not updated.
  - Done lines stay 30 minutes (the issue).
  - Paused lines stay while paused.
- **"Running" for polling** includes "waiting for retries" (the queue is still `running`). It does not include paused: nothing moves while paused.
- **The roster line is "late"** when the day's read is not running, its window (`DAILY_ROSTER_AT` + `SNAPSHOT_WINDOW_MIN`) has closed, and there is no row for this alliance. It is "failed" when the row is an error row.
- **Home and Alliance settings leave out the lines that the key card or key section already shows** (`keyShown`): the key line, and a squads line stopped by the alliance's own refused or spent key. Persona panel: R5 and product strategy.
- **The reset is said "00:00 UTC (22:00 ST)"**, the clock Home's key card uses, with the server time. All three personas raised this.

## Deviations

- **The issue's example copy was changed after the persona panel.** Each line now starts with what and how far ("Squads: 43 of 101 read so far · started 23:37 ST"). At 360 px the issue's "Updating members' squads from the tracker · 4…" cut off the counts.
- **"3 will be tried again" (the issue's done example) is not what D132 does.** A done day has nobody waiting. The done line says "the tracker missed 3", which is the D75 framing the panel suggested.
- **"Resumes after 22:00 ST" (the issue's paused example) is not literal.** The next quota day starts a new queue after its daily read. The line says when the limit resets.
- **The Raid Shield check (#474) has no line**: it is not built yet. `readStatus` takes a new kind for it behind `featureOn(access, "shield_check")`.

## Verified

- **`pnpm check` passes**: Prettier, ESLint, typecheck, Vitest (1,344 tests in 253 files, 4 skipped, after the review fixes), drift and i18n.
- **New and extended tests**:
  - `lib/private/read-status.test.ts`: 6 tests, one per state (running with moving counts, done, paused and stopped at the limit, skipped, key, late roster and nothing to say);
  - the issue 471 suite (`cross-workspace-reads.test.ts`): each workspace's bar carries its own counts, and no uid or name;
  - the member-session sweep fixture for the new route;
  - `squads-today.test.ts` passes the key.
- **Local production build** (`next build` and `next start`, local Postgres 18, invented data): 9 invented workspaces, one per state. **435 of 435 checks pass**:
  - every state's page answers 200 with no sideways scroll, at 360 and 1280, light and dark, EN and PT (FR at 360 light);
  - one line at 360 px, a 44 px summary, and no member uid or name in the bar;
  - the open bar at 360 px, with a 44 px settings link;
  - no bar for "nothing to say";
  - reduced motion stills the dot;
  - polling, measured: an ask within 31 s while running; the counts moved from 43 to 53 of 101; no ask in 35 s while hidden; one ask at once when visible again; exactly one refresh when the read ended; no ask in the next 35 s;
  - Home leaves out the key and spent-key lines (owl: 1 line, emu: 0, bear: 0);
  - from 640 px the settings link sits beside the closed bar (44 px).
  - Screenshots are in the scratchpad's `478-shots/`.
- **Persona panel** (an R4 on a phone, the R5 who owns the key, product strategy). The agreed fixes are all applied and checked again in the e2e:
  - one clock for the reset;
  - "paste a new key" for a refused key, as the key card says "Replace it";
  - the done line leads with the counts, and the tracker "missed" members;
  - a shorter skipped reason ("tracker limit unknown");
  - running and paused copy without jargon;
  - no duplicate key or limit line on Home and Alliance settings;
  - the settings link beside the closed bar from 640 px.
- **Privacy**: the diff has none of the 100 names in the OGs fixture roster. No upstream, Discord or PostHog call was made.

## Open issues

- **Review of PR 515, fixed here:**
  - an expired done line no longer keeps a zero-delay timer redrawing the bar (`nextWake`, `read-status-wake.ts`);
  - a failed connection or query renders no bar and logs `w.read_status.failed` (code only) instead of taking the desk page down (`frameReadStatus`);
  - `squadsKey` and `squadTargets` share one rule in every branch (`ownKeyReads`, `StoredKey`), and so does `dailyKeyRule`. Behaviour change: a key spent today shows no squads line, on the bar or in Alliance settings, until the 00:00 UTC reset. Home's key card says it meanwhile;
  - an alliance the daily read skips on purpose (refused, unreadable or spent key) gets no "roster is late" line;
  - `readStatus` reads `workspace_keys` once and runs `squadsToday` in the same `Promise.all`;
  - 8 more state and behaviour tests (read-status, the timer, the spent-today agreement).
  - The e2e screenshots predate these fixes. Only "bear" (own key spent today) changed: it now shows no bar on any page.

- **Not taken from the panel**, for the owner to decide:
  - **Hide paused lines?** Product strategy wanted to drop them as normal operation. The issue lists paused as a state, so they stay.
  - **Clean done lines?** Product strategy wanted to show a done line only when someone was missed.
  - **What next after a skip?** The R4 wanted "it tries again tomorrow" on skipped and stopped lines. It is left out: the next try comes after the next daily roster, and saying it well needs the owner's words.
  - **Dot colours.** The R5 found the dots too close: paused and done share sage.
  - **Bar on Home only?** Product strategy suggested it for later, if reads are rarely late or refused.
- **Pre-existing, not changed**: Home's key card says "Your tracker key needs you" for a spent quota (`out_of_quota`), where the officers have nothing to do (R5).
- **Issue 507**: only its first item (the shared rule) is done here. The others stay open.

## Next

- Model/effort: keep.
- Owner first: nothing. The bar needs no setting. It shows for every officer once a read has something to say.
- Plan change: none.

<adjustments>
- #474 (Raid Shield check): add a line kind to `readStatus` (`lib/private/read-status.ts`) behind `featureOn(access, "shield_check")`, with its words in `lib/private/dictionary.status.ts`. Lines need `tone: "progress"` while running, so the bar polls and refreshes the cards once at the end.
- #507: its first item (Settings' own running rule) is done by `squadsKey`/`squadsReader`; skip it.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/515
