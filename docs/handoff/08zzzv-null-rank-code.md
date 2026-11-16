# 08zzzv — /v1 members with a null `rank_code` no longer fail the read

Owner request, 2026-11-16. The daily roster read of 2026-11-16 closed partly done: `v1.schema` for 7 of 20 alliances (OGs, WACK, FSPN, CR8R, WOK, FGH, AFR). The owner asked to test the upstream answers, validate the schemas again and update them to what the upstream sends.

## Built
- `fixtures/v1-20261116T105019Z/`: `quota-before.json`, `alliance-67111155.json` (OGs), `alliance-67111128.json` (FGH), `alliance-67111040.json` (AFR), `quota-after.json`. The alliances were read with `?fresh=1`, as `fetchAlliance` does (D64). Row added to `fixtures/README.md`.
- `lib/sources/shared.ts`, member schema: `avatar_url`, `frame_url`, `rank_code` and `rank_label` accept `null` as well as an absent key (`.nullish()` instead of `.optional()`). `toSnapshotInput` already mapped `null` to `null` for all four, so nothing else changed.
- `lib/sources/v1.test.ts`: one new test, "reads a member whose rank_code, rank_label, photo or frame is null instead of failing the read", on today's OGs body. The existing "parses every recorded /v1 body" test now covers 27 bodies (was 24).

## What the upstream sends now (3 alliance bodies and 2 quota bodies, 2026-11-16 10:50 UTC)
- The cause of the failure: some members have `rank_code: null` (OGs 1 of 101, FGH 3 of 65, AFR 6 of 62). The schema accepted a number or an absent key, not `null`. The failing paths were `members.<n>.rank_code` and nothing else.
- Those members also have `rank_label: ""`, `x`, `y`, `online`, `active`, `daily_honor`, `daily_tech` all `null`, and three keys no other member has: `player_id` (equal to `uid`), `level` (equal to `lv`), `sid`. Their `uid`, `nick_name`, `power`, `kills`, `lv`, `avatar_url`, `frame_url` have values.
- The alliance's `power` equals the power sum of the members that have a `rank_code`, exactly, in all three bodies. The members with `rank_code: null` are not in it. `member_count` equals `members.length` and counts them. OGs has `member_count` 101 with `capacity` 100.
- Of the 10 such members, 3 were in the same alliance's body of 2026-11-04; 7 are in none of the 24 bodies of 2026-11-04.
- Every other field the app reads has the type the schema expects, in every member and at the top level. `/v1/quota` passes its schema unchanged.
- Keys the app does not read: `age_seconds` and `refreshing` are new at the top level of both endpoints. No key of 2026-11-04 was removed, at the top level or in a member.
- The upstream docs (https://api.lastasylumtracker.com/docs, read without a key) say of member fields: "A missing value means that roster did not include it." They do not mention `kills`, `rank_code`, `rank_label`, `avatar_url` or `frame_url`, and do not describe the members with `rank_code: null`.

## Decisions
- **The members with `rank_code: null` are kept as roster members, as the upstream sends them.** The request was to make the schemas accept what the upstream sends. Dropping them would be a product rule; see Open issues 1.
- **All four cosmetic fields accept `null`, not only `rank_code`.** They share one rule in the code's comments (a cosmetic field never fails a run), the mapper already took `null` for each, and the upstream docs say a value can be missing. Only `rank_code: null` was observed.
- **`rank_label: ""` is stored as sent.** The only reader, `lib/queries/leadership.ts`, selects rank codes 104 and 105, so an empty label of a member without a rank code is never shown.
- **A new folder, not `v1-ids/<id>.json`.** FGH and AFR already have bodies of 2026-11-04 there that tests name by uid; overwriting them would change those tests' input.

## Deviations
- record-fixture skill, step 3: the bodies went to `fixtures/v1-20261116T105019Z/alliance-<id>.json` (the layout of the two `v1-20261104…` folders) instead of `v1-ids/<id>.json`, and the path carried `?fresh=1`. Reasons above.
- 3 of the 7 failed alliances were recorded, not all 7: the skill asks the owner above 5 calls, and 3 alliances plus the two quota calls is 5.
- The skill's loop (`while read -r path out`) does not run in zsh: `path` is zsh's `PATH`, so `curl` was not found. No call left the machine on that first try (`used` was 22 on the next `quota` call, one above the daily read's 21). The second try used another variable name.

## Verified
- Before the schema change, with today's bodies in `fixtures/`: `pnpm vitest run lib/sources/v1.test.ts` failed with `SchemaError: v1.schema: members.55.rank_code, members.57.rank_code, …` through `fetchAlliance`, the same code the daily read reported. After the change it passes.
- `pnpm check` green: prettier, eslint, tsc, vitest (267 passed, 1 skipped), drift, i18n.
- `pnpm snapshot:dry --phase before` (no network): the collector read all 20 alliances from fixtures, `failed: []`; OGs came from today's body with 101 members.
- Quota: `used` 22 before, 26 after, so 5 calls as estimated; 974 left at 10:50 UTC. No key in the saved files (`grep -rl 'lap_'` printed nothing). Monday in UTC and in server time.
- Not verified: WACK, FSPN, CR8R and WOK were not read today. They failed in the same run with the same code; the paths of that run were not stored, so their cause is assumed to be the same.

## Open issues
1. **Members the game's roster did not list are now stored as members.** The facts above suggest the upstream appends players whose profile names the alliance but who were not in the game's roster answer (my reading; the docs do not say). OGs at 101 of 100 means at least one of them is not a member now. Effects once this is deployed: they appear in rosters and member counts; their kills enter `total_kills` (today 113 of 7.8 M for AFR, 77 of 1.4 M for FGH, 12,698 of 50.2 M for OGs); their power is not in `total_power`, which is the upstream's `power`. If such a member is in the After roster and not in the Before one (or the reverse), the alliance's kills change moves by that member's lifetime kills, and they show as joined or left. Option for the owner: drop members with `rank_code: null` in `toSnapshotInput` and store `member_count` as the number kept. That needs a decision entry and a question to the maintainer about what these rows are.
2. **Four failed alliances were not recorded** (WACK 67110992, FSPN 67117338, CR8R 67110415, WOK 67110999). Recording them costs 6 calls. The first daily read after the release shows whether they pass.
3. **Today's daily read stays partly done.** `/admin` reads a day again only when it failed or was left running (`retryDailyRead`); a partly done day has no retry. The 7 alliances have no roster for 2026-11-16.
4. **A `v1.schema` failure keeps no detail.** `SchemaError.paths` is not stored in `run_logs` or shown on `/admin`, yet the Discord message says "Send the details to the maintainer". Finding the field today cost 5 calls. Follow-up: store the paths (they carry no values) as the row's error detail.
5. **record-fixture skill:** rename the loop variable `path` (it breaks under zsh, the shell here).
6. **Seed and dry run:** `scripts/seed-data.ts` and `scripts/snapshot-dry.ts` take the latest `v1-<ts>/alliance-<id>.json` for an alliance that has no `v1-ids` body, so OGs now comes from today's body (101 members) in both. All tests pass with it.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` and release (patch) before the next daily read (2026-11-17 06:00 server time, 08:00 UTC) and before Saturday's event; then decide Open issue 1.
Plan changes needed: §2 — a member row can carry `rank_code: null` with the keys `player_id`, `level`, `sid`; `power == sum(members.power)` no longer holds when such members are present; `cache_seconds` is 3600 and the body has `age_seconds` and `refreshing`.

<adjustments>
- `/v1` members can have `rank_code: null` and `rank_label: ""`. The alliance's `power` excludes those members; `member_count` includes them.
- Bodies of 2026-11-16 read with `?fresh=1`: `fixtures/v1-20261116T105019Z/alliance-{67111155,67111128,67111040}.json`.
- The `record-fixture` loop must not use a variable named `path` in zsh.
- A partly done daily read cannot be read again from `/admin`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/267
