# fix-kvk-ended-me-no-mark: KvK "Ended" after its End read, and the next step for a Raid prep ✗ on Me (issue 585)

There were two owner-approved fixes (orchestrator decision, 2026-11-21).

1. The shared "Started/Ended" tag (PR #597) said "· Started" for a KvK until midnight ST. A KvK is over at its End read (16:15 ST).
2. On a member's own page, a Raid prep ✗ ("No shield", or "On the wall" for squads) was only a record and said nothing about what to do.

Branch `fix/kvk-ended-me-no-mark` from `origin/dev` (3ed4302d). **Size S**: two bug fixes plus copy. There is no migration, no new decision (two dated amendments), no new route, and no change to private roster fields.

## Built

- **`endOf` takes the End read** (`lib/private/calendar-words.ts`): `endOf(kind, day, minute, zone, endRead)`.
  - A `kvk` entry and its Raid prep roll call (`shield`) end at `endRead` on their day.
  - An Elixir Scramble window still ends after its 30 minutes. Every other kind still ends at the end of its server day.
  - `endRead` is the schedule config's `SNAPSHOT_AFTER`, the time the End read runs (16:15 in production). It is not a literal.
  - Callers:
    - the board (`BoardSections.tsx`, `getEnv()`);
    - Calendar and caravans (`CalendarCtx.endRead`, set in `calendar-page.ts`);
    - Home's "next" list (`app/(private)/w/[slug]/page.tsx`);
    - Me (`meView`'s `at.endRead`, set in `board/me/page.tsx`).
- **Next step on Me** (`lib/private/me-parts.ts`, `stepOf`; rendered in `MeNeeded`, `MeSections.tsx`, as a bold line under the mark).
  - It shows only for a Raid prep ✗ (`kind` `shield`, mark `no`), on the main part ("No shield") or the wall part ("On the wall").
  - When it shows:
    - from the raid's eve (24 h before the reset) until the reset (00:00 ST): "… before the reset (00:00 ST)";
    - then until KvK starts: "… before KvK starts at 12:00 ST";
    - from KvK's start: nothing, and the neutral record stays ("your mark: “No shield”").
  - The deadlines and words follow Raid prep's own ready message (`raid-prep.ts`: reset, then `kvkStart`; `PREP_MESSAGE`). KvK's start is `KVK_MINUTE` from `lib/shield-check.ts`.
  - `neededLines` takes `now` as its last argument. `NeededLine.step` is optional.
- **Copy** in EN, PT-BR and FR (`lib/private/dictionary.me.ts`, four new keys):

  | Key | EN | PT-BR | FR |
  | --- | --- | --- | --- |
  | `me.step.shield.reset` | Next step: turn on your shield before the reset (00:00 ST). | Próximo passo: ligue o seu escudo antes do reset (00:00 ST). | Prochaine étape : activez votre bouclier avant le reset (00:00 ST). |
  | `me.step.shield.kvk` | Next step: turn on your shield before KvK starts at {time} ST. | Próximo passo: ligue o seu escudo antes do KvK começar às {time} ST. | Prochaine étape : activez votre bouclier avant le début du KvK à {time} ST. |
  | `me.step.wall.reset` | Next step: take your squads off the wall before the reset (00:00 ST). | Próximo passo: tire os seus esquadrões da muralha antes do reset (00:00 ST). | Prochaine étape : retirez vos escouades du mur avant le reset (00:00 ST). |
  | `me.step.wall.kvk` | Next step: take your squads off the wall before KvK starts at {time} ST. | Próximo passo: tire os seus esquadrões da muralha antes do KvK começar às {time} ST. | Prochaine étape : retirez vos escouades du mur avant le début du KvK à {time} ST. |

  No existing string changed. Before this fix, a KvK showed "· Started" / "· Começou" / "· Commencé" until midnight ST. From the End read it now shows "· Ended" / "· Encerrado" / "· Terminé".
- **Decisions amended** (dated, appended):
  - D116 quotes the old rule ("any other entry at the end of its server day");
  - D142 records the Me next step.
- **Tests**:
  - `lib/private/calendar-time.test.ts`: "shows KvK Saturday's KvK and its Raid prep as Started at 15:00 ST and Ended at 17:00 ST, after the 16:15 ST End read". It covers `kvk` at 12:00, and `shield` at 12:00 and with no time. The existing Elixir test keeps the Elixir case and now uses `undead` for "end of its server day" instead of `kvk`/`shield`, whose rule changed on purpose.
  - `lib/private/me-parts.test.ts`:
    - "tells a member marked ✗ on Raid prep what to do next, before the reset and then before KvK (D137)": Fri 00:00 and Fri 23:00 ST, then Sat 10:30 ST, for both the shield and the wall;
    - "keeps only the neutral record of a Raid prep ✗ before the raid's eve and once KvK has started": Thu 23:00, Sat 15:00 and Sat 17:00 ST.
  - The existing `neededLines` test and `app/(private)/api/w/[slug]/me/route.test.ts` pass the new argument (`now`, `endRead: "16:15"`).

## Decisions

- **The End read time comes from the config (`SNAPSHOT_AFTER`)**, not from the events table's per-event `after_at`. That would need a read on every board, Calendar and Me render. An owner who moves one event's End by hand is not reflected (see Open issues).
- **A Raid prep line ends with its KvK.** Raid prep is the KvK's roll call (`FROM_CALENDAR.kvk = "shield"`). On Me its line read "· Started" at 17:00 ST while the board's KvK read "· Ended". Both now end at the End read.
- **Next step for Raid prep ✗ only.** "Not this time" or "Did not join" on an Undead Siege, Elixir Scramble or Cheese Trap roll call is the member's own answer, and there is nothing to do about it. Adding a step there would read as pressure (D75). This is the reading the task's example ("Put your shield up…") supports most directly.
- **Two deadlines, as Raid prep's own message has.** The morning check writes ✗ "No shield seen" at about 10:00 ST on Saturday (D137), after the reset. A step that said only "before 00:00 ST" would be wrong exactly when the tracker's ✗ arrives. So after the reset it says "before KvK starts at 12:00 ST", and from KvK's start it is gone (D137: nobody keeps a shield after that).
- **"Next step:" as the label, bold, in plain ink.** The label is a step, not a reproach, with no red and no ✗ colour. The mark line above it stays the neutral record.

## Deviations

- **The step shows only from the raid's eve.** The task said "before the event". The first local capture (Fri 23:00 ST) showed the seed's Raid preps of Dec 5, 12 and 19, each with "before the reset (00:00 ST)". That reads as tonight. From the eve (24 h before the reset), "the reset" is always tonight's. A ✗ earlier than the eve shows only the record until then.
- The task's example wording was "Put your shield up before 00:00 ST". The app uses Raid prep's own words ("turn on your shield", "the reset") so the member and the officers' ready message say the same thing.

## Verified

- **`pnpm check` passed**: prettier, eslint, tsc, vitest (306 files passed, 2 skipped; 1587 tests passed, 4 skipped), drift, and i18n (17 languages up to date).
- **Each new test fails when the code is broken on purpose** (checked one break at a time, then restored):

  | Break | Test that fails |
  | --- | --- |
  | `endOf`'s KvK branch off (KvK ends at midnight again) | KvK/Raid prep Started at 15:00, Ended at 17:00 |
  | No step at all | next step before the reset, then before KvK |
  | Reset deadline ignored (always the KvK wording) | next step before the reset, then before KvK |
  | Never hidden after KvK's start | neutral record before the eve and after KvK's start |
  | No eve window | neutral record before the eve and after KvK's start |

- **The real app, local.** Production build (`next build` + `next start`) on a local Postgres 18 with the e2e seed (invented data), `SNAPSHOT_AFTER=16:15`. The server clock was moved per scenario by a scratch preload, and the browser clock by Playwright's `page.clock`. Chrome at 360 × 780. Scenarios are dated Fri 2026-11-27 23:00 ST and Sat 2026-11-28 10:30, 15:00 and 17:00 ST.

  | When (ST) | Board (KvK 12:00 ST) | Me (Raid prep, Sat Nov 28, ✗ "No shield") |
  | --- | --- | --- |
  | before, Sat 17:00 | **KvK · Started** | … · Started, no step |
  | before, Fri 23:00 | KvK | no step |
  | after, Fri 23:00 | KvK | Next step: turn on your shield before the reset (00:00 ST). Only Nov 28 has it; Dec 5, 12 and 19 do not. |
  | after, Sat 10:30 | KvK | Next step: turn on your shield before KvK starts at 12:00 ST. |
  | after, Sat 15:00 | KvK · Started | … · Started, no step |
  | after, Sat 17:00 | KvK · Ended | … · Ended, no step |

- **First-glance test** (DESIGN.md § Validation): first viewport only, 360 × 780, about 5 seconds per screen. The board question was "Is today's KvK over?" and the Me question was "What do I need to do?".

  | Screen | R5, 40s, native English | Officer, early 20s, English second language | Product strategy |
  | --- | --- | --- | --- |
  | Board, before, Sat 17:00 | **unsure, "leans misleading"** | **"Not over, I think"** (wrong) | **"still running"** (the bug) |
  | Board, after, Sat 15:00 | not over | not over | started, correct |
  | Board, after, Sat 17:00 | over: "Ended greyed, clear" | over: "Ended greyed, clear" | over |
  | Me, before, Fri 23:00 | **unsure what "No shield" asks** | **unsure, "don't know if I need to act or when"** | **"list of facts, not sure what to do"** |
  | Me, after, Fri 23:00 | turn on shield before the reset | turn on shield before the reset at 00:00 ST: "clear and short" | turn on shield within the hour |
  | Me, after, Sat 10:30 | turn on shield before KvK at 12:00 ST | same: "clear" | same; Dec rows correctly have no step |
  | Me, after, Sat 17:00 | nothing for today | nothing to do now | nothing needed |

  Before the change, all three were wrong or unsure on both questions. After it, there is no wrong conclusion, so there is no MUST. The product verdict was "ship with a follow-up" (see Open issues).
- Screenshots and the scratch scripts (server clock preload, seed runner, capture) are in the scratchpad `kvk-ended/` folder and are not committed. The local Postgres, the bridge and the servers were stopped by port.
- **e2e**: `e2e/board.spec.ts` asserts "Raid prep, … · your mark: “No shield”". That text is unchanged, and the step is its own line. The e2e suite was not run as a whole.
- **Analytics plan: no change.** No event, property or funnel step is added, changed or removed. The tag and the step are rendered text only.
- **Privacy**: no private roster field is read or shown. The step comes from the member's own roll-call mark, which the page already shows.

## Open issues

- **The step does not disappear live.** The server decides it at render time. On a page left open past 00:00 or 12:00 ST, the old step stays until a reload, while the "Ended" tag updates with the browser's clock. A small client check could hide it (follow-up).
- **A KvK whose End was moved by hand for one event** (`events.after_at`) still ends at `SNAPSHOT_AFTER` here. An officer-typed KvK time after the End read would show "Ended" from its start. Both are edge cases.
- **KvK's start for the step is `KVK_MINUTE` (12:00) in `lib/shield-check.ts`**, the Raid Shield check's constant, not `EVENT_TIME`. This is the same as Raid prep's message ("before KvK starts at 12:00 ST"), and it is pre-existing.
- Persona follow-ups, not built:
  - Product: show the step's deadline in the member's own time with ST in brackets, as the board's time column does.
  - Product: a short thanks with the step, or a "Shield on" line once marked ✓.
  - Officer (English second language): "your mark" is unclear, and "No shield" can read as a fault. This is D142's wording from PR #597, not changed here.
  - Officer: "· Ended" on her Raid prep line "could feel like I missed something".

## Next

- Model/effort: keep. This was an S fix in pure code plus copy, with no migration.
- Owner first: nothing. There is no migration. `SNAPSHOT_AFTER` is already 16:15 in production.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`, and batches run from issue 585.

<adjustments>
- `endOf(kind, day, minute, zone, endRead)` needs the End read time (`SNAPSHOT_AFTER`). `CalendarCtx` has `endRead`, and `meView`'s `at` has `endRead`.
- `neededLines(n, week, t, date, timeOf, now)` takes `now`. `NeededLine.step` holds a Raid prep ✗'s next step from the raid's eve until KvK starts.
- Local first-glance captures with a moved clock work without code changes: seed with the e2e global setup under a `Date` preload, then move `workspace_sessions` to the scenario time (the seed dates sessions with Postgres `now()`, 6-day expiry). Next's server wraps `Date`, so the preload must define `parse` and `UTC` as the subclass's own statics.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/619
