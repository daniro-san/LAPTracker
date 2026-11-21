#!/usr/bin/env bash
# Claude Code PreToolUse hook (Bash): a `gh pr create` must name `dev` as its base. Without `--base`, gh
# would open the PR against the default branch, `main`, which changes only through the release-prepare PR
# (CLAUDE.md, owner 2026-11-21). It reads the command text, so it is one layer, not the guard: GitHub's
# rulesets are (CONTRIBUTING.md, "Enforcement layers"). Exit 2 blocks the call and shows the reason to Claude.
set -uo pipefail
payload=$(cat)
printf '%s' "$payload" | grep -q 'gh pr create' || exit 0
if printf '%s' "$payload" | grep -Eq -- "(--base[= ]+|-B *)['\"]?dev(['\" ;&|\\\\]|\$)"; then
  exit 0
fi
echo "pr-base-guard: gh pr create needs --base dev. PRs go into dev; main changes only through the release-prepare PR." >&2
exit 2
