#!/usr/bin/env bash
# Claude Code PreToolUse hook (Bash, Monitor, Read, Grep, Glob): a guard against an agent reading a local env
# file BY ACCIDENT. It is not a sandbox: it matches the text of the tool call, so a name built at runtime, a
# script that opens the file, or another spelling gets past it. The protection is that the local env file
# holds no production secret (CONTRIBUTING.md, "Local setup without production secrets"). Exit 2 blocks the
# call and shows the reason to Claude.
#
# Read: Bash's and Monitor's command, Read's file_path, Grep's path and glob, Glob's pattern and path. Blocked,
# case-insensitively:
#   - a word starting with `.env` after a non-word character other than a backslash (so `process.env`,
#     "environment" and the regex `process\.env` pass) that is not exactly `.env.example`;
#   - in a shell command, the word dotenv;
#   - a glob word whose last part starts with `.` and matches an env file name (`.e*`, `.*`, `.[e]nv.local`);
#   - in a shell command, a search that would print env files' lines without naming them: `grep -r` with no
#     `--exclude` covering `.env*`, `rg` with -u, --no-ignore or --hidden, or `find` with -exec or a later
#     xargs, when a path searched is the repo root, a parent of it, `.`, `..` or omitted.
# `pnpm <script>` passes: the `--env-file-if-exists` inside package.json loads the file into the app, not into
# the agent's context. Input it cannot read (no jq or node, or not JSON) is refused.
# No `set -u`: macOS's bash 3.2 treats an empty array as unbound. `set -f`: the words are globs to test,
# never to expand.
set -o pipefail
set -f
payload=$(cat)
root=${CLAUDE_PROJECT_DIR:-$PWD}
NAMES=".env .env.local .env.development .env.development.local .env.production .env.production.local .env.test .env.test.local"
SEP=$'\001'

refuse() {
  echo "env-guard: $1" >&2
  exit 2
}
refuse_name() {
  refuse "$tool names a local env file or dotenv ($1). Only .env.example may be read; local work runs without the real values (CONTRIBUTING.md, \"Local setup without production secrets\")."
}
refuse_search() {
  refuse "a recursive $1 from the repo root or above would print the env files' lines. Use the Grep tool, which respects .gitignore so the env files are never searched, or name the folders (e.g. lib app)."
}

parse_jq='(.tool_name // ""), (.tool_input as $i
  | if .tool_name == "Bash" or .tool_name == "Monitor" then $i.command
    elif .tool_name == "Read" then $i.file_path
    elif .tool_name == "Grep" then $i.path, $i.glob
    elif .tool_name == "Glob" then $i.pattern, $i.path
    else empty end
  | strings)'
parse_node='let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const{tool_name:t="",tool_input:i={}}=JSON.parse(s);const keys={Bash:["command"],Monitor:["command"],Read:["file_path"],Grep:["path","glob"],Glob:["pattern","path"]}[t]??[];process.stdout.write([t,...keys.map(k=>i[k]).filter(v=>typeof v==="string")].join("\n"))}catch{process.exit(1)}})'
tool=hook
[ -n "$payload" ] || refuse "empty hook input; refusing the call."
if command -v jq >/dev/null 2>&1; then
  parsed=$(printf '%s' "$payload" | jq -r "$parse_jq" 2>/dev/null) || refuse "unreadable hook input; refusing the call."
elif command -v node >/dev/null 2>&1; then
  parsed=$(printf '%s' "$payload" | node -e "$parse_node") || refuse "unreadable hook input; refusing the call."
else
  refuse "neither jq nor node is on PATH, so the call cannot be checked; refusing it."
fi
tool=$(head -n 1 <<<"$parsed")
text=$(sed 1d <<<"$parsed")
[ -n "$text" ] || exit 0
shell=0
case "$tool" in Bash | Monitor) shell=1 ;; esac

# The first env file name in the text, lowercased. A grep `--exclude=.env*` is not a read, so it is removed.
env_file_name() {
  sed -E "s/--exclude(-dir)?=(\"[^\"]*\"|'[^']*'|[^[:space:]]*)//g" | tr '[:upper:]' '[:lower:]' |
    grep -oE '(^|[^[:alnum:]_\\])\.env[^[:space:]"'"'"'`;|&<>(),:]*' | sed -E 's/^[^.]//' |
    grep -E '^\.env($|[^[:alnum:]_])' | grep -vxF '.env.example' | head -n 1
}

# A shell command as words, quotes removed, one per line; a line holding only SEP ends a command
# (newline ; & | ( ) outside quotes).
shell_words() {
  awk 'BEGIN { RS = "\001" }
  {
    q = ""; w = ""; has = 0; n = length($0)
    for (i = 1; i <= n; i++) {
      c = substr($0, i, 1)
      if (q != "") { if (c == q) q = ""; else w = w (c == "\n" ? " " : c); continue }
      if (c == "\"" || c == "\047") { q = c; has = 1; continue }
      if (c == "\\" && i < n) { i++; w = w substr($0, i, 1); continue }
      if (c == " " || c == "\t") { if (w != "" || has) print w; w = ""; has = 0; continue }
      if (c == "\n" || c == ";" || c == "&" || c == "|" || c == "(" || c == ")") {
        if (w != "" || has) print w; w = ""; has = 0; print "\001"; continue
      }
      w = w c
    }
    if (w != "" || has) print w
  }'
}

# The first glob word (one per line, lowercased) whose last part starts with `.` and matches an env file name.
wildcard_env_name() {
  local word part name
  while IFS= read -r word; do
    part=${word##*/}
    case "$part" in .*[*?[]*) ;; *) continue ;; esac
    for name in $NAMES; do
      # Unquoted on the right: the word is a glob, matched against each env file name.
      # shellcheck disable=SC2053
      if [[ $name == $part ]]; then
        echo "$word"
        return
      fi
    done
  done
}

dotenv_named() { grep -iqE '(^|[^[:alnum:]_])dotenv(x)?($|[^[:alnum:]_])'; }

# Whether a path a search starts from contains the repo root's top level.
reaches_root() {
  local p=$1
  case "$p" in "~" | "~/"*) p=$HOME${p#\~} ;; '$HOME'*) p=$HOME${p#\$HOME} ;; esac
  case "$p" in *[!./]*) ;; *) return 0 ;; esac # only dots and slashes: . ./ .. ../.. /
  case "$p" in /*) case "$root/" in "${p%/}/"*) return 0 ;; esac ;; esac
  return 1
}
any_reaches_root() {
  local p
  [ $# -gt 0 ] || return 0 # no path: the current directory
  for p in "$@"; do reaches_root "$p" && return 0; done
  return 1
}
covers_env() {
  local glob name
  glob=$(tr '[:upper:]' '[:lower:]' <<<"$1")
  for name in $NAMES; do
    # shellcheck disable=SC2053
    [[ $name == $glob ]] || return 1
  done
}

# grep|egrep|fgrep ARGS: recursive, no --exclude covering the env files, from the root.
grep_reaches() {
  local a rec=0 excluded=0 pattern=0 skip=0 operands=()
  for a in "$@"; do
    if [ $skip = 1 ]; then skip=0 && continue; fi
    case "$a" in
      --recursive | --dereference-recursive | --directories=recurse) rec=1 ;;
      --exclude=*) covers_env "${a#--exclude=}" && excluded=1 ;;
      --regexp=* | --file=*) pattern=1 ;;
      --*) ;;
      -?*)
        case "$a" in -*[rR]*) rec=1 ;; esac
        case "$a" in -*[ef]) pattern=1 skip=1 ;; -*[ABCmdD]) skip=1 ;; esac
        ;;
      *) operands+=("$a") ;;
    esac
  done
  [ $rec = 1 ] && [ $excluded = 0 ] || return 1
  [ $pattern = 1 ] || operands=("${operands[@]:1}")
  any_reaches_root "${operands[@]}"
}

# rg ARGS: ignore files or hidden-file skipping turned off, from the root.
rg_reaches() {
  local a open=0 pattern=0 skip=0 operands=()
  for a in "$@"; do
    if [ $skip = 1 ]; then skip=0 && continue; fi
    case "$a" in
      --no-ignore* | --hidden | --unrestricted) open=1 ;;
      --regexp=* | --file=*) pattern=1 ;;
      --*) ;;
      -?*)
        case "$a" in -*[u.]*) open=1 ;; esac
        case "$a" in -*[ef]) pattern=1 skip=1 ;; -*[gtTABCmMjEr]) skip=1 ;; esac
        ;;
      *) operands+=("$a") ;;
    esac
  done
  [ $open = 1 ] || return 1
  [ $pattern = 1 ] || operands=("${operands[@]:1}")
  any_reaches_root "${operands[@]}"
}

# find ARGS: -exec family, or xargs later in the command, from the root.
find_reaches() {
  local a reads=$has_xargs ended=0 operands=()
  for a in "$@"; do
    case "$a" in
      -exec | -execdir | -ok | -okdir) reads=1 ended=1 ;;
      -H | -L | -P | -E | -X | -s | -x) [ $ended = 1 ] || [ ${#operands[@]} -gt 0 ] || continue ;;
      -* | '!' | '(') ended=1 ;;
      *) [ $ended = 1 ] || operands+=("$a") ;;
    esac
  done
  [ $reads = 1 ] || return 1
  any_reaches_root "${operands[@]}"
}

# The first search command (grep, rg, find) in the words that would read env files from the root.
recursive_search_from_root() {
  local w prev="" cmd segment=()
  has_xargs=0
  grep -qE '^(.*/)?xargs$' <<<"$1" && has_xargs=1
  while IFS= read -r w; do
    if [ "$w" = "$SEP" ]; then
      search_segment "${segment[@]}" && return 0
      segment=()
    else
      segment+=("$w")
    fi
  done <<<"$1"
  search_segment "${segment[@]}"
}
search_segment() {
  local w prev=""
  while [ $# -gt 0 ]; do
    w=${1##*/}
    shift
    if [ "$prev" != git ]; then
      case "$w" in
        grep | egrep | fgrep) grep_reaches "$@" && found=grep && return 0 || return 1 ;;
        rg) rg_reaches "$@" && found=rg && return 0 || return 1 ;;
        find) find_reaches "$@" && found=find && return 0 || return 1 ;;
      esac
    fi
    prev=$w
  done
  return 1
}

if [ $shell = 1 ]; then words=$(shell_words <<<"$text"); else words=$text; fi

found=$(env_file_name <<<"$text") && [ -n "$found" ] && refuse_name "$found"
[ $shell = 1 ] && dotenv_named <<<"$text" && refuse_name dotenv
found=$(tr "[:upper:]" "[:lower:]" <<<"$words" | wildcard_env_name) && [ -n "$found" ] && refuse_name "$found"
[ $shell = 1 ] && recursive_search_from_root "$words" && refuse_search "$found"
exit 0
