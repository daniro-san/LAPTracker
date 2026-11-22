---
name: record-fixture
description: Record a new upstream API response into fixtures/ (spends LAP API quota). Use only when a session explicitly needs a new or refreshed fixture, e.g. "record a fixture for alliance 67110584" or "re-record the ranks board". Never use from a test, never on the event's weekday or the day before.
---

# Record a fixture

`fixtures/` is the contract with the upstream API (docs/IMPLEMENTATION_PLAN.md §11.3). This is the one procedure in the repo with a side effect: every `/v1` call spends 1 of 1,000 daily requests, including `/v1/quota`. A scheduled event's snapshots need ~55. Follow every step; skip none.

## 1. Decide and state the cost before calling anything

1. Name the exact endpoints and ids, and why an existing fixture can't serve. List existing ones: `ls fixtures/`.
2. Cost = 1 (quota before) + 1 per `/v1` resource + 1 (quota after). The internal ranks board (`GET https://lastasylumtracker.com/api/servers/catalog/325/ranks`) costs 0 quota.
3. Check the day in UTC **and** server time (UTC−2): `date -u`. If it is the event's weekday (`EVENT_WEEKDAY`, Saturday by default) or the day before in either, stop and tell the owner. Those days belong to the event.
4. If the cost is above 5 calls, or the session prompt didn't explicitly allow quota use, ask the owner with the cost and wait for a yes.

## 2. Credentials, never printed

- The key never passes through your shell. `pnpm fixture:record` (`scripts/record-fixture.ts`) takes `LAP_API_KEY` from the environment (a cloud environment variable) or, locally, from the local env file through `--env-file-if-exists` in package.json. Never open, grep or source that file; the env guard blocks it.
- The local env file holds only a placeholder key unless the owner put the real one there for this run. A placeholder gets `401` (no quota spent). If the script says the key is not set, or a call returns `401 {"detail":"missing_api_key"}`, stop and ask the owner to provide the key.
- Never `echo`, `set -x`, `env` or paste the key. Never put it in a file under the repo.

## 3. Call and save the raw body

```bash
# One line per call: <path under /v1> <output file>. The script sends the User-Agent and the key, waits up to
# 60 s per call, prints "<path> -> <status> <seconds>s", and stops at the first 401, 403 or 429.
# Deny by default: only an explicit /tmp path gets the raw body; every other path is neutralised.
pnpm -s fixture:record <<'CALLS'
quota            /tmp/quota-before.json
alliances/<id>   fixtures/v1-ids/<id>.json
quota            /tmp/quota-after.json
CALLS
```

- **Neutralise before the body reaches `fixtures/`.** The repository is public (D76). `scripts/neutralise-fixture.ts` sets `x`, `y`, `online`, `last_online_at` and `joined_at` to a neutral value of the same type (numbers 0, booleans false, strings empty, null stays null) at every depth (rosters, members, player responses) and keeps the keys and every other byte. The internal ranks board and any other body go through it too. Never write a raw body to a path under `fixtures/`, and never commit one.
- Alliance bodies go in `fixtures/v1-ids/<id>.json` (Session 0's layout); other kinds in `fixtures/<kind>-<utc timestamp>/`. Quota bodies are only for the count and need not be kept (every response carries `quota`).
- Save the response body as returned, apart from the five neutralised values. No pretty-printing, no trimming: tests must see what the parsers will see. (The DB trims `raw_json`; fixtures don't.)
- Stop at the first `401`, `403` or `429`. Don't retry `429`. Retry `502/503/504` at most once, after 5 s.
- Never call `POST /api/alliances/{id}/refresh` or any refresh endpoint. Never send `Origin`, `Referer` or cookies to `lastasylumtracker.com`. The maintainer closed that on purpose.

## 4. Check before keeping

- No non-neutral value is left: `grep -rhoE '"(x|y)": ?-?[0-9.]*[1-9][0-9.]*|"online": ?true|"(last_online_at|joined_at)": ?("[^"]+"|-?[0-9.]*[1-9][0-9.]*)' "$DIR" | wc -l` must print `0`.
- `grep -rl 'lap_' "$DIR"` must print nothing. A response that echoes the key is deleted, not committed.
- Every file parses: `for f in "$DIR"/*.json; do node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$f" || echo "BAD $f"; done`
- Calls actually spent = `quota-after.used - quota-before.used + 1` (the before call counts itself). `502`s count. If it differs from your step-1 estimate, say so.
- A `502`/`503` body (`error code: 502`) is not a fixture; delete it.

## 5. Record it

Add one row to the table in `fixtures/README.md`, in its existing columns (Folder · What · Recorded (UTC) · Cost). The cost cell gives calls and the `used` before → after.

Then report to the owner in one line: folder, calls spent, quota remaining. Commit the fixture and the README row together (`test: record <kind> fixture for <what>`). gitleaks runs on the commit; if it flags anything, stop.
