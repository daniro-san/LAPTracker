#!/usr/bin/env bash
# Probe the documented API (/v1): does a read refresh the roster? What shape does it return?
#
#   1. Paste your key in LAT_API_KEY below (or export LAT_API_KEY, or keep it in .env.local — any of the three works).
#   2. From the repo root:   bash ~/probe-v1.sh --twice
#      → round 1, waits 11 minutes, round 2, then compares OGs' cached/updated_at across rounds.
#      Don't open OGs or URSA on the site while it waits.
#   Single round:            bash ~/probe-v1.sh [union_id ...]     default ids: 67111155 (OGs) 67110320 (URSA)
#
# Cost per round: 2 quota calls + 1 per alliance. Output: fixtures/v1-<utc-timestamp>/ (responses only, no key) + stdout.
# If you pasted the key here, keep this file OUT of the repo. The key is never printed.
set -euo pipefail

LAT_API_KEY=""

if [ "$LAT_API_KEY" = "PASTE_YOUR_KEY_HERE" ] && [ -f .env.local ]; then
  LAT_API_KEY=$(grep -E '^LAT_API_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d "\"' " | tr -d '[:space:]')
fi
case "$LAT_API_KEY" in ""|PASTE_YOUR_KEY_HERE) echo "No key: paste it in LAT_API_KEY at the top, export it, or put it in .env.local"; exit 1;; esac

UA="laptracker-probe/0.1 (+https://github.com/daniro-san/LAPTracker)"
API="https://api.lastasylumtracker.com/v1"
TWICE=0; IDS=()
for a in "$@"; do [ "$a" = "--twice" ] && TWICE=1 || IDS+=("$a"); done
[ ${#IDS[@]} -gt 0 ] || IDS=(67111155 67110320)

call() { curl -sS -A "$UA" -H "Authorization: Bearer $LAT_API_KEY" -H 'Accept: application/json' --max-time 60 "$1" -o "$2" -w '%{http_code} %{time_total}s'; }

summarize() { python3 - "$1" <<'EOF'
import json,sys,datetime as dt
d=json.load(open(sys.argv[1]))
if isinstance(d,dict) and 'ok' in d and not d.get('ok'):
    print('   ERROR body:', json.dumps(d)[:300]); sys.exit(0)
a=d.get('alliance',d) if isinstance(d,dict) else d
now=dt.datetime.now(dt.timezone.utc).timestamp()
ua=a.get('updated_at') or d.get('updated_at')
f=lambda t: dt.datetime.fromtimestamp(t,dt.timezone.utc).strftime('%Y-%m-%d %H:%M:%S') if t else None
print('   top-level keys :', [k for k in d if k!='alliance'])
print('   alliance keys  :', list(a.keys())[:25])
print('   name / abbr    :', a.get('name'), '/', a.get('abbr') or a.get('abbreviation'))
print('   cached         :', d.get('cached', a.get('cached')))
print('   updated_at     :', f(ua), f'({(now-ua)/60:.1f} min ago)' if ua else '(ABSENT)')
print('   alliance power :', a.get('power'))
ms=a.get('members') or []
print('   members        :', len(ms), '/ member_count', a.get('member_count'))
if ms:
    m=ms[0]; print('   member keys    :', list(m.keys()))
    print('   has kills?     :', 'kills' in m, '| sum power', sum((x.get('power') or 0) for x in ms), '| sum kills', sum((x.get('kills') or 0) for x in ms))
q=d.get('quota') if isinstance(d,dict) else None
if q: print('   quota remaining:', q.get('remaining'))
EOF
}

quota() { python3 -c "
import json,sys
d=json.load(open(sys.argv[1])); q=d.get('quota',d)
print('   quota', {k:q.get(k) for k in ('limit','used','remaining','resets')})" "$1"; }

round() {
  OUT="fixtures/v1-$(date -u +%Y%m%dT%H%M%SZ)"; mkdir -p "$OUT"
  echo "== $(date -u +%H:%M:%S)Z  GET /v1/quota             $(call "$API/quota" "$OUT/quota-before.json")"; quota "$OUT/quota-before.json"
  for id in "${IDS[@]}"; do
    echo "== $(date -u +%H:%M:%S)Z  GET /v1/alliances/$id   $(call "$API/alliances/$id" "$OUT/alliance-$id.json")"
    summarize "$OUT/alliance-$id.json"
  done
  echo "== $(date -u +%H:%M:%S)Z  GET /v1/quota             $(call "$API/quota" "$OUT/quota-after.json")"; quota "$OUT/quota-after.json"
  echo "   saved to $OUT"
  LAST_OUT="$OUT"
}

echo "######## round 1"
round; R1="$LAST_OUT"
[ "$TWICE" = 1 ] || exit 0

echo; echo "######## waiting 11 minutes (cache window is 10) — don't open these alliances on the site"
for ((m=11; m>0; m--)); do printf '   %2d min left\r' "$m"; sleep 60; done; echo
echo "######## round 2"
round; R2="$LAST_OUT"

echo; echo "######## comparison"
python3 - "$R1" "$R2" "${IDS[@]}" <<'EOF'
import json,sys,datetime as dt
r1,r2,*ids=sys.argv[1:]
f=lambda t: dt.datetime.fromtimestamp(t,dt.timezone.utc).strftime('%H:%M:%S') if t else None
for id in ids:
    try:
        a=json.load(open(f"{r1}/alliance-{id}.json")); b=json.load(open(f"{r2}/alliance-{id}.json"))
    except Exception as e:
        print(id, 'could not compare:', e); continue
    A=a.get('alliance',a); B=b.get('alliance',b)
    ua,ub=A.get('updated_at'),B.get('updated_at')
    moved = (ua is not None and ub is not None and ub>ua)
    print(f"{id}: cached {a.get('cached')} -> {b.get('cached')} | updated_at {f(ua)} -> {f(ub)} | "
          + ("REFRESHED ON READ ✅" if moved else "NOT REFRESHED ❌")
          + f" | power {A.get('power')} -> {B.get('power')}")
print()
print("Verdict for §3.7: case 1 holds if every alliance shows cached False and a newer updated_at in round 2.")
EOF
