#!/usr/bin/env bash
# Claude Code PreToolUse hook (Bash): a `gh pr create` must name `dev` as its base. Without `--base`, gh
# would open the PR against the default branch, `main`, which changes only through the release-prepare PR
# (CLAUDE.md, owner 2026-11-21). It reads the command text, so it is one layer, not the guard: GitHub's
# rulesets are (CONTRIBUTING.md, "Enforcement layers"). Exit 2 blocks the call and shows the reason to Claude.
#
# Only a real invocation counts: the command, or a part of it after `&&`, `||`, `;`, `|` or a newline outside
# quotes, that starts with `gh pr create` (after any `NAME=value` prefixes). A commit message, a grep or a
# heredoc line that merely mentions it is not blocked, and the base is checked in that invocation only.
set -uo pipefail
payload=$(cat)
case "$payload" in *"gh pr create"*) ;; *) exit 0 ;; esac

if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  cmd=$(printf '%s' "$payload" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command??"")}catch{}})')
fi
[ -n "$cmd" ] || exit 0

# Split on shell separators outside quotes, one invocation per output line; separators inside quotes
# (a commit message) become spaces, so they never start a new invocation.
segments=$(printf '%s' "$cmd" | awk '
  BEGIN { RS = "\001"; q = "" }
  {
    out = ""
    for (i = 1; i <= length($0); i++) {
      c = substr($0, i, 1)
      if (q != "") { if (c == q) q = ""; else if (c == "\n" || c == ";" || c == "&" || c == "|") c = " "; out = out c; continue }
      if (c == "\"" || c == "\047") { q = c; out = out c; continue }
      if (c == "\n" || c == ";" || c == "&" || c == "|") { out = out "\n"; continue }
      out = out c
    }
    printf "%s\n", out
  }')

blocked=0
while IFS= read -r seg; do
  seg=$(printf '%s' "$seg" | sed -E -e 's/^[[:space:]]+//' \
    -e "s/^([A-Za-z_][A-Za-z0-9_]*=(\\\$\\([^)]*\\)|\"[^\"]*\"|'[^']*'|[^[:space:]]*)[[:space:]]+)*//")
  case "$seg" in "gh pr create" | "gh pr create "*) ;; *) continue ;; esac
  printf '%s' "$seg" | grep -Eq -- "(--base[= ]+|-B *)['\"]?dev(['\"[:space:]]|\$)" || blocked=1
done <<<"$segments"

[ "$blocked" -eq 0 ] && exit 0
echo "pr-base-guard: gh pr create needs --base dev. PRs go into dev; main changes only through the release-prepare PR." >&2
exit 2
