#!/usr/bin/env bash
# Claude Code Stop hook: `pnpm check` must pass before a turn ends (plan §11.4).
# Exit 2 keeps the agent working with the failure in view; Claude Code caps how often a Stop hook can block.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
cat >/dev/null # the hook payload is not needed
[ -d node_modules ] || { echo "stop-check: node_modules missing, run pnpm install" >&2; exit 0; }

if ! out=$(pnpm check 2>&1); then
  printf 'pnpm check failed — fix before finishing:\n%s\n' "$(printf '%s\n' "$out" | tail -n 60)" >&2
  exit 2
fi
