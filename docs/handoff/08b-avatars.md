# 08b — Discord webhook avatars

## Built
- `docs/brand/drawing/examples/discord.py`: `scout()` and `admin()`, both viewBox 100 × 100, the Granny Doctor's bust inside the centred circle of diameter 80. Registered in `build.py` as `discord-scout` and `discord-admin`.
  - KvK Scout: head tilted 8° forward into a three-section spyglass held to the goggle, a glint at the objective, a two-tailed scarf blown back, two wind marks.
  - LAP Tracker Admin: head tilted 11° chin-up, heavy lid over the top half of the goggle, frowning brow, a quill tucked in the hat band, a wax seal of office on a cord at the chest.
- `docs/brand/discord/kvk-scout.png` and `docs/brand/discord/laptracker-admin.png`: 512 × 512, ink `#1e1a1f` on paper `#efe6d3`.
- `docs/screenshots/08b-discord-avatars-dark.png`: both avatars cropped round at 128 px and at Discord's 40 px chat size, with names and the APP tag, on Discord's dark grey `#313338`.
- `docs/brand/drawing/lib.py`: `GAIN`, a multiplier on every stroke and ring width (default 1.0).
- `docs/brand/drawing/examples/granny.py`: `leaf()` honours `GAIN`; `head()` takes `skip` (`"brim"`, `"beak"`, `"brow"`, `"pupil"`) so a pose can redraw those parts.

## Decisions
- Admin carries the wax seal, not a ledger. The brief allows either. Four rounds of a ledger under the arm read at 40 px as a box, a van or a drum; the seal is the brand's own ornament and reads at 40 px.
- Avatars draw with `GAIN = 1.4`. Discord shows them at 40 px, below the 96 px the vignette line weights were set for; at 1.0 the lines broke up.
- The owner asked in review for more personality (rounds 10–14): the head tilt, the expressions, the scarf, the glint and the quill came from that.
- Shapes that overlap other strokes (scarf tails, lid, quill) are in their own `<path>`; inside one nonzero path the overlaps cancelled and left white holes.

## Deviations
- Task 3 (`lib/notify.ts` sends no `username`, never `avatar_url`) was already done in PR #35; `lib/notify.test.ts` already asserts `username` is absent. No change in this session.
- The rasteriser is not in the repo. It ran from a scratch folder with `playwright-core` driving the system Chrome, because `playwright-core` is not a project dependency and the constraint was no new dependency. Inputs to reproduce: render each SVG at 512 × 512, `deviceScaleFactor` 1, body background `#efe6d3`, `color: #1e1a1f`.

## Verified
- `build.py` output for all 19 drawings that existed before this session is byte-identical to the pre-change build (`cmp` on every file).
- Two separate builds give identical `discord-scout.svg` and `discord-admin.svg`; re-rendering them gives PNGs byte-identical to the committed ones.
- SVG sizes: scout 3,722 B, admin 3,552 B (under 4 KB); single colour, no ids, masks, gradients, filters, opacity or text.
- Every mark inside the 80 % circle, checked against a guide overlay at 400 px.
- `pnpm check`: Prettier, ESLint, tsc, Vitest 104 passed / 1 skipped.
- Upstream API calls: 0.

## Open issues
- `docs/brand/DRAWING.md` does not mention `GAIN` or the new `skip` values. Worth a line if more small-size drawings come.
- A committed rasterise script would make the PNGs reproducible from the repo alone; it needs `playwright-core` as a dev dependency or a Chrome `--screenshot` call.

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal from this session.
Owner must do first: merge this PR; upload `docs/brand/discord/kvk-scout.png` to the "KvK Scout" webhook and `laptracker-admin.png` to the "LAP Tracker Admin" webhook in Discord (channel settings → Integrations → Webhooks → avatar). The Session 8 step 4 scheduler proof must have passed before the rehearsal is meaningful.
Plan changes needed: none.

<adjustments>
- Discord names and avatars come from the webhook settings: `lib/notify.ts` sends neither, so the `[TEST] Rehearsal` message should show "LAP Tracker Admin" with the seal avatar once the owner has uploaded it.
- Run `gh` with `GH_TOKEN=$(gh auth token --user daniro-san)`; the default account cannot list secrets or open PRs.
- tick.yml is dispatched with `gh workflow run tick.yml` (default phase=tick) or `-f phase=before|after`.
</adjustments>
https://github.com/daniro-san/LAPTracker/pull/76
