# feat/634-shield-on-card — the Raid Shield reading on the member card (#634, option A)

## Built

- `lib/private/card-shield.ts` (new): `cardShield` returns the card's Raid Shield block, or null. It shows only while `shield_check` is on, and only from Friday 23:30 ST (the night check) until before Saturday 12:00 ST (KvK), in server time. Outside the window it reads nothing. States:
  - an officer's Shield mark on the week's Raid prep leads: "Raid prep: Shield up / No shield / No problem seen", with the newest checkpoint muted under it;
  - otherwise the tracker's checkpoints, newest first: "Morning check: no shield seen (map from 07:15 ST)", the older one muted;
  - "Tracker: not read yet" before any reading;
  - only "Away on raid day" for a member away on the raid's Saturday.
- `lib/shield-check.ts`: `raidOf` gains `night` (Friday at `NIGHT_MINUTE`), so the window has one rule.
- `lib/raid-prep-fill.ts`: `weekRaidPrep` is exported. The card reads `callId` only and never calls `make`.
- `lib/private/raid-prep.ts`: `hintOf` is exported and reused for the checkpoints.
- `lib/private/member-card.ts`: the card JSON gains `shield`, read in the same `Promise.all` as the other parts.
- `app/(private)/_ui/MemberCards.tsx`: `ShieldBlock` in the header, under the status, inside `ph-no-capture`.
- `lib/private/dictionary.card.ts`: four new keys in EN, PT-BR and FR. The checkpoint, map-time and mark words are Raid prep's own.
- D137 and D136 each get a dated amendment. D137's names the card as a second reader, with its window. D136's records that shields show only in that window, in server time only.
- Plan: `.specs/features/634-shield-on-card/plan.md`.

## Decisions

- Reads: the check's two alliance-wide windows (`shieldReadings` over `passWindows`, as on Raid prep), the week's Raid prep, and its newest Shield marks (`newestMarks` for that roll call). No per-member query (D149).
- An officer's mark leads; a mark the tracker wrote does not. This includes "Mark ✓ the n seen with a shield", whose marks are the tracker's. Those checkpoints say the same, with the map time. A cleared officer mark does not lead.
- The away day is the raid's Saturday, as the Discord summary and the push count it (D137, 2026-11-22).
- With `shield_check` off there is no block, even when officer marks exist (D126: turned-off features are hidden).
- The shield reading is not a private roster field: `shielding` is not in `BLOCKED_ROSTER_KEYS` or `.claude/rules/private.md`. D137's own privacy rule is what changes, and the owner approved that on #634.
- Persona check, 4 of 4 approve with changes (details in the plan's Validation section). Applied:
  - every line under an officer's mark is muted;
  - "Tracker: not read yet";
  - "Away on raid day";
  - only the newest checkpoint under a mark;
  - an officer's "No shield" in the attention colour, never bold;
  - a test across midnight.

## Deviations

- The task says "a member who is away shows as away". The issue's settled list says "Away members get no line". Both are kept: an away member gets "Away on raid day" and no reading or mark.
- The ESL persona asked for "(map scan 07:15 ST)". This was not applied: #585's first-glance panel tested "map scan" and it was read as another check, while "map from" was read correctly by 4 of 4 (D137, 2026-11-21). The card keeps Raid prep's words.
- D116 is not about KvK times (it is "officer feedback frames…"). The KvK times come from D137's facts.

## Verified

- `pnpm vitest related --run` on the changed files: 94 files, 502 tests passed.
- `pnpm check`: exit 0. That is prettier, eslint, tsc, vitest (335 files, 1768 tests), drift and i18n.
- `lib/private/card-shield.test.ts` (PGlite, 8 tests):
  - window edges in server time: Fri 23:29 none, 23:30 shown, Sat 00:05 the same raid, 11:59 shown, 12:00 none, Thursday none;
  - the check off;
  - checkpoints with their tones;
  - officer ✓, ✗ and "No problem seen" leading, and a cleared mark not leading;
  - the tracker's own mark not leading;
  - not read yet;
  - away on the raid's Saturday, and not away when the note ends Friday;
  - PT-BR and FR words.
- `app/(private)/api/w/[slug]/cross-workspace-reads.test.ts` (issue 471 suite): Alpha's card never shows Bravo's reading of the same player.
- Each test fails when its rule is broken. Ten mutations were run one at a time and each turned at least one test red:
  - the window's start and end;
  - the feature check;
  - the tracker-mark rule;
  - the cleared-mark rule;
  - away;
  - the attention tone of the reading and of the officer's ✗;
  - newest-only under a mark;
  - the `union_id` filter in `shieldReadings`.
- E2E (same-PR rule): `e2e/desk.spec.ts` covers the member card, but the block cannot be asserted there. The card is made on the server, which runs `next start` on the real clock. `page.clock` moves only the browser. The seed has no shield reading. An assertion would run only when the suite happens to run between Friday 23:30 and Saturday 12:00 ST, and is skipped otherwise. No e2e change.
- Analytics plan: no change. The block is read-only text with no control, and no event or property carries a shield value or a name.

## Open issues

- A card opened at 11:59 ST keeps its block after 12:00 until it is read again (a save, a reopen). The next read returns none. Not fixed.
- PostHog session replay masks the block (`ph-no-capture`, and the layout's `ph-mask`). It has not been checked whether PostHog records network payloads of `GET /api/w/[slug]/members/[uid]`. This holds for every card field, not only this one.
- Not checked in a real browser at 360 px. The block's layout was judged on a static mock at 360 × 780.

## Next

- Follow-up: check PostHog's network capture settings for `/api/w/*` (adversarial SHOULD).
- Follow-up: measure card opens against Raid prep opens between Fri 23:30 and Sat 12:00 ST, before and after the next KvK, from existing events (product persona).
- Follow-up: optional e2e coverage would need a server-side clock override for the e2e build (none exists today) and a seeded reading.

What was missing from the task prompt? It asked for "away shows as away", while the issue's settled list says away members get no line. It also did not say whether the officers' mark or the tracker's mark leads. The issue settled that officer marks lead, but said nothing about the tracker's own marks.

PR: https://github.com/daniro-san/LAPTracker/pull/681
