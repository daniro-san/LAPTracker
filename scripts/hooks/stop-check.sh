#!/usr/bin/env bash
# Claude Code Stop hook: `pnpm check` must pass before a turn ends (plan §11.4).
# Exit 2 keeps the agent working with the failure in view; Claude Code caps how often a Stop hook can block.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
cat >/dev/null # the hook payload is not needed
[ -d node_modules ] || { echo "stop-check: node_modules missing, run pnpm install" >&2; exit 0; }

# Nothing to check when the tree has no changes and HEAD is already on dev or main: a turn that only read
# code, or worked outside the repo, skips the full gate. Local commits not yet on dev or main still run it.
if [ -z "$(git status --porcelain 2>/dev/null)" ] && git rev-parse -q --verify HEAD >/dev/null 2>&1; then
  for base in origin/dev origin/main; do
    git merge-base --is-ancestor HEAD "$base" 2>/dev/null && exit 0
  done
fi

if ! out=$(pnpm check 2>&1); then
  printf 'pnpm check failed — fix before finishing:\n%s\n' "$(printf '%s\n' "$out" | tail -n 60)" >&2
  exit 2
fi
