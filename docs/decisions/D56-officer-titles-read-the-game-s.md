## D56 — Officer titles read the game's names: God of War and Goddess (2026-11-07, owner, 08zzl, issue #179)

Confirms D50's aliases. The owner: in the game the slots the tracker calls Militarist and Overseer are **God of War** and **Goddess**.

- **One place.** `roleOf` (`lib/queries/leadership.ts`) maps the title after `R4 · `, case ignored: `Militarist` → `God of War`, `Overseer` → `Goddess`. Every page that shows a title reads it from there (Leadership cards, the member list's screen-reader text, the player page). Any other title passes through unchanged. `rank_label` and `raw_json` keep the tracker's text.
- **Marks.** Unchanged: `officerMark` already maps `god of war` to the crossed swords and `goddess` to the eye (D50).
- **Language.** English in every language. A title is data, not copy, and D52's source rule finds no game text that names these slots per language (issue #153's research covered Might, Kills, Members and Level only). Diplomat and Recruiter stay as the tracker gives them.
