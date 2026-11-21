#!/usr/bin/env bash
# Claude Code Stop hook: `pnpm check` must pass before a turn ends (plan §11.4).
# Exit 2 keeps the agent working with the failure in view. After two fix rounds in a row still fail
# (`stop_hook_active` true on each), the turn may end, so the agent reports instead of looping (CLAUDE.md).
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
payload=$(cat)
sid=$(printf '%s' "$payload" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | tr -cd 'A-Za-z0-9-')
rounds_file="${TMPDIR:-/tmp}/laptracker-stop-check-${sid:-unknown}"

pass() {
  rm -f "$rounds_file"
  exit 0
}

block() {
  local n=0
  if printf '%s' "$payload" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    n=$(cat "$rounds_file" 2>/dev/null || echo 0)
  fi
  n=$((n + 1))
  if [ "$n" -gt 2 ]; then
    rm -f "$rounds_file"
    printf 'stop-check: still failing after two fix rounds; stop and report it.\n%s\n' "$1" >&2
    exit 0
  fi
  echo "$n" >"$rounds_file"
  printf '%s\n' "$1" >&2
  exit 2
}

# Nothing to check when the tree has no changes and HEAD is already on dev or main: a turn that only read
# code, or worked outside the repo, skips the full gate. Local commits not yet on dev or main still run it.
if [ -z "$(git status --porcelain 2>/dev/null)" ] && git rev-parse -q --verify HEAD >/dev/null 2>&1; then
  for base in origin/dev origin/main; do
    git merge-base --is-ancestor HEAD "$base" 2>/dev/null && pass
  done
fi

# Changes to check but no dependencies: block instead of passing without a check.
[ -d node_modules ] ||
  block "stop-check: node_modules is missing, so pnpm check cannot run. Run pnpm install --frozen-lockfile, then finish."

if ! out=$(pnpm check 2>&1); then
  block "$(printf 'pnpm check failed — fix before finishing:\n%s' "$(printf '%s\n' "$out" | tail -n 60)")"
fi
pass
