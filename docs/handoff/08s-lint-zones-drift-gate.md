# 08s — Lint the dependency rule, gate migration drift (#46)

## Built
- `eslint.config.mjs`: `import-x/no-restricted-paths` with five zones (DECISIONS D34): `lib/compute.ts` and `lib/budget.ts` import nothing from the project; `lib/schedule.ts` nothing except `lib/env.ts`; `lib/**` and `config/**` never import `app/**`; `app/**` never imports `lib/sources/**`; `app/(pages)/**` and `app/_ui/**` never import `lib/repo/**`. Each zone has a message naming the rule.
- `eslint.config.mjs`: `settings["import-x/resolver-next"]` with `createNodeResolver` from eslint-plugin-import-x (extensions `.ts .tsx .js .mjs`, tsconfig `./tsconfig.json` for the `@/` alias). No new dependency.
- `scripts/check-drift.ts`, run as the last step of `pnpm check` (`package.json`): `drizzle-kit generate` must write nothing under `drizzle/`, then `drizzle-kit check`. If generate writes files, the script lists them, deletes the new ones, restores the changed ones (`meta/_journal.json`) and exits 1. CI already runs `pnpm check` (`.github/workflows/ci.yml:29`).
- `docs/DECISIONS.md` D34.

## Decisions
- Without a resolver the zones are inert: with the resolver setting renamed, the 7 forbidden imports below gave 0 errors; with it, 7. That is why the resolver is part of this change.
- `except: ["./node_modules"]` on the "imports nothing" zones, so a pure module may still import a package. The zones restrict the project, not npm.
- The drift step is a `tsx` script, not a shell one-liner: it has to compare the whole `drizzle/` tree before and after and put it back, which a `git status` check cannot do in a tree that already has uncommitted migration work.
- The script restores `drizzle/` instead of leaving the generated migration for the developer: the task asked for a dev tree not left dirty, and `pnpm db:generate` produces the same file on purpose.

## Deviations
- **Assumption 1 — `lib/schedule` zone narrowed.** Plan §11.2 says `lib/schedule` imports nothing from the project; it has always had `import type { Env } from "./env"` (`lib/schedule.ts:4`). The zone allows `lib/env.ts` and nothing else.
- **Assumption 2 — `lib/repo` zone narrowed.** The Session 8 owner adjustment says `app/**` never imports `lib/repo/**`. ARCHITECTURE.md:36 lets `app` use `lib/repo`, and five route handlers do (`app/api/snapshot`, `app/api/manual-event` ×3, `app/img/avatar/[uid]`). The zone covers `app/(pages)/**` and `app/_ui/**` only. No current file violates any zone, so nothing was moved.
- Plan §11.2 says the zone change comes "with a test that a forbidden import fails lint". The task said no committed test; the proof is the scratch run below.

## Verified
- Zones fire. Scratch imports (all reverted): `@/lib/redact` in `lib/compute.ts` and `lib/schedule.ts`, `./compute` in `lib/budget.ts`, `@/app/_ui/format` in `lib/zz-scratch.ts`, `../app/_ui/format` in `config/zz-scratch.ts`, `@/lib/sources/internal` in `app/zz-scratch.ts`, `@/lib/repo/events` in `app/(pages)/zz-scratch.ts`, `app/_ui/zz-scratch.ts` and `app/api/zz-scratch.ts` (the last one is allowed). `pnpm lint`:

```text
app/(pages)/zz-scratch.ts
  1:8  error  Unexpected path "@/lib/repo/events" imported in restricted zone. Pages and UI read through lib/queries; only route handlers use lib/repo  import-x/no-restricted-paths
app/_ui/zz-scratch.ts
  1:8  error  Unexpected path "@/lib/repo/events" imported in restricted zone. Pages and UI read through lib/queries; only route handlers use lib/repo  import-x/no-restricted-paths
app/zz-scratch.ts
  1:8  error  Unexpected path "@/lib/sources/internal" imported in restricted zone. app/ reaches upstream only through lib/run, lib/tick or lib/rehearsal  import-x/no-restricted-paths
config/zz-scratch.ts
  1:8  error  Unexpected path "../app/_ui/format" imported in restricted zone. Nothing in lib/ or config/ imports from app/  import-x/no-restricted-paths
lib/budget.ts
  2:8  error  Unexpected path "./compute" imported in restricted zone. lib/compute and lib/budget are pure: they import nothing from the project  import-x/no-restricted-paths
lib/compute.ts
  2:8  error  Unexpected path "@/lib/redact" imported in restricted zone. lib/compute and lib/budget are pure: they import nothing from the project  import-x/no-restricted-paths
lib/schedule.ts
  5:8  error  Unexpected path "@/lib/redact" imported in restricted zone. lib/schedule is pure: it imports only the Env type from lib/env  import-x/no-restricted-paths
lib/zz-scratch.ts
  1:8  error  Unexpected path "@/app/_ui/format" imported in restricted zone. Nothing in lib/ or config/ imports from app/  import-x/no-restricted-paths

✖ 8 problems (8 errors, 0 warnings)
```

  `import "zod"` in `lib/compute.ts` lints clean (packages allowed). `import-x/order` reported nothing new with the resolver on.
- Drift gate on today's `dev`: no drift. `drizzle-kit generate` → "No schema changes, nothing to migrate", `drizzle-kit check` → "Everything's fine".
- Drift gate fires. Scratch edit (reverted): a second index `scratch_route_idx` on `app_errors.route` in `lib/schema.ts`, no migration. An index, not a column, so the PGlite suite (which builds tables from `drizzle/`) does not fail first and the drift step is what turns `pnpm check` red. `pnpm exec tsx scripts/check-drift.ts`, exit 1:

```text
[✓] Your SQL migration file ➜ drizzle/0009_boring_micromax.sql 🚀
Migration drift: lib/schema.ts has changes with no migration in drizzle/.
drizzle-kit generate wrote drizzle/0009_boring_micromax.sql, drizzle/meta/0009_snapshot.json, drizzle/meta/_journal.json; removed again. Run `pnpm db:generate` and commit the migration.
```

  `git status` afterwards showed only `lib/schema.ts` modified: nothing left in `drizzle/`.
- Full `pnpm check` (Node 26.5.0): prettier, eslint, tsc clean; drift step "nothing to migrate" + "Everything's fine"; vitest 32 of 35 files passed, 3 failed on the 10 s `beforeAll` timeout (`openTestDb`) while the machine's load average was 37–49 (other lanes). `vitest run lib/queries/upstream-status.test.ts` alone took 23 s wall at 24 % CPU. The same suite with `--hookTimeout=120000`: 35 files passed, 151 tests passed, 1 skipped. None of these files touch lint config or the drift script.

## Open issues
- Under heavy machine load (load average 49 with other lanes running), PGlite test files hit the 10 s / 30 s `beforeAll` timeout on the clean tree too (`lib/queries/leadership`, `players`, `upstream-status`, `app/api/manual-event`, `app/api/rehearsal`). Pre-existing and load-dependent (08r saw the same); not touched.
- A schema change that adds a column fails the PGlite tests before the drift step runs, so the drift message is seen only for changes the tests cannot notice (indexes, defaults, unused columns). Both paths are red.
- `drizzle-kit generate` may prompt (rename or create?) when a column is dropped and another added in one change. With no TTY in CI that prompt cannot be answered; the step then fails or hangs until the 15 min job timeout. Not seen; noted.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call, no timing and no runtime code.
Owner must do first: merge this PR into `dev`. Other lanes rebase onto it; a lane that adds a migration must commit it, or its `pnpm check` goes red.
Plan changes needed: none. (Plan §11.2 still says `lib/schedule` imports nothing and `app/` never imports `lib/repo`; D34 records the narrower zones. Owner's call whether to edit §11.2.)

<adjustments>
- `pnpm check` now ends with the migration drift gate (`scripts/check-drift.ts`). If Session 9 changes `lib/schema.ts`, run `pnpm db:generate` and commit the migration in the same PR.
- The dependency rule is linted (D34): a page or `app/_ui` file that needs data adds a function to `lib/queries`, not an import of `lib/repo`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/104
