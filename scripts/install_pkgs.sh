#!/usr/bin/env bash
# Claude Code SessionStart hook (plan §11.4): make Node 26 visible and install deps only when the lockfile changed.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Cloud sessions: scripts/cloud-setup.sh installed Node 26 into /opt/node26. Put it first on PATH for
# every later Bash call, in case the environment's shell doesn't read ~/.bashrc.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -x /opt/node26/bin/node ]; then
  export PATH="/opt/node26/bin:$PATH"
  [ -n "${CLAUDE_ENV_FILE:-}" ] && echo 'export PATH="/opt/node26/bin:$PATH"' >>"$CLAUDE_ENV_FILE"
fi

case "$(node -v)" in v26.*) ;; *) echo "install_pkgs: node is $(node -v), expected 26.x (run scripts/cloud-setup.sh)" >&2 ;; esac

stamp=node_modules/.lockfile-sha256
want=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$want" ]; then
  exit 0
fi
pnpm install --frozen-lockfile
echo "$want" >"$stamp"
