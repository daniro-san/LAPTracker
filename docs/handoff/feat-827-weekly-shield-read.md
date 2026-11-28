# feat-827-weekly-shield-read — the after-reset check, every Saturday at 02:30 ST

Closes #827. Evidence: the probes of 2026-11-23 and 2026-11-28 on #726 (64 % and 56 % of members had a map scanned after the 00:00 ST reset at 02:30 ST).

## Built

- `lib/shield-reset.ts` (replaces `lib/shield-probe.ts`): `shieldReset`. On the Saturday ticks of 02:30 and 02:45 ST (04:30 and 04:45 UTC), every week, it reads every member of each alliance whose `shield_check` is on, once, with the checks' call (`readOne`, no `fresh`), on the alliance's own key (`squadTargets(…, "shield_check")`), from the day's roster. About one call per member.
  - Resumable (orchestrator's review on PR #849): each tick reads only the members with no reading in this Saturday's `resetWindow`. The 02:45 tick goes on where 02:30's 180 s budget ended, and retries an alliance skipped with `squads_busy` or `quota_low`. An alliance with nobody left is skipped with no log line. An alliance not started before the budget ends makes no call (no /quota call either) and waits for 02:45.
  - Guards kept from the probe: reserve `squadsReserve` + `SHIELD_CALLS_MAX` on our key, `SQUADS_SAFETY_MARGIN` + `SHIELD_CALLS_MAX` on a workspace key; `quota_low` when the whole read does not fit; `squads_busy` while the alliance's squads read is `running`; at most 120 calls per alliance; no might version, no newcomer queue, no mark, no post, no `shield_checks` row.
  - Claim: `app_alerts` id 6 (`RESET_ALERT`), claimed per tick with a 10-minute gap, so one of two overlapping ticks runs and the 02:45 tick can still claim. The per-member skip is what keeps each member to one read a week.
  - One `shield.reset` run-log line per alliance (counts and a reason only).
- `lib/shield-check.ts`: `RESET_FROM`/`RESET_TO`, `resetReadDue(now, cfg)` (pure clock check, Saturday 02:30–03:00 ST: the 02:30 and 02:45 ticks), `resetWindow(day, cfg)` (Saturday 02:30–03:15 ST, where the readings land, at most 03:03; separate from `passWindows`).
- `lib/tick-gate.ts`: the probe's gate line is replaced by `resetReadDue`. `lib/squads-tick.ts`: the `shieldProbe` call is replaced by `shieldReset`, same place and budget.
- Raid prep (`lib/private/raid-prep.ts`): reads the reset window as a third reading. The reading becomes a checkpoint `pass: "reset"`, shown between night and morning as "After-reset check" / "Após o reset" / "Après le reset" (`lib/private/dictionary.raidprep.ts`). Its map enters `handReason`'s 3 h rule, so "To check by hand" uses it like the other two checks. `hintOf` takes the reset reading as an optional third argument.
- Estimate: `TRACKER_CALLS.shield_check.perMember` 2 → 3; with squads on, the extra is `perMember − 1` (was `/ 2`). 100 members: 300 calls on Saturday, or 206 → 306 with squads. Help text on /admin (`lib/copy-admin-features.ts`) and in Alliance settings (`switches.callsWeekly`, EN/PT/FR) now says "from Friday night to Saturday morning" instead of "on Friday night".
- Removed: `lib/shield-probe.ts`, `lib/shield-probe.test.ts` (renamed and rewritten as `lib/shield-reset*.ts`), `PROBE_WINDOW`, `PROBE_ALERT`, `probeDue`, the probe's gate line and call. `lib/api-probe.ts` (#820/#789, Sun 2026-11-29) is not touched.
- D137: amendment 2026-11-28b. `docs/GLOSSARY.md`: "Raid Shield check" now names three reads, including the **after-reset check**.
- Tests:
  - `lib/shield-reset.test.ts`, seven: Saturdays in the window only (not 04:29:59Z, not 05:00Z, not Friday or Sunday at 04:30Z) and each member once per week (two overlapping ticks read once, the 02:45 tick reads nothing when all are read, next Saturday reads again); a second alliance on a saved workspace key (its /quota call and member calls carry that key's `apiKey`, never LAP_API_KEY; its own `shield.reset` line with its `union_id`; at 20 s a call the 02:30 budget ends after 9 of OGs' 12 with `deadline`, and the 02:45 tick reads OGs' last 3, then the second alliance; each member read once); outside every event window (`inEventWindow`, each minute of 02:30–03:03 ST over 4 Saturdays) and both `passWindows`, inside `resetWindow`, and no mark, post, member fact or check-row change; skipped when the switch is off; `quota_low`; `squads_busy`; the tick's gate opens and `squadsBatch` runs it.
  - `lib/private/raid-prep.test.ts`: a post-reset reading with a shield takes a member off "To check by hand", shows as a `reset` checkpoint, and the night and morning counts do not count it.
  - `lib/private/features.test.ts`: the estimate counts three reads.

## Decisions

- **Every shield-check alliance, each on its own key.** The probe read only the own alliance. The task says "on the alliance's own key" and "behind the shield check switch", and the estimate is per workspace, so the weekly read covers every alliance whose `shield_check` is on. Alliances are read one after another inside the same 180 s `after` budget; at 500 ms pace that is about 2 alliances of 100 members per tick, so about 4 over the two ticks.
- **Resume by member, not by alliance.** The review asked to skip an alliance that already has readings this Saturday. I skip each member who has one instead: an alliance cut by the budget then gets its remaining members at 02:45 instead of being left half-read, and an alliance with every member read is skipped, as asked. The guard against a second run is the same data: no member is read twice in a week. The claim is now per tick (10-minute gap), only to stop two overlapping ticks reading the same members at once. Id 5 is the API probe's.
- **Its own window, not a third key in `passWindows`.** `passWindows` feeds the counts, the summary, the pushes, Insights, the fill and the member card. A separate `resetWindow` means only Raid prep reads the new readings, as the task asks.
- **The row's suggestion is unchanged** (`morning ?? night`): "Accept the tracker's" and "Mark ✓ the n seen" mark from `lib/raid-prep-fill.ts`, which reads only the two pass windows. Officers confirm by hand; the reset reading only adds a checkpoint line and its map to the 3 h rule.
- **The list's naming gate (#826) is unchanged**: "To check by hand" names nobody until the morning check has read. The reset reading changes who is listed after that.

## Deviations

- The help texts on /admin and in Alliance settings changed ("on Friday night" → "from Friday night to Saturday morning"), because the number they show now includes Saturday's two reads.
- The glossary cell was shortened ("before KvK", the "never 'Friday's read'" clause dropped) so it fits the table's column width; otherwise Prettier re-pads all 75 rows.

## Verified

- `pnpm vitest related --run` on the 12 changed source and test files: 243 files, 1420 tests passed.
- `pnpm check`: exit 0 (411 files, 2250 passed, 4 skipped; drift and i18n checks fine). It needed one fix round, for an unused import in the new test.
- After the review fixes (rebased on dev): `pnpm vitest related --run lib/shield-reset.ts lib/shield-reset.test.ts lib/shield-check.ts lib/tick-gate.ts`: 93 files, 584 tests passed. `pnpm check`: exit 0 (415 files, 2265 passed, 4 skipped).
- Each new test fails when its behaviour is broken. I applied each mutation by hand, ran the tests and reverted it:
  - claim gap 8 days (first round, one weekly claim): "once a week" fails;
  - the per-member skip removed (every roster member read on each tick): "each member once a week" and the second-alliance test fail;
  - the budget check before each alliance removed: the second-alliance test fails (the other alliance starts at 02:30);
  - the `resetReadDue` gate line removed: the gate test fails;
  - the `squads_busy` check disabled: its test fails;
  - the reset map left out of the 3 h rule: the Raid prep test fails;
  - `perMember` back to 2: the estimate test fails.
- No upstream call; the tests stub `/v1/players`.

## Open issues

- On LAP_API_KEY the read's calls are not subtracted from `squad_reads.quota_remaining` (same as the probe). The morning check starts from that stored value, about 100 too high, until its first answer's `quota.remaining` corrects it. With the reserve it is not a correctness risk.
- If both the 02:30 and 02:45 ticks are missed, or an alliance's squads read is still running at both, that alliance has no after-reset check that week. A failed member call (5xx) leaves no reading, so the 02:45 tick tries that member again.
- `no_roster` and `quota_low` are logged on each tick that meets them, so up to two lines per alliance.
- The member card (`lib/private/card-shield.ts`) still shows only the night and morning checkpoints.
- `app_alerts` rows 3 and 4 (the probes' claims) stay; `delete from app_alerts where id in (3, 4)` is optional.

## Next

- After Sat 2026-12-05 02:45 ST, read the `shield.reset` lines (`select at, level, data from run_logs where code = 'shield.reset' order by at`) to confirm the first weekly run.
- Follow-up: the member card shows the after-reset checkpoint too.
- Follow-up: decide whether "To check by hand" may name members from the after-reset check before the morning check (#826 keeps names until the morning).

What was missing from the task prompt? Whether the weekly read covers only the own alliance (as the probe did) or every shield-check alliance; I built it for every shield-check alliance, each on its own key.

PR: (added by the orchestrator)
