---
name: record-fixture
description: Record a new upstream API response into fixtures/ (spends LAP API quota). Use only when a session explicitly needs a new or refreshed fixture, e.g. "record a fixture for alliance 67110584" or "re-record the ranks board". Never use from a test, never on Friday or Saturday.
---

# Record a fixture

`fixtures/` is the contract with the upstream API (docs/IMPLEMENTATION_PLAN.md §11.3). This is the one procedure in the repo with a side effect: every `/v1` call spends 1 of 1,000 daily requests, including `/v1/quota`. Saturday's snapshots need ~55. Follow every step; skip none.

## 1. Decide and state the cost before calling anything

1. Name the exact endpoints and ids, and why an existing fixture can't serve. List existing ones: `ls fixtures/`.
2. Cost = 1 (quota before) + 1 per `/v1` resource + 1 (quota after). The internal ranks board (`GET https://lastasylumtracker.com/api/servers/catalog/325/ranks`) costs 0 quota.
3. Check the day in UTC **and** server time (UTC−2): `date -u`. If it is Friday or Saturday in either, stop and tell the owner. Those days belong to the event.
4. If the cost is above 5 calls, or the session prompt didn't explicitly allow quota use, ask the owner with the cost and wait for a yes.

## 2. Credentials, never printed

- **Local:** read `LAP_API_KEY` from `.env.local` into a shell variable without echoing it:
  `LAP_API_KEY=$(grep -E '^LAP_API_KEY=' .env.local | cut -d= -f2- | tr -d "\"' \r")`
- **Cloud session:** the environment's network secret injects `Authorization` for `api.lastasylumtracker.com`. Send no Authorization header yourself.
- Never `echo`, `set -x`, `env` or paste the key. Never put it in a file under the repo.

## 3. Call and save the raw body

```bash
UA="laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)"
API="https://api.lastasylumtracker.com/v1"
DIR="fixtures/<kind>-$(date -u +%Y%m%dT%H%M%SZ)"   # kind: v1, v1-ids, ranks, probe
mkdir -p "$DIR"
AUTH=(); [ -n "${LAP_API_KEY:-}" ] && AUTH=(-H "Authorization: Bearer $LAP_API_KEY")
get() { curl -sS -A "$UA" "${AUTH[@]}" -H 'Accept: application/json' --max-time 60 -o "$2" -w '%{http_code} %{time_total}s\n' "$1"; }

get "$API/quota"                    "$DIR/quota-before.json"
get "$API/alliances/<union_id>"     "$DIR/alliance-<union_id>.json"   # one line per resource
get "$API/quota"                    "$DIR/quota-after.json"
```

- Save the response body exactly as returned. No pretty-printing, no trimming: tests must see what the parsers will see. (The DB trims `raw_json`; fixtures don't.)
- Stop at the first `401`, `403` or `429`. Don't retry `429`. Retry `502/503/504` at most once, after 5 s.
- Never call `POST /api/alliances/{id}/refresh` or any refresh endpoint. Never send `Origin`, `Referer` or cookies to `lastasylumtracker.com`. The maintainer closed that on purpose.

## 4. Check before keeping

- `grep -rl 'lap_' "$DIR"` must print nothing. A response that echoes the key is deleted, not committed.
- Every file parses: `for f in "$DIR"/*.json; do node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$f" || echo "BAD $f"; done`
- Calls actually spent = `quota-before.remaining - quota-after.remaining`. It must equal your step-1 estimate. If it doesn't, say so.

## 5. Record it

Add one row to `fixtures/README.md` (create the file with this table header if it is missing):

| Folder | Recorded (UTC) | Endpoints | Calls spent | Why |
| ------ | -------------- | --------- | ----------- | --- |

Then report to the owner in one line: folder, calls spent, quota remaining. Commit the fixture and the README row together (`test: record <kind> fixture for <what>`). gitleaks runs on the commit; if it flags anything, stop.
