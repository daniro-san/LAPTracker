# 08r — Alliance leadership

## Built
- `lib/schema.ts`, `drizzle/0008_silly_peter_quill.sql`: nullable `member_snapshots.rank_code` (integer) and `rank_label` (text). No backfill.
- `lib/sources/shared.ts`, `lib/sources/types.ts`, `lib/repo/index.ts`: the /v1 member `rank_code` and `rank_label` are read as optional fields and stored with the roster row; null when the body or the internal source sends none.
- `lib/queries/leadership.ts`: `rolesOf(db, allianceSnapshotIds)` selects uid, `rank_code`, `rank_label` for R4/R5 rows only and returns `Role` (`leader`, or `officer` with the title after `R4 · `). `roleOf` is the pure rule (untitled R4 and R1–R3 give null).
- `lib/queries/alliances.ts`: `getAllianceDetail` also returns `rolesBefore` / `rolesAfter`. `lib/queries/players.ts`: `PlayerHistory.current.role`, from the latest sighting's alliance snapshot through the same `rolesOf`.
- `app/_ui/member-views.ts`: `MemberView.role`, `withRoles` (a member takes the role of the roster they are shown from: After, or Before for a leaver or a Before-only event), `leadership` (leader first, then officers by Might).
- `app/_ui/Leadership.tsx` and the alliance page: Leadership section between the summary band and the member list; cards in one column below 640 px, two above; each card is one link to the player page.
- `app/_ui/MembersExplorer.tsx`, `app/_ui/StatTable.tsx`: crown or star after the name, a pale row tint (`StatRow.tint`), role word as `sr-only`. Order, ranks, counts and `n / capacity` are untouched.
- Player page: role line (mark + `Leader` or the title) under the alliance link.
- `lib/brand/components/RoleMark.tsx` with the two drawings (`icon_crown`, `icon_officer` in `docs/brand/drawing/examples/ornaments.py`, registered in `build.py`); `/brand` Drawing and Components sections (`lib/copy-brand.ts`); `docs/DESIGN.md` entries `leadership` and `role-mark`; copy in `lib/copy.ts`.
- Tests: `lib/queries/leadership.test.ts` (roles and titles from the data, untitled R4 left out, no entry without rank data and nothing but role in the result, player role), three in `app/_ui/member-views.test.ts` (leader first and a leaver's last role and Left status, order/ranks/count unchanged and a demoted officer unmarked, empty without roles), one in `lib/sources/v1.test.ts` (rank fields mapped, null when absent).

## Decisions
- **Columns, not `raw_json`.** The task allowed either. Stored `raw_json` has no member list: of 138 `alliance_snapshots` rows, 132 have `raw_json` and none has a `members` array, so a `raw_json` query would show nothing on any existing event. Columns it is.
- Role comes from `rank_code` (105 / 104), not from `leader_id`. `leader_id` / `leader_name` are not stored and the section does not need them.
- Colours: crown and leader tint in plum (`bg-plum/10`), officer star and tint in sage (`bg-sage/10`, the neutral tone). Yarn and seal were left out because they mean gain and loss.
- Player page: R1–R4 without a title show nothing (the lighter option).
- A leaver in the section carries the seal `− Left` beside the role; the task only required it in the list. One line of copy, kept so a left leader does not read as current.
- The R5 is marked by `rank_code`, so an alliance with two 105 rows would list both. Not guarded: the game has one.

## Deviations
- "Across events" rows on the player page carry no role (not cheap: it needs the rank per sighting, and the task allowed leaving it).
- Branch is `session/08r-alliance-leadership` and the handoff `08r-…`, following the 08x series, since the task gave `NN`.

## Verified
- `pnpm check` (Node 26.13.0): prettier, eslint, tsc clean; 149 passed, 1 skipped. (Under heavy machine load, several PGlite files hit the 10 s `beforeAll` timeout; the same files passed on re-run.)
- Migration 0008 applied by the PGlite test helper (all DB tests run on it).
- Browser (in-app browser, `next dev`) at 360 px, light only, on a temporary scratch page with synthetic members (deleted before commit): the four Leadership cards (leader with a long name wrapping, Diplomat, Recruiter, a leaver with `− Left` and last numbers) stack without overflow; the list rows show the crown or star after the name with the tint, and the unmarked row is unchanged.
- Not seen: the real alliance page and player page with real rank data. The Neon database the local `.env.local` points at has no `rank_code` column yet and I did not migrate it; the old rows have no rank data anyway. Also not seen: 1280 px, dark mode, the player page role line, the `/brand` page. Read from code only.

## Open issues
- **Nothing shows until a new snapshot is stored after migration 0008.** Old events and old rows have no rank, so their pages have no section and no marks (task item 3). The owner decides whether to re-snapshot anything; no backfill was written.
- Crown and star were checked on a render sheet at 16/32/48 px on paper and dark, not by the owner. They are filled cuts, not tapered strokes, because they show at 16 px.
- The internal source (live-roster fallback) carries no rank in our schema, so an alliance read through it has no leadership.
- `docs/DESIGN.md` has two identical `member-filter` bullets (pre-existing); not touched.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call and no timing.
Owner must do first: merge this PR into `dev`; the build applies migration 0008 (`db:migrate`). Merge #88 as already noted.
Plan changes needed: none.

<adjustments>
- Session 9: after the first snapshot stored with migration 0008, check on `/events/<id>/alliances/<unionId>` and `/players/<uid>` that the Leadership section and marks appear (one R5, titled R4s). A rehearsal is a test event and not public, so use the first real or a public manual round.
- Session 9 step 3: also compare the number of R5 rows (expect 1) and titled R4 rows per alliance against the in-game alliance screen; the fixtures show up to 4 titled R4s of 5–8 R4s.
</adjustments>
