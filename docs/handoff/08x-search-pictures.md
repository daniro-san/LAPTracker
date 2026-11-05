# 08x — Badge and photo on search rows (#53)

## Built
- `lib/queries/players.ts`: `PlayerMatch` has `badgeId: number | null` and `hasAvatar: boolean`, filled in `searchPlayers` from the latest sighting (the same `Sighting` fields `playerHistory` already uses). No SQL change, no migration; `raw_json` and `avatar_url` stay unselected.
- `app/(pages)/players/page.tsx`: each result card is a flex row like the StatTable `Lead`: `PlayerAvatar` (32 px) before the name block; inside it the name link, the "was" line when an older name matched, and the alliance line with `AllianceBadge` (28 px) before `allianceLabel(...)` and the "Seen" date after. The full-card link overlay (`after:absolute after:inset-0`) is kept, so the whole card is the touch target.
- `docs/DESIGN.md` `avatar`: says the 32 px photo also sits on player-search rows.
- Screenshots: `docs/screenshots/08x-search-360-light.png`, `08x-search-360-dark.png` (search `hat`), `08x-roster-360-light.png` (a roster card on the alliance page, for comparison).

## Decisions
- Assumption (issue wording "same row shape"): small avatar before the name, small badge before the alliance label; no rank and no metrics on search rows.
- No new test: the existing blocked-keys test in `lib/queries/players.test.ts` already runs `findBlockedKeys` over `searchPlayers` output, which now includes the two new fields.

## Deviations
- None.

## Verified
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc clean. Vitest: the first full run had two PGlite `beforeAll` timeouts (`lib/queries/leadership.test.ts`, `lib/queries/players.test.ts`) at load average 35 (other lanes running); `vitest run lib/queries` then passed 17/17, including the blocked-keys test. Final `pnpm check` result is in the PR.
- Browser, throwaway stack: Postgres 18 in the scratchpad (own data directory and port), reached through a local WebSocket bridge and a preload that redirects the Neon driver to it; migrations applied with psql; seeded with `scripts/seed.ts`. `next dev` ran under `env -i` with placeholder variables (no real key, upstream base URLs unroutable, no webhooks, made-up PIN and cron secret in scratchpad files); the owner's `.env.local` was not used and no Neon database was touched. Playwright with system Chrome at 360 px, light and dark: `scrollWidth` = 360; rows show a photo for members with a stored photo and the drawn `NoPhoto` otherwise; WACK (seeded without a badge) shows `NoBadge`.
- The `/img/badge/*` and `/img/avatar/*` responses were stubbed in the browser by Playwright request interception (one real badge PNG from an earlier session's scratchpad for every badge id, a generated gradient square for every photo), so no image was fetched from upstream. The pictures in the screenshots are those stand-ins, not real badges or photos.

## Open issues
- At 360 px a long alliance name pushes "· Seen Oct 31" to its own line, which then starts with the `·` separator (Baibyschatz / Harmonie San. & Reha in the screenshot). It was the same before this change; not touched.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call, no query cost beyond fields already read, and no timing.
Owner must do first: merge this PR into `dev` (no migration). #71 (`session/08y-search-empty-drawing`) is cut from this branch; merge this one first.
Plan change: none.
<adjustments>
- Search rows now request `/img/avatar/[uid]` and `/img/badge/[id]` like roster rows: up to 50 photos per search page, each cached by the route's `Cache-Control`. Nothing for Session 9 to measure beyond what roster pages already cost.
</adjustments>
