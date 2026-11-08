# 08zzl — Officer titles read God of War and Goddess

## Built
- `roleOf` (`lib/queries/leadership.ts`) maps the R4 title, case ignored: `Militarist` → `God of War`, `Overseer` → `Goddess`. Any other title is returned as the tracker gives it. Every place that shows a title reads it from `roleOf`: the Leadership cards (`app/_ui/Leadership.tsx`), the member list's screen-reader text (`app/_ui/MembersExplorer.tsx`) and the player page's profile line. So all three now show the game's names.
- The drawn marks did not change. `officerMark` already maps `god of war` to the crossed swords and `goddess` to the eye (D50).
- /brand: the role-mark list (`lib/copy-brand-components.ts`) and the ornaments line (`lib/copy-brand.ts`) now say God of War and Goddess. The Leadership section's description says that the tracker's Militarist and Overseer are shown as the game's names.
- One test in `lib/queries/leadership.test.ts` covers the mapping, including lower case and an unknown title passing through.
- DECISIONS.md D56.

## Decisions
- D56 (owner, 2026-11-07, issue #179): in the game the slots are God of War and Goddess. This confirms the aliases D50 had marked as "not confirmed".
- The mapping is in the read model, not in the UI. Pages read titles only through `lib/queries`, so one map covers every page. `member_snapshots.rank_label` and `raw_json` keep the tracker's text.
- The map is a `Map`, not an object literal, so a title like `constructor` cannot hit an `Object.prototype` key.
- Language: English in every language. A title is data, not a string in `lib/copy.ts`. D52 allows a game word only from a source that has the game's own text, and issue #153's research covered Might, Kills, Members and Level only. No source gives these slot names per language.
- Diplomat and Recruiter stay as the tracker gives them, as the issue says.

## Deviations
- None. `officerMark` still accepts `militarist` and `overseer`. `roleOf` no longer produces those strings, but the entries are harmless and their tests still pass, so they were left alone.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (44 files, 212 passed, 1 skipped), drift, i18n (17 languages up to date).
- Local stack, all in the scratchpad: Postgres 18 on 127.0.0.1:54359 (TCP only), a WebSocket→TCP bridge, schema from `drizzle/*.sql`, data from `scripts/seed.ts`, and `next dev` with placeholder env and an unroutable upstream (127.0.0.1:9). `lib/db.ts` got a local-only `neonConfig` patch during the capture and was restored byte for byte afterwards. OGs' `rank_code` and `rank_label` were copied by uid from `fixtures/v1-20261104T155902Z/alliance-67111155.json`, so the database holds the tracker's real `R4 · Militarist` and `R4 · Overseer`. Upstream API calls: 0. No Neon database touched.
- Playwright + system Chrome, OGs on event 3:
  - The cards read Leader (crown), Diplomat (dove), God of War (swords path), Goddess (eye path) and Recruiter (horn) at 360 and 1280 px.
  - `scrollWidth − innerWidth` = 0 at both widths.
  - /brand's line reads "Dove, horn, crossed swords, eye · Diplomat, Recruiter, God of War, Goddess (R4)".
- Screenshots:
  - `docs/screenshots/08zzl-leadership-{360,1280}-{light,dark}.png`
  - `docs/screenshots/08zzl-brand-role-marks-360-{light,dark}.png`

## Open issues
- None found.

## Next
Session: none planned by this change; it goes into the next `dev → main` release.
Model / effort: keep. This was a small read-model mapping.
Owner must do first: merge this PR into `dev`.
Plan changes needed: none.

<adjustments>
- Officer titles shown on any page are the game's names (D56). New code that shows a title must read it through `roleOf`, never from `rank_label` or `raw_json`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/184
