# fix-raid-prep-followups: Raid prep words, dates and analytics (issue 585)

This branch does the follow-ups that PR #599's handoff (`docs/handoff/fix-raid-prep-first-glance.md`) listed, before the next raid. Branch `fix/raid-prep-followups` from `origin/dev` at 1cf929d4. Size: **S**. It changes copy and labels, moves one function, and adds one closed-list event property. It has no migration, no new decision, no private-field flow, no quota use and no new route.

## Built

- **The phone bar uses the page's words** (`countLine` in `app/(private)/_ui/RollCallRest.tsx`, new keys in `lib/private/dictionary.raidprep-glance.ts`).
  - Raid prep's sticky bar reads "Shield: 6 to mark · 1 not seen yet, left out", where it read "Shield: 6 not set · …".
  - With away members it reads "6 to mark · 2 away, left out".
  - PT: "Escudo: 6 para marcar". FR: "Bouclier: 6 à marquer".
  - Other roll calls keep "57 not set · 3 away, left out", the D75 word their tiles use.
- **"(−1 d)" is now words** (`calendar.prevDay` and `calendar.nextDay` in `lib/private/dictionary.calendar*.ts`).
  - EN: "23:00 your time (the day before)" and "(the next day)".
  - PT: "(dia anterior)" and "(dia seguinte)".
  - FR: "(la veille)" and "(le lendemain)".
  - The Calendar legend drops its sentence "+1 d means the next day." in all three languages.
- **The Roll call list dates Raid prep by its raid** (`rollCard` in `app/(private)/_ui/roll-call-data.ts`).
  - A Raid Shield roll call's card reads "KvK Sat, Nov 28 · raid at the reset · 00:00 ST · 23:00 your time (the day before)", where it used to name the day it was added ("Wednesday, November 25").
  - A week whose KvK day has gone by reads "Past raid · KvK Sat, Nov 21". The Archived list uses the same card.
  - `raidHead` moved from the mark page into `_ui/roll-call-data.ts`, beside `headerOf`. The mark page and the list both call it with the roll call's `fridayOf`, the same logic as #599.
- **Analytics**: the browser's `ws_roll_call_marked` carries `roll_call`: `raid_prep` or `other` (`RollCallType` in `lib/analytics/events.ts`).
  - The value comes from the page that marks. `useMarks` takes it with the refusal line as one `Marking` argument. Raid prep's two parts send `raid_prep`, other roll calls send `other`, and "Accept the tracker's" sends `raid_prep`.
- **Docs**:
  - the tracking plan's row and a dated "Changed" line;
  - dated amendments to D103 (it quotes the bar) and D136 (it quotes "(+1 d)").
- **Tests** (one per behaviour, realistic times):
  - `RollCallRest.test.ts`: "counts Raid prep's Shield marks still to mark in the card's words" (KvK Saturday after the morning check: 6 to mark, 1 not seen, 2 away).
  - `roll-call-data.test.ts`: "dates a Raid prep added on Wednesday by the KvK Saturday it serves" (added Wed Nov 18, opened Sat Nov 21).
  - `YourTime.test.ts`: "says the raid's reset is the day before on a viewer's clock behind the server's" (00:00 ST on Sat Nov 21 is 23:00 on Friday in São Paulo).
  - `events.test.ts`: a type-level line, "a mark says Raid prep or other, never the roll call's title". The existing `uid` line now passes `roll_call`, so its `@ts-expect-error` still fails only because of `uid`.

## Decisions

- **The day-shift words changed app-wide, both directions.** "(+1 d)" and "(−1 d)" are one pair of shared keys, used by every "your time": Times, Member squads and the board's time column. Changing only "−1 d" would leave the same cryptic pattern in "+1 d".
- **Only Raid prep's bar says "to mark".** Other roll calls' tiles and chips say "Not set" (D75, D103). Their bar keeps that word, so each page stays consistent with itself.
- **The analytics property is on `ws_roll_call_marked`, not on the page view.**
  - `before_send` reads only the event's path, and the URL (`?id=` or `?entry=&week=`) does not say which roll call it is.
  - Putting the kind on `$pageview` needs one of two things. The first is a super property registered by the page; PostHog's first page view is captured inside `init`, before such a registration can land. The second is a DOM read inside the pure sanitiser. Both are fragile.
  - The mark events come from components that already know which page they are on, so the property is exact there.
  - Page views of `/roll-call/mark` still cannot tell Raid prep apart. The plan's "Changed" line says so.
- **The tick's server `ws_roll_call_marked` gets no `roll_call`.** It only ever fills Raid prep. The plan's row says this.
- **Values `raid_prep` / `other`**, not the code's `RollKind`. The issue's question is Raid prep versus the rest. `RollKind` has a `raid` kind that would read like `raid_prep`.

## Deviations

- The task said "replace '(−1 d)'". I also replaced its pair "(+1 d)" (see Decisions).
- The Calendar needed no change.
  - It links to a roll call only from a Calendar entry, and that entry sits on its own day: the KvK entry on its Saturday.
  - It never shows a roll call added by hand.
  - Push reminders cover only Calendar entries and carry no date.
- `useMarks(slug, occasion, rows, failed, extra)` is now `useMarks(slug, occasion, rows, { failed, roll_call }, extra)`. A sixth positional argument pushed the function over the 80-line lint limit.

## Verified

- **`pnpm check` passed**: prettier, eslint, tsc, vitest (300 files, 1560 tests, 4 skipped), drift, and i18n (17 languages).
- **Each new test fails when the code is broken on purpose**:

  | Deliberate break | Result |
  |---|---|
  | `countLine` picks `roll.left` for Raid prep | the bar test failed: "Shield: 6 not set · …" |
  | `rollCard` uses `headerOf` for a Raid Shield roll call | the list test failed |
  | `calendar.prevDay` back to "−1 d" | the your-time test failed: "23:00 your time (−1 d)" |
  | `roll_call` typed `string` | `tsc` failed: an unused `@ts-expect-error` and the closed-list check |

- **`pnpm test:e2e` (local, db:local cluster)**: 36 passed, 1 skipped, 2 failed. The two failures are "Home shows the alliance, its activity and its week line" (phone and wide). They expect "Everyone looks fine this week." and get "Time for the weekly appreciation post", because the server day was Sunday.
  - The same test fails the same way on an untouched build of `origin/dev`, so the failure is not caused by this change.
  - No e2e assertion quotes any changed text.
- **First-glance test**, run before and after the change at 360 × 780, on a local production build of each version.
  - Data: the e2e seed's invented roster (11 members), plus a Raid prep added by hand on Wednesday Nov 25 for KvK Saturday Nov 28. Five members are marked ✓. The morning-check readings saw 10 of 11 with a shield. The Raid Shield check is on. The browser clock is São Paulo (UTC−3).
  - The bar's count line shows on a phone, the R5's state: everyone "the rest" would cover was seen with a shield, so no button.
  - The seed's week has nine Cheese Trap cards, so the list shot is framed on the Raid prep card, not the list's top.
  - Each persona saw one version only.

  | Screen and question | R5, 40s, native English | Officer, early 20s, English second language | Product strategy |
  |---|---|---|---|
  | List card, "Which raid?" (before) | **Wed Nov 25 (wrong)** | **Wed Nov 25 (wrong)** | **Wed Nov 25 (wrong)** |
  | List card, "Which raid?" (after) | Sat Nov 28 | Sat Nov 28, Friday 23:00 on her clock | Sat Nov 28 |
  | List card, "How many to mark?" (before / after) | 6 / 6 | 6 / 6 | 6 / 6 |
  | Raid prep, "Which raid?" (before) | Sat Nov 28 | Sat Nov 28, "−1 d confuses me, not sure it's Sat" | Sat Nov 28 |
  | Raid prep, "Which raid?" (after) | Sat Nov 28, 23:00 Friday her time | Sat Nov 28, "23:00 my time the day before (Friday night)" | Sat Nov 28 |
  | Raid prep, "How many to mark?" (before) | 6 | 6, "unsure whether 6 or 5" | 6 |
  | Raid prep, "How many to mark?" (after) | 6: "the card and the bar both say 6 to mark" | 6: "the bottom bar says 6 to mark, and the card agrees" | 6, briefly unsure between 5 and 6 |

  No persona reached a wrong conclusion after the change.
- **Exact texts at 360 px**:
  - bar, before: "Shield: 6 not set · 1 not seen yet, left out";
  - bar, after: "Shield: 6 to mark · 1 not seen yet, left out" (PT "Escudo: 6 para marcar · 1 ainda sem escudo visto, deixado de fora"; FR "Bouclier: 6 à marquer · 1 pas encore vu, laissé de côté");
  - list card, before: "Wednesday, November 25";
  - list card, after: "KvK Sat, Nov 28 · raid at the reset · 00:00 ST · 23:00 your time (the day before)" (PT "KvK sáb., 28 de nov. · raid no reset · 00:00 ST · 23:00 sua hora (dia anterior)"; FR "KvK sam. 28 nov. · raid au reset · 00:00 ST · 23:00 votre heure (la veille)").
- **PostHog Endpoints**: checked by reading the code that uses them, `lib/analytics/endpoints.ts`, `lib/queries/admin-activity.ts` and `lib/private/board-reach.ts`, against the HogQL recorded in `docs/handoff/feat-484-posthog-usage-numbers.md`.
  - `lap_board_reach` and `lap_alliance_usage` read only `$pageview` (`section`, `area`) and the server's `ws_action`. Neither reads `ws_roll_call_marked`, so neither is affected.
  - I had no PostHog access, so I could not check saved insights or dashboards. One that breaks `ws_roll_call_marked` down by a property sees `roll_call` only from this release on.
- No real roster names are in the diff: every name and value is invented.

## Open issues

- **"Home shows the alliance…" e2e fails on a Sunday server day.** The page shows the weekly-thanks prompt instead of "Everyone looks fine this week." This is pre-existing and depends on the weekday.
- **A Raid prep card keeps its slot by the day it was added.** On the list it now reads "KvK Sat, Nov 28" but sits between Tuesday's and Wednesday's cards. Ordering it by its raid day would be a change in `weekItems` (`lib/private/roll-call-view.ts`).
- **The list card's counts still say "Not set 6" on Raid prep** ("Shield up 5 · No shield 0 · Not set 6", `tallyParts`). Its page and bar say "to mark". The officer who reads English as a second language named "Not set" unclear again.
- **The French bar has no space before its colon** ("Bouclier: 6 à marquer"). French wants a no-break space there. `countLine` joins the part and the counts with a fixed `": "`. This is pre-existing.
- **Raid prep page views cannot be counted apart from other roll calls.** Only its marks can (see Decisions).
- **Panel notes**: each was raised by one persona or more, and none led to a wrong answer.
  - "10 of 11 seen at the morning check" competes with "5 of 11" marks (R5, both officers).
  - "1 not seen yet, left out" is unclear (ESL officer).
  - "Mark ✓ the 5 seen with a shield" made the product persona hesitate between 5 and 6.
  - "the day before" is wordy, but everyone read it right (R5, product).
- **The product persona proposed**:
  - one headline, "6 members still need a Shield mark";
  - the reminder copy for those not seen, right under it;
  - a countdown to the raid on the list card.
- **The guide kept outside the repo**: the Calendar legend and "your time" changed wording. No onboarding or settings flow changed, so no new screenshots are needed.

## Next

- Model/effort: keep. This was copy, one moved function and one event property, with no data change.
- Owner first: nothing. There is no migration, no environment change and no PostHog change.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`. Issue 585's batches run from the issue.

<adjustments>
- `raidHead(friday, { t, language, zone, today })` is in `app/(private)/_ui/roll-call-data.ts`. Any other place that dates a Raid prep roll call calls it with `fridayOf(day)`.
- `ws_roll_call_marked` has `roll_call` (`raid_prep`, `other`) from this release on. An insight on Raid prep marks filters on it. Events before this release have no `roll_call`.
- Raid prep's bar words are `roll.prep.left`, `roll.prep.leftAway` and `roll.prep.leftAway.one` in `dictionary.raidprep-glance.ts`. The shared `roll.left*` keys are for the other roll calls.
- The e2e "Home shows the alliance…" test fails on a Sunday server day. Expect it red in a local run on Sunday, or fix it first in a small `fix/` PR.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/610
