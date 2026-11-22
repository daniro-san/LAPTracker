# Insights: Time zones checks

Build: `pnpm typecheck`; `pnpm lint`
Run unit: `pnpm vitest run lib/private/insights-zones.test.ts lib/private/dictionary.test.ts --reporter=verbose`
Plan: `.specs/features/insights-time-zones/plan.md`

profile: light

10 checks in 1 slice · 0 one-way doors · 0 open

## Checks

### S1 - the Time zones card

**C1** - Zurich ×3, Paris ×3, Berlin, Manila and New York on 2026-11-22 read "New York · UTC−5" 1, "Paris, Zurich and 1 more · UTC+1" 7, "Manila · UTC+8" 1, in that order, each bar its count over 9, and the headline "Largest group: Paris, Zurich and 1 more (UTC+1), 7 of the 9 members with a time zone. The 00:00 ST reset is 03:00 for them." (AC 3, AC 4, AC 7, AC 10)
Proof: run unit | ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > groups the zones that share an offset, west to east, cities most members first

**C2** - 5 members in the newest daily update, 3 with a zone, one cleared (version 2 null), one with none, and a former member with a zone read "Time zone recorded for 3 of the 5 members in the newest daily update.", "Not recorded yet" 2, and the one row's share 1 (AC 2, AC 10)
Proof: run unit | ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > counts only the newest daily update's members, and a cleared or missing zone as not recorded

**C3** - Paris and Lagos on Sat 2027-03-27 20:00 UTC, reset after the EU change: two rows "Lagos · UTC+1" "Now 21:00 · Reset 03:00 · KvK Sat 15:00" and "Paris · UTC+1" "Now 21:00 · Reset 04:00 · KvK Sat 16:00" with "Clocks change before the reset", headed "Largest groups, 1 member each: Lagos (UTC+1), Paris (UTC+1). The 00:00 ST reset is 03:00 and 04:00 for them."; on 2026-11-25 one row "Lagos, Paris · UTC+1", headed "All 2 members with a time zone are in one group: Lagos, Paris (UTC+1). …" (AC 5, AC 7)
Proof: run unit | ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > splits zones whose clocks change before the reset, each on its own clock, and joins them after

**C4** - At Sun 2026-11-22 13:00 ST: New York "Now 10:00 · Reset Sun 21:00 · KvK Sat 09:00", Manila "Now 23:00 · Reset 10:00 · KvK Sat 22:00", Kiritimati "Now Mon 05:00 · Reset 16:00 · KvK Sun 04:00", and the legend with "now (13:00 ST)" and "KvK (Sat, Nov 28, 12:00 ST)" (AC 6, AC 13)
Proof: run unit | ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the reset and KvK on each zone's clock, with its weekday when its date is not the server's

**C5** - At Sat 2026-11-28 11:00 ST the KvK shown is that day's 12:00 ST; at 13:00 ST, an hour into it, the next Saturday's (AC 6)
Proof: run unit | ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > shows the next KvK start, never one already running

**C6** - Peaks at server hours 0, 1, 11, 12, 22, 23 read as runs 11–12 and 22–1; New York and Manila ×2 with a fourth member unrecorded read "Within their usual hours for the most: 11:00–12:59 and 22:00–01:59 ST, 3 of the 3 members with a time zone (1 not recorded). …" and "See who" opens hour 11 (AC 12)
Proof: run unit | ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > gives the server hours most members are within their usual hours as ranges, through midnight

**C7** - With no zone recorded for 2 members the card reads only "No time zone recorded yet for the 2 members in the newest daily update." with no rows (AC 8)
Proof: run unit | ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says no time zone is recorded yet, with no rows

**C8** - The copy has the same keys in EN, PT-BR and FR, none empty, and every time names ST (AC 15)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, pt-BR and fr, and no empty value

**C9** - On the e2e seed an officer sees on Insights, without a tap, "Largest group: Manila (UTC+8), 2 of the 3 members with a time zone. The 00:00 ST reset is 10:00 for them." and "Time zone recorded for 3 of the 11 members in the newest daily update."; after "Show the details" the rows São Paulo, Manila, "Not recorded yet" 8 and the usual-hours line; a tap on "Add their time zone ›" opens Members at `?ask=timeZone` listing a member with no zone and not one with a zone, at 360 and 1280 px (AC 1, AC 7, AC 9, AC 10, AC 11, AC 12)
Proof: `PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH pnpm test:e2e e2e/desk-insights.spec.ts --project=phone --project=wide`

**C10** - The card names no member: the cross-workspace and private-field scans pass over Insights with the new facts seeded (AC 14)
Proof: `PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH E2E_NO_BUILD=1 pnpm test:e2e e2e/isolation.spec.ts --project=phone`

## Coverage

| Set (size)               | Member -> proof                                               | Unproven                                                             |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| headline forms, AC 7 (4) | largest C1, C9 · tie C3 · one group C3 · one member -         | one member: a template line (`insights.zones.one`), read in the diff |
| who counts, AC 2 (4)     | newest member with zone C2 · cleared C2 · none C2 · former C2 | -                                                                    |
| clocks, AC 6 (3)         | west of ST C4 · east, same date C4 · east, next date C4       | -                                                                    |
| moments, AC 6 (3)        | now C4 · reset C4, C3 · KvK C4, C5                            | -                                                                    |
| usual hours, AC 12 (3)   | one run C9 · two runs C6 · through midnight C6                | -                                                                    |
| languages, AC 15 (3)     | en C1-C9 · pt-BR C8 · fr C8                                   | -                                                                    |
| widths (2)               | 360 C9 · 1280 C9                                              | -                                                                    |

## Swept

- validation: n/a - no input; the zone was validated when it was saved (`isZone`, D80)
- failure modes: C7 (no zone), C2 (cleared fact); before the first daily update the whole page shows "Insights come with the first daily update." (existing)
- idempotency: n/a - read only
- authorization: existing - `openRollCall` runs `requireWorkspace` and the Insights switch before the read (`turned-off.test.ts`, cross-workspace suite)
- concurrency: n/a - one read per request, nothing stored
- data lifecycle: n/a - nothing stored
- dependency failure: n/a - no outside call
- state transitions: C3 (a summer-time change between now and a moment)
- observability: n/a - no event or property; nothing logged (the PR's analytics plan: none)

## Not proven by a test

- AC 16 (dark mode): the card uses `Bars`' token pair (`bg-plum/60` on `bg-ink/10`) and `text-ink/80`; screenshots in light and dark at 360 px were looked at, not committed (images stay local).
- AC 14's `ph-no-capture`: one class on the rows' list, read in the diff.

## Handoff

**Dispatched:** plan review panel (six officers with a first-glance test; product strategy and designer; data honesty and adversarial), 2026-11-22, and a second round of verdicts from product strategy and the adversarial reviewer. The Verifier is left to the orchestrator's review of the PR (`/pr-review`), as in 585-words.
