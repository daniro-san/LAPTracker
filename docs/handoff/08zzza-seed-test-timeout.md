# 08zzza — Seed test timeout

The Stop hook's `pnpm check` failed in the main checkout on 2026-11-11 while four agent sessions ran in parallel: the two tests of `scripts/seed.test.ts` timed out at the global 10 s.

## Built

- `scripts/seed.test.ts`: the `describe` block has `{ timeout: 60_000 }` and a comment with the measurement. Nothing else changed: no assertion, no test body, no config.

## Decisions

- A timeout on this block, not a higher global `testTimeout`. The global 10 s was sized in #124 on the slowest body of that day (4.8 s, a route test). These two bodies each run a whole seed on PGlite, which #213 added later. Every other test keeps the 10 s limit.
- 60 s is 4x the slowest run seen (15.0 s). #124 measured load averages up to 67; this failure happened at 36 to 44.

## Deviations

- None from a plan: this change answers the Stop hook, not a playbook session.

## Verified

- The failure, from the Stop hook (main checkout, 10-core Mac, load average 36 to 44): `seed --with-states > adds an event a week ahead with no snapshots and an event whose After is running 12004ms` and `> is off by default 14968ms`, both `Error: Test timed out in 10000ms`; `Tests 2 failed | 244 passed | 1 skipped (247)`.
- The same file run alone at that load, before the change: `Tests 2 passed (2)`, `Duration 18.03s`. So the bodies pass; only the time limit failed.
- The block's timeout is honoured by vitest 5.1.0: a temporary copy of the file with `{ timeout: 1 }` gave `Error: Test timed out in 1ms.` twice, `Tests 2 failed (2)`. The copy was deleted.
- After the change: `pnpm exec vitest run scripts/seed.test.ts` gives `Tests 2 passed (2)`, `Duration 4.59s` at load average 24.
- `pnpm check` on `dev` at 54d07a6 plus this change, at load average 22 to 36: `Test Files 55 passed | 1 skipped (56)`, `Tests 253 passed | 1 skipped (254)`, drift `Everything's fine`, `i18n: 17 languages up to date with English`, exit 0.

## Open issues

- The Stop hook runs the whole `pnpm check` in the main checkout while agent sessions load the machine. Any other test body that grows past 10 s under load will fail it the same way.

## Next

Session: none queued.
Model / effort: no signal; one test file, 3 added lines.
Owner must do first: nothing.
Plan changes needed: none.

<adjustments>
- A test whose body runs `seed()` needs its own timeout: the global 10 s does not cover a whole seed under load.
</adjustments>
