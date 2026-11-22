#!/usr/bin/env bash
# The tests `pnpm check:fast` runs (the Stop hook; CI runs the full `vitest run`):
# 1. the tests related to files changed since origin/dev (vitest's import graph, plus forceRerunTriggers);
# 2. every test that reads files from disk (readFileSync/readdirSync). The guard tests scan source trees without
#    importing them, so the import graph never links a scanned file to its guard. Found by grep, so a new
#    guard is never missed.
# Without origin/dev (a fresh clone, no fetch) it runs the full suite.
set -euo pipefail
if ! git rev-parse -q --verify origin/dev >/dev/null; then
  echo "test-changed: no origin/dev, running every test"
  exec vitest run
fi
vitest run --changed origin/dev --passWithNoTests
git grep -l -z -E 'readFileSync|readdirSync' -- '*.test.ts' | xargs -0 vitest run
