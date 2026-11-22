# fix-insights-kvk-pending: the KvK card says the truth on KvK evening (issue 585)

Real officer report, KvK Saturday 2026-11-21, 22:35 ST. The Insights page's "KvK cost and recovery" card said "No KvK in these weeks has both a Start and an End read yet. This fills in after the next one." The officer concluded that nothing was recorded. That was false. In production, the KvKs of Nov 21, Nov 14 and Nov 7 each had a fresh Start and End for all 20 alliances. Two things made the card empty:

- `kvkOf` waits for the first daily read after the End, so from the End (about 16:15 ST) to the 23:30 ST read, today's KvK is left out;
- the page's reads come only from `daily_rosters` rows with `raw_json`, which start on Nov 17 for the own alliance, so the Nov 14 KvK was outside them.

Branch `fix/insights-kvk-pending` from `origin/dev` (e996cb5e). Size S: a bug fix with no migration, no new decision and no change to private fields.

## Built

- **`kvkOf` returns a `KvkView`** (`lib/private/insights-kvk.ts`). It stays pure, and `now` is passed in.
  - `events`: as before.
  - `waiting`: the newest event whose Start and End are read but with no daily read after its End yet. It holds the event's server day, and `today` when that day is `now`'s server day.
  - `readsFrom`: the first read's day, when a KvK from before the page's reads has both reads. That KvK is still not shown.
  - The "inside the reads" boundary moved from SQL into `kvkOf`: events from the server day before the first read, the same boundary `since` used to set.
- **The page reads events from one KvK week earlier** (`lib/private/insights.ts`: `since` is the first read's day minus 8, was minus 1). This lets `kvkOf` see the KvK just before the reads.
- **The card's top lines** (`kvkWords` in `lib/private/insights-more-words.ts`; `KvkWords.headline` became `based: string[]`):
  1. the waiting line, when a KvK waits;
  2. then the newest shown KvK's summary, as before;
  3. with no KvK shown and none waiting: the "reads start on" line, or the unchanged "none" line.
  - `KvkCard` always gets words now. It renders only the lines when no event is shown.
  - The page passes `DAILY_ROSTER_AT` as the time.
- **Copy** in EN, PT-BR and FR (`lib/private/dictionary.insights-more.ts`). There are three new keys, and `insights.kvk.none` is unchanged.

  | Key | EN |
  | --- | --- |
  | `insights.kvk.waitingToday` | Today's KvK is recorded: its Start and End reads are in. Its cost and recovery show here after tonight's daily read at {time} ST. |
  | `insights.kvk.waiting` | The KvK of {date} is recorded: its Start and End reads are in. Its cost and recovery show here after the next daily read at {time} ST. |
  | `insights.kvk.notInReads` | This page's daily reads start on {date}, so earlier KvKs are not shown here. The next KvK shows here after the daily read at {time} ST on its day. |

- **D139**: a dated amendment that records the new states and lines. D139 quotes the "none" line, which did not change.
- **Tests** (`lib/private/insights-kvk.test.ts`). The server is at UTC−2: Start 12:00 ST, End 16:15 ST, daily read 23:30 ST.
  - "on KvK day between the End and the 23:30 ST daily read, says today's KvK is recorded and waits for that read": last week's KvK still shows below it.
  - "after the 23:30 ST daily read, shows today's KvK and no longer says it waits".
  - "with the reads starting after the last KvK, says when they start instead of claiming no KvK happened": it also checks the unchanged "none" line.
  - The existing tests now read `.events`. The old assertion "the event waits" (`toEqual([])`) was replaced by the first new test. `insights.test.ts` (PGlite) reads `view.kvk.events`.

## Decisions

- **The waiting line leads, and the last KvK's summary and help list stay below it.** On a normal KvK evening the card still shows last week's cost and help list. The first line now answers "was today's recorded?".
- **"Recorded" is the lead word.** It is the word the officers' question uses. The rest of the sentence names the reads and when the numbers come.
- **Two waiting lines, chosen by `now`.** "Today's … tonight's" is true only on KvK day. If the night read fails, the next day reads "The KvK of Sat, Nov 21 is recorded … after the next daily read".
- **The time comes from `DAILY_ROSTER_AT`, not a literal.** The Raid Shield lines on the same page hard-code "23:30 ST". Those were not changed.
- **No "your time".** The Insights page shows no viewer-clock time anywhere else, so this fix adds none.
- **The look-back is one week.** A KvK more than 8 days before the first read falls back to the "none" line, which stays true: it speaks of "these weeks".

## Deviations

- The task's sample line was "Today's KvK: Start and End are read." I used "Today's KvK is recorded: its Start and End reads are in." "Are read" can be misread by a second-language reader (read/red), and "recorded" answers the question as asked.
- The "reads start on" line does not name the earlier KvK's date. It says "earlier KvKs are not shown here", as the task worded it.

## Verified

- `pnpm check` passed: prettier, eslint, tsc, vitest (297 files passed, 2 skipped; 1555 tests passed, 4 skipped), drift, and i18n (17 languages up to date).
- **First-glance test** (DESIGN.md § Validation).
  - Setup: the real `KvkCard`, rendered with `renderToStaticMarkup` and the app's compiled Tailwind CSS, with invented members. Screenshots at 360 × 780 from headless Chrome, light theme.
  - Screens shown:
    - A: before, the bug evening;
    - B: after, the bug evening (Nov 21 waiting, reads from Nov 17);
    - C: after, a normal KvK evening (Nov 21 waiting, Nov 14 shown below).
  - Question: "Did today's KvK get recorded?"

  | Persona | A (before) | B (after) | C (after, normal week) |
  | --- | --- | --- | --- |
  | R5, 40s, native English | **NO**: "nothing recorded, I'd ping an officer" | YES | YES: "the Nov 14 lines are last week's" |
  | Officer, early 20s, English second language | **NO**: "nothing from today is in" | YES: "the first four words answer it" | YES |
  | Product strategy | **NO** (the bug's reading) | YES | YES; PT-BR and FR B/C also read right |

  No wrong conclusion after the change, so there is no MUST. Before the change, all three were wrong.
- Screenshots, HTML and the CSS build script are in the scratchpad `fg/` folder (not committed).
- **Analytics plan: no change.**
  - The card sends no event, and the Insights page's pageview is unchanged.
  - The change is in which lines the card shows. It adds, changes or removes no event, property or funnel step.
  - No PostHog insight or Endpoint reads this card.
- Privacy: only might is read, as before. No private roster field is touched.

## Open issues

- **C has a small first-glance risk (SHOULD, from the product persona and the R5).** "Last KvK, Sat, Nov 14" and "Took a heavy hit — maybe offer help" sit right under "Today's KvK is recorded". A fast reader could take last week's loss and help list as today's. Nobody answered wrongly. A follow-up could give the last KvK's lines a sub-heading with the date, or a divider. This layout is pre-existing.
- **The Nov 14 KvK still isn't shown for the own alliance.** Its Start and End mights exist, but no daily read with `raw_json` covers its week. The card now says so. Showing it would need recovery days from the reads after Nov 17 (missing Nov 15 and 16). That is a change in what the card computes, so it was not done here.
- **The Raid Shield lines hard-code "23:30 ST"**, while the KvK lines now use `DAILY_ROSTER_AT`. This is pre-existing.
- **Cost.** The KvK read now covers one more week of events, which adds one event's Start and End rows for the own alliance (about 2 × members rows). It is not re-measured against D149's numbers.
- Product-persona follow-ups, not built:
  - the Start and End read times as a small "recorded" line;
  - a Discord note after the 23:30 ST read saying the KvK cost is ready.

## Next

- Model/effort: keep. This was an S fix in pure code plus copy, with no migration.
- Owner first: nothing. There is no migration and no environment change.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`, and batches run from issue 585.

<adjustments>
- `kvkOf(events, reads, zone, away, now)` returns `{ events, waiting, readsFrom }`, and `insightsView().kvk` is that object. Read `.events` where the old array was used.
- `kvkWords(kvk, newest, f, time)` returns `based: string[]` (no `headline`), and `KvkCard` takes non-null words.
- The insights page reads KvK events from 8 days before its first daily read. Only events from the day before that read are shown.
</adjustments>

PR: (added by the orchestrator)
