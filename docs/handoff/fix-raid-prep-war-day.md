# fix-raid-prep-war-day: Raid prep and war day (issue 585, phase 2 batch 1)

Findings F1, F2, F23, F24 and F36 of the #585 phase 1 review, before Friday's Raid Shield window. Branch `fix/raid-prep-war-day` from `origin/dev` (9bd407a2).

## Built

- **F1, the counts.** The roll call grid now takes one counted mark per member (`roll-call-grid.ts`, `MarkOf`). On Raid prep that is the Shield, so the "To mark" chip agrees with "n of m marked": the seed's "92 of 98 marked" now sits beside "To mark 6 · ✓ 72 · ✗ 20 · All 98" (was "To mark 98 · ✓ 0 · ✗ 20"). A tile is tinted, and folds under "Marked (n)", once its Shield is marked. Test: `roll-call-grid.test.ts`, "counts Raid prep by its Shield".
- **F2, the tile and the chrome.**
  - Tile: name and the Shield's word on the left of the ✓ / ✗ pair; checkpoints on one line ("Night 21:00: seen · Morning 08:00: not seen"); one footer line, "Message".
  - The Squads off the wall pair shows only while the page's "Show squads off the wall" chip is pressed, or on a member who already has a wall mark. This is a page-level switch, not a per-card one: the panel judged a per-card toggle would bring the tall tiles back.
  - The sticky "the rest" bar is one line below 640 (the button; its count stays for screen readers). This applies to every roll call kind.
  - `html:has([data-rest-bar])` sets `scroll-padding-bottom` (8.5rem below 768, 5rem from 768).
  - `html:has([data-sticky-search])` sets `scroll-padding-top: 4.5rem`, so Shift+Tab never stops under the search row.
  - The bar's gutter changes at `md`, not `sm` (no sideways scroll from 640 to 767), and its button text is `text-body-sm`.
  - When "Mark ✓ the n seen with a shield" covers every member the bar would mark, the bar keeps only its count line (`offer`).
  - Raid prep uses the wide frame, with 1 / 2 / 3 / 4 columns at 360 / 640 / 1024 / 1280.
  - "Not seen" is bold only while the tile's Shield is not marked.
- **F23.**
  - "Copy n names" (plain, comma-separated) and "Copy one message" (officers' language, the ready message's parts in a form for many: `remindAll`, `PREP_MESSAGE[*].all`).
  - Both cover members whose Shield is ✗, or not set and not seen with a shield by the tracker. Away members are left out.
  - The message asks to "make sure your shield is on", since some may already have one.
  - A chip says what it copied ("21 names copied", "Message copied") for about 3 s, and only while the list is unchanged. A `role="status"` says the same.
  - Each tile's "Message" is named "Message for {name}" for screen readers.
  - The summary card has a Discord summary line (`summaryOf` in `lib/private/raid-prep.ts`): posted · updated time, off, not set up, waiting, failed, or deleted. "Alliance settings ›" shows for off, not set up and failed.
- **F24, one vocabulary.**
  - Raid prep, Insights, Alliance settings, the Discord summary and the push notification all say "Raid Shield check", "Night check" and "Morning check" (PT "Conferência…", FR "Vérification…").
  - The summary card shows the newest check only: at most 3 counts.
  - Insights dates each week, and its headline, by the raid's Saturday. Its explanation is two sentences, with both times: the read starts at 23:30, and the window is 23:00–00:00 ST.
  - "Accept the tracker's (n)" now reads "Mark ✓ the n seen with a shield".
- **F36.**
  - "Mark the other n as “Took part”" (PT "como “Participou”", FR "comme « Aucun problème vu »").
  - "Add away dates" replaces "Someone is away".
  - The Roll call list's link reads "Mark ›".
  - PT and FR use the singular for 1 away or 1 not seen.
  - **Real bug, fixed:** `teamView` (`roll-call-view.ts`) left away members out of the suggestions only, so a picked Elixir member away on the team's day had no flag. That row now shows "Away that day" in yarn. In the seed, Nimomir, away until Nov 27, is on the Nov 22 team.
- Docs:
  - D137 amendment, with pointers in D103, D139 and D148;
  - DESIGN.md "Mark pair";
  - GLOSSARY "Raid Shield check".

## Decisions

- **Wall: one page switch plus exceptions.** This was the simpler of the two options, and the panel agreed. The switch is not stored.
- **The reminder list leaves out not-set members the tracker saw with a shield** (panel MUST). Messaging them would call out people who did the job. "Mark ✓ the n seen" is for them.
- **"Failed" is inferred.** A post is never recorded as failed, so the state is "failed" when the switch is on, the channel is set, there is no message, and the newest reading is older than 5 minutes. A read and its post share one tick of at most 180 s.
- **Discord message counts unchanged.** Only its labels changed (Fri/Sat became Night check / Morning check). I read "at most 2–3 counts in the summary" as the page's summary card.
- **Short forms on the tile:** "Night" / "Morning" ("Noite" / "Manhã", "Soir" / "Matin"). "How this works" says the times are map scans in ST.
- The Calendar keeps "Roll call ›". Only the Roll call list says "Mark ›".

## Deviations

- The quota line in Features also changed ("on the day of the Raid Shield check (Friday night, ST)"), after the panel flagged it as a vocabulary leftover. D134 quotes the old words; D137's amendment records the change.
- The panel asked for PT "confirme que o seu escudo está ligado" in the one message. I wrote the plural "confirmem que o escudo está ligado" instead, so it agrees with the message's other plural verbs ("tirem", "tragam").
- `RaidPrepHead.tsx` is a new file. `RaidPrepMarks.tsx` went past the 300-line lint limit, so the summary card and the copy row moved there.

## Verified

- `pnpm check` passed (prettier, eslint, tsc, vitest, drift, i18n).
- E2E ran on a local production build with the local database (`db:local`). The seed was the #585 kit's invented roster of about 100 members, with sealed invented webhooks and no upstream or Discord call.
- **Measurements, Raid prep, EN** (before = `dev` 9bd407a2, after = this branch, same seed):

  | | Before | After |
  |---|---|---|
  | Tile height | 234 px (PT 255) | 126 px at every width; 162 median at 1280 when "All" is open |
  | Tiles under "To mark" | 98 ("To mark 98") | 6 ("To mark 6") |
  | Page height, default view, 360 / 768 / 1280 | 24,675 / 12,791 / 8,942 px | 2,050 / 1,431 / 1,317 px |
  | Page height, "All" open, 360 / 768 / 1280 | 24,675 / 12,791 / 8,942 px | 14,346 / 7,548 / 5,166 px |
  | Columns, 360 / 768 / 1280 | 1 / 2 / 3 | 1 / 2 / 4 |
  | Fixed chrome at 360 × 780, mid-list, bar with its button | 62 top + 150 bottom = 212 (PT 237) | 62 + 122 = 184 (PT 188) |
  | List area at 360 × 780, mid-list | 568 px (PT 543) | 596 px (PT 592) |
  | List area at 360 × 780, bar with its count only (the seed's case now) | — | 620 px |
  | List area at 1280 × 800 | 676 px | 700 px |

- **Panel 1 (war lead and product strategist).** Verdict: faster than before (Friday 23:40 takes two taps), counts and words consistent.
  - MUST, fixed: the reminder list named not-set members the tracker had seen with a shield.
  - SHOULD, done: the wall chip renamed to a view switch ("Show squads off the wall").
  - SHOULD, done: one button where the card's ✓ and the bar's "the rest" cover the same members.
  - The settings quota line now uses the shared vocabulary.
- **Panel 2 (R5, officer and accessibility).** All items applied:
  - MUST: `scroll-padding-top` for the sticky search row (WCAG 2.4.11 on Shift+Tab).
  - The 640–767 sideways scroll.
  - The copied status and its 3 s revert.
  - "Make sure your shield is on".
  - One button for the same group.
  - The "Message for {name}" screen-reader name.
  - The bar button at `text-body-sm`.
  - No bold "not seen" on marked tiles.
  - The "Discord summary is off" state.
  - This panel's result came to me through the orchestrator.
- **Panel 3 (QA), 7 of 7 checks passed, no MUST or SHOULD.**
  - F1 counts held through ✓, ✗ and clear taps and through wall marks.
  - Friday night: morning readings removed, night line only, plain names copied with away members left out.
  - Saturday morning: the tracker's ✗ rows come first.
  - Discord states, each with the link only where it should be: posted, not set up, failed and deleted.
  - 12 layout combinations: no sideways scroll, every target ≥ 44 px, the EN bar one line at 360, Tab never under sticky chrome.
  - "Mark ›", the Elixir "Away that day", the Insights Saturday date and the settings words, all in EN and PT.
  - No console errors or failed requests.
  - QA restored the database.
- Screenshots: 360 / 768 / 1280, light and dark, EN, plus PT at 360, in the scratchpad (`rp-wd/shots/`, `rp-wd/qa/`). I reviewed them myself.
- The diff names no member from the fixture roster: a script compared all 307 roster names against the diff.

## Open issues

- **PT at 360, "the rest" button.** "Marcar os outros 5 como “Nenhum problema visto”" can still wrap to two lines (bar 66 px instead of 62) when the bar shows its button. The seed no longer shows it, because the card's button covers those members. A shorter PT label is possible: "Marcar 5 como “Nenhum problema visto”".
- **Two times on one page.** The card shows when the check read ("Morning check 10:10 ST"). A tile shows the member's map scan ("Morning 08:00"). "How this works" explains it; the war lead suggested "Night · map 21:00" on the tile.
- **"The rest" still includes members the tracker saw with a shield** (D137's rule) when others are left too. Only the case where both buttons cover the same members is handled here.
- **The one message after 12:00 ST** still says "before KvK starts at 12:00 ST". This is pre-existing, from `when`.
- **The settings estimate** puts both reads under "Friday night". The peak counts Saturday's UTC quota day, which holds both reads; the wording could say so.
- **Not in this batch:** the Elixir "Team :" with an empty team letter (F36's neighbour, a seed artifact or a real empty variant), and the Discord summary's own counts (still two read lines).
- The seed's tracker marks disagree with its readings. That comes from the seed, not the code: the seed never runs the fill.

## Next

- Model/effort: keep.
- Owner first: merge before Friday 23:30 ST. There is no migration and no environment change.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; batches run from issue 585.

<adjustments>
- The roll call grid counts one mark per member (`MarkOf`); a new kind passes its counted mark, never an array of parts.
- `RestBar` is one line below 640 for every kind, and `data-rest-bar` gives the page its scroll padding. Batch 6 (layout rollout) should keep that marker if it moves the bar.
- Raid prep is on the wide frame (`wide` on its mark page only). The other roll call kinds are still on the legacy width for batch 6.
- F36's "Team :" (empty team letter) and F24's Discord counts were not in this batch.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/590
