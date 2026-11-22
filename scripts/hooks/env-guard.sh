#!/usr/bin/env bash
# Claude Code PreToolUse hook (Bash, Read, Grep, Glob): an agent never reads a local env file. `.env.example`
# is the only one it may open; `.env`, `.env.local`, `.env.production` and the rest hold secrets, and local
# work runs without them (CONTRIBUTING.md, "Local setup without production secrets"). Exit 2 blocks the call
# and shows the reason to Claude.
#
# What it reads: the Bash command text, Read's file_path, Grep's path and glob, Glob's pattern and path. Any
# word that starts with `.env` (after a non-word character, so `process.env` and "environment" pass) and is
# not exactly `.env.example` blocks the call, wherever it stands, quoted or not. A Bash command that names
# dotenv is blocked too. A Glob pattern or Grep glob whose last part starts with `.` and matches an env file
# name (`.env*`, `.e*`, `.*`) is blocked as well. `pnpm <script>` passes: the `--env-file-if-exists=.env.local`
# inside package.json loads the file into the app, not into the agent's context.
#
# Like pr-base-guard.sh it matches text, so another spelling gets past it; the `.env` deny rules in
# .claude/settings.json are the other layer.
set -uo pipefail
payload=$(cat)

if command -v jq >/dev/null 2>&1; then
  parsed=$(printf '%s' "$payload" | jq -r '
    (.tool_name // ""),
    (.tool_input as $i
      | if .tool_name == "Bash" then $i.command
        elif .tool_name == "Read" then $i.file_path
        elif .tool_name == "Grep" then $i.path, $i.glob
        elif .tool_name == "Glob" then $i.pattern, $i.path
        else empty end
      | strings)' 2>/dev/null)
else
  parsed=$(printf '%s' "$payload" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const{tool_name:t="",tool_input:i={}}=JSON.parse(s);const keys={Bash:["command"],Read:["file_path"],Grep:["path","glob"],Glob:["pattern","path"]}[t]??[];process.stdout.write([t,...keys.map(k=>i[k]).filter(v=>typeof v==="string")].join("\n"))}catch{}})')
fi
tool=$(head -n 1 <<<"$parsed")
text=$(sed 1d <<<"$parsed")
[ -n "$text" ] || exit 0

found=$(printf '%s\n' "$text" |
  grep -oE "(^|[^[:alnum:]_])\.env[^[:space:]\"'\`;|&<>(),:]*" |
  sed -E 's/^[^.]//' |
  grep -E '^\.env($|[^[:alnum:]_])' |
  grep -vxF '.env.example' |
  head -n 1)

if [ -z "$found" ] && [ "$tool" = "Bash" ] &&
  printf '%s\n' "$text" | grep -Eq '(^|[^[:alnum:]_])dotenv(x)?($|[^[:alnum:]_])'; then
  found="dotenv"
fi

if [ -z "$found" ] && { [ "$tool" = "Glob" ] || [ "$tool" = "Grep" ]; }; then
  while IFS= read -r field; do
    part=${field##*/}
    case "$part" in .*) ;; *) continue ;; esac
    for name in .env .env.local .env.development .env.development.local .env.production \
      .env.production.local .env.test .env.test.local; do
      # Unquoted on the right: the field is a glob, matched against each env file name.
      # shellcheck disable=SC2053
      if [[ $name == $part ]]; then found=$part; break 2; fi
    done
  done <<<"$text"
fi

[ -z "$found" ] && exit 0
echo "env-guard: $tool names a local env file or dotenv ($found). Only .env.example may be read; local work runs without the real values (CONTRIBUTING.md, \"Local setup without production secrets\")." >&2
exit 2
