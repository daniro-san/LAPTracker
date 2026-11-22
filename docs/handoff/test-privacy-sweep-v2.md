# test/privacy-sweep-v2

Part of #592 (test audit 2, batch 5: privacy sweep v2, audit gap 1).

## Built
- `e2e/fixtures/seed-people.ts`: `SENTINELS` now has `active` and `tech` per alliance (Lantern Keep 647 and 3917, Moss Hollow 629 and 4283). `e2e/fixtures/seed.ts` writes them into raw_json; `DAILY` is Lantern Keep's figures, so the specs that read `DAILY` keep working. `daily_honor` stays at 1000 (COINS_MAX).
- `e2e/fixtures/test.ts` (the guard every e2e test runs behind, and `leaksIn`):
  - value checks for `active` and `daily_tech`, and key checks for `daily_tech`/`dailyTech` and `daily_honor`/`dailyHonor`;
  - per-surface rules. On the desk and in its answers, the own alliance's joined_at and daily fields are allowed (CLAUDE.md). The member card answer also allows x, y, online and last_online_at. `/w/<slug>/board/me` allows the own alliance's daily fields only (D142). Public pages and `/w/<slug>/board` allow none. The D76 public-aggregate exception does not apply, because the seed has no OWN_ALLIANCE_ID rows;
  - `coordinate()` is now `figure()`, which matches any figure with optional thousands separators.
- `e2e/isolation.spec.ts`:
  - `/w/lnk/settings` added to the desk sweep, as Lantern Keep's officer;
  - new sweep "the public JSON answers": `/api/events`, `/api/events/2`, and `/api/alliances/<id>/history?at=<newest daily read>` for both alliances;
  - new test "the export ZIP": an officer POSTs `/api/w/lnk/data-export`, the test unzips the answer and scans every file with `leaksIn` under the export path. It also checks that no CSV header names x, y, online, last_online_at or avatar_url, and that the files hold real data (the README names the alliance, people.csv the officer, former-members.csv the leaver);
  - positive controls: the real Me page carries `a.active`, which the scan flags when the page is treated as a public page. A new synthetic test proves each daily and export rule per surface.
- `lib/zip.test-helpers.ts`: `unzip()`, moved out of `app/(private)/api/w/[slug]/data-export/route.test.ts` so the route test and the e2e test share it. No new dependency: Node's zlib, as `lib/zip.ts` uses. A CRC mismatch now throws instead of failing a Vitest `expect`.

## Decisions
- Public JSON routes scanned: the GET routes under `app/api` that need no secret. Not scanned:
  - `/api/quota` and `/api/quota/check`: each spends an upstream call;
  - `/api/alliances/[id]/details`: a POST that reads upstream;
  - the PIN or cron POST routes;
  - `/api/admin/*`: owner only;
  - `/ingest`: the PostHog proxy;
  - `/img/*`: images, not JSON.
- `daily_honor` has no value sentinel. Its cap of 1000 is what the seed needs, so that "N of N reached 1,000" holds, and the copy writes "1,000" itself. The scan checks its key instead. `active` has no key check: `"active":` is a common UI prop name.
- Export rule: D71 removes only x, y, online and last_online_at from exports, and D22 removes avatar_url. So the scan allows joined_at and the daily fields in the ZIP. It does this by scanning the files under the export's own path, which the desk rule covers.

## Deviations
- On `/board/me`, the scan cannot tell the member's own daily figures from another Lantern Keep member's, because every member of an alliance has the same seeded figures. Moss Hollow's figures are still flagged there. Telling them apart needs per-member figures (audit PR 6, seed v2).

## Verified
- Mutation proofs, each a temporary leak. All three were in one build and the isolation spec ran once; then they were reverted with `git checkout`:
  - export: an extra `mutation-map.csv` with each member's raw_json x and y (`lib/private/workspace-export.ts`). "the export ZIP" fails with `a.x`, `a.y`.
  - public JSON: `/api/alliances/[id]/history` adds each member's raw_json `daily_tech` as `donations`. "the public JSON answers" fails with `a.daily_tech`.
  - settings: the page prints the first member's raw `last_online_at`. "a's desk" fails with `a.last_online_at`.
- Full e2e suite on a clean build, with my own Postgres 18 (127.0.0.1:54391, auth `password` as in e2e.yml) and ports 3591/54591/3592: 68 passed, 4 skipped (phone-only tests on wide, by design).
- `pnpm vitest related --run` on the changed files: 2 files, 7 tests pass.
- `pnpm check`: see the PR's test plan.

## Open issues
- No leak found: the export ZIP, `/w/lnk/settings` and the public JSON answers carry no sentinel and no blocked key.

## Next
- Audit PR 6 (seed v2): give members different daily figures, so the `/board/me` check can flag another member's figures. Then add the linked uid to the `/board/me` rule in `allowedAt`.

What was missing from the task prompt? The prompt did not say that the e2e Postgres must use `password` auth, which the db:local bridge needs (from .github/workflows/e2e.yml). It also did not say that `daily_honor` cannot be a value sentinel, because the seed keeps it at the 1,000 cap.

PR: (added by the orchestrator)
