# 08zzzzh — fixture privacy: neutral coordinates and presence values, one rule for the unblocked keys

Closes #308.

## Built
- All 33 of the 66 `fixtures/**/*.json` that held `x`, `y`, `online`, `last_online_at` or `joined_at` values now hold neutral values of the same JSON type: numbers `0`, booleans `false`, `null` stays `null`. The keys stay. Only those values changed (33 lines changed, 33 files); every other byte is as recorded, including `0.0` floats.
- `scripts/neutralise-fixture.ts`: `neutraliseFixture(text)` does the replacement on the JSON text, so formatting is untouched. As a command it reads stdin and writes stdout, or rewrites the files named on the command line. Test: `scripts/neutralise-fixture.test.ts` (one test: real-looking input in, neutral output, same keys).
- `.claude/skills/record-fixture/SKILL.md`: the body now lands in a temp file and goes through the neutraliser to its path under `fixtures/`. Step 4 gains a grep that must print `0`.
- `fixtures/README.md`: a note that says which keys are neutral, why, and since 2026-11-16.
- `docs/decisions/D76-roster-keys-unblocked-and-neutralised-fixtures.md`, its line in `docs/decisions/README.md`, and one sentence appended to the roster-fields bullet in `CLAUDE.md`.
- `/admin/members`: `?alliance=` with another tracked alliance shows the picker and the line "Only your own alliance lists members. Pick it to see its list." and reads no database. The might-unchanged help text now says "Not listed ≠ active: the signal catches about 23 % of the members who stop playing, so someone who is not listed may still have stopped." Test: one case in `app/(pages)/admin/gate.test.ts`.

## Decisions
- Decision number D76: D73 and D75 are in open PR #322 and D74 in #323; no open PR uses D76.
- A text-level replacement, not parse and `JSON.stringify`: 18 of the 66 files do not round-trip through `JSON.stringify` (for example `"cooldown_remaining_sec":0.0`), so a re-serialisation would have changed bytes outside the five keys.
- `joined_at` and `last_online_at` that were numbers became `0`, not `null`, to keep the same JSON type (the issue's rule). The parsers in `lib/sources/` do not read any of the five keys, and all tests passed unchanged.
- For another alliance the page shows no aggregate counts, only the message. It is the smaller change and `mightUnchanged` is not called.
- The 23 % note says "stopped playing", not "inactive", to keep D70's wording rule.
- No test asserted the old real values. `lib/queries/players.test.ts` and the blocked-key tests use synthetic values and were not touched.

## Deviations
- None from the task. D76 does not edit `lib/queries/blocked-keys.ts`: the task asked for a decision, not for serving the three keys.

## Verified
- Scrub grep before and after, run from the repo root:
  `grep -rhoE '"(x|y)": ?-?[0-9.]*[1-9][0-9.]*|"online": ?true|"(last_online_at|joined_at)": ?("[^"]+"|-?[0-9.]*[1-9][0-9.]*)' fixtures --include='*.json' | wc -l`
  Before: 10,580 values in 33 files. After: 0. All 66 JSON files still parse.
- `pnpm check` green: prettier, eslint, tsc, vitest (70 files and 333 tests passed, 1 skipped), drift "Everything's fine", "i18n: 17 languages up to date with English". The first run failed on two eslint errors in the new gate test (import order, a non-null assertion); fixed and rerun. No test timed out.

## Open issues
- The git history still holds the real values (owner decision, 2026-11-16: no rewrite).
- `fixtures/screenshots/*.txt` and `*.png` were not touched; they hold player names and game numbers, not the five keys.
- `lib/private/roster-fields.test.ts` (PR #322) and the D71 sentence in `CLAUDE.md` merge next to this change; D76's `docs/decisions/README.md` line sits after D72 and may need to move after D75 when #322 and #323 merge.

## Next
None queued. No session prompt in `docs/SESSION_PLAYBOOK.md` follows this change, and the plan needs no change.

https://github.com/daniro-san/LAPTracker/pull/324
