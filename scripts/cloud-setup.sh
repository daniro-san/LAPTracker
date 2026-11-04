#!/usr/bin/env bash
# Cloud environment setup script (claude.ai/code → environment → Setup script). See docs/PREREQUISITES.md §3b.
# Installs the newest Node 26.x into /opt/node26, puts it first on PATH, installs pnpm 12 and gitleaks.
# Idempotent: re-running upgrades Node to the newest 26.x patch.
set -euo pipefail

NODE_MAJOR=26
PREFIX=/opt/node26
GITLEAKS_VERSION=v8.30.1

version=$(curl -fsSL https://nodejs.org/dist/index.json |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s).find(r=>r.version.startsWith("v'"$NODE_MAJOR"'."));if(!v)process.exit(1);console.log(v.version)})')
echo "cloud-setup: newest Node $NODE_MAJOR is $version"

case "$(uname -m)" in x86_64) arch=x64 ;; aarch64 | arm64) arch=arm64 ;; *) echo "unsupported arch" >&2; exit 1 ;; esac
tarball="node-$version-linux-$arch.tar.xz"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "https://nodejs.org/dist/$version/$tarball" -o "$tmp/$tarball"
curl -fsSL "https://nodejs.org/dist/$version/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
(cd "$tmp" && grep " $tarball\$" SHASUMS256.txt | sha256sum -c -)
rm -rf "$PREFIX" && mkdir -p "$PREFIX"
tar -xJf "$tmp/$tarball" -C "$PREFIX" --strip-components=1

line="export PATH=\"$PREFIX/bin:\$PATH\""
grep -qxF "$line" ~/.bashrc 2>/dev/null || echo "$line" >>~/.bashrc
export PATH="$PREFIX/bin:$PATH"

npm install -g pnpm@12 >/dev/null
# gitleaks: GitHub release downloads are not on the default allowlist; the Go module proxy is.
if command -v go >/dev/null; then
  GOBIN="$PREFIX/bin" go install "github.com/zricethezav/gitleaks/v8@$GITLEAKS_VERSION"
else
  echo "cloud-setup: go not found, gitleaks not installed (the pre-commit secrets scan will fail)" >&2
fi

echo "cloud-setup: node $(node -v), pnpm $(pnpm -v), gitleaks $(command -v gitleaks >/dev/null && echo "$GITLEAKS_VERSION" || echo missing)"
