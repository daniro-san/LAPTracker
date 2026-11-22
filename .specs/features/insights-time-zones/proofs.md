# insights-time-zones proofs

**HEAD**: 809a64e6
**Tree**: clean
**Shell**: /bin/sh
**Result**: 16 pass, 0 fail

| Check | Proof                                                                                                            | Result |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| C1    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > groups th` | pass   |
| C2    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > counts on` | pass   |
| C3    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > splits zo` | pass   |
| C4    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the ` | pass   |
| C11   | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the ` | pass   |
| C12   | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > counts fi` | pass   |
| C13   | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > joins the` | pass   |
| C14   | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > gives no ` | pass   |
| C5    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > shows the` | pass   |
| C6    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > gives the` | pass   |
| C7    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says no t` | pass   |
| C8    | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, ` | pass   |
| C9    | `PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH pnpm test:e2e e2e/desk-insights.spec.ts -g "Time zones" --proje` | pass   |
| C10   | `PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH E2E_NO_BUILD=1 pnpm test:e2e e2e/isolation.spec.ts --project=ph` | pass   |
| Build | `pnpm typecheck`                                                                                                 | pass   |
| Build | `pnpm lint`                                                                                                      | pass   |

## Output

`Run unit` - exit 0

```
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > counts only the newest daily update's members, and a cleared or missing zone as not recorded 126ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > splits zones whose clocks change before the reset, each on its own clock, and joins them after 221ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the clocks change before KvK when KvK comes first, and names a tie west to east 85ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the reset and KvK on each zone's clock, with its weekday when its date is not the server's 184ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > counts fixed-offset zones with no city, and names a row's cities by name 357ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > joins the reset's times as each language does, with and without a weekday 150ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > gives no usual-hours line with a single group 198ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > shows the next KvK start, never one already running 135ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > gives the server hours most members are within their usual hours as ranges, through midnight 126ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says no time zone is recorded yet, with no rows, then names the one member's group 158ms

 Test Files  2 passed (2)
      Tests  21 passed (21)
   Start at  13:17:10
   Duration  4.75s (tests 66%, import 20%, transform 15%)
```

`PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH pnpm test:e2e e2e/desk-insights.spec.ts -g "Time zones" --proje` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [wide] › e2e/desk-insights.spec.ts:115:1 › Time zones: the largest group and its reset, the groups west to east, and the members to ask (2.5s)
  ✓  2 [phone] › e2e/desk-insights.spec.ts:115:1 › Time zones: the largest group and its reset, the groups west to east, and the members to ask (2.5s)

  2 passed (23.7s)
$ playwright test e2e/desk-insights.spec.ts -g 'Time zones' --project=phone --project=wide
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3477". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH E2E_NO_BUILD=1 pnpm test:e2e e2e/isolation.spec.ts --project=ph` - exit 0

```
  ✓   8 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's officer as __Host-lap_ws.msh sees no page of b's desk or board (1.3s)
  ✓   9 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's officer as __Host-lap_ws sees no page of b's desk or board (1.3s)
  ✓  10 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's member as __Host-lap_ws.lnk sees no page of b's desk or board (1.4s)
  ✓  11 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's member as __Host-lap_ws.msh sees no page of b's desk or board (1.1s)
  ✓  12 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's member as __Host-lap_ws sees no page of b's desk or board (1.3s)
  ✓  13 [phone] › e2e/isolation.spec.ts:223:5 › no answer carries a private roster field › the public pages (930ms)
  ✓  14 [phone] › e2e/isolation.spec.ts:223:5 › no answer carries a private roster field › a's desk (1.6s)
  ✓  15 [phone] › e2e/isolation.spec.ts:223:5 › no answer carries a private roster field › a's board (214ms)
  ✓  16 [phone] › e2e/isolation.spec.ts:250:3 › no answer carries a private roster field › the scan sees the own desk's fields where D71 allows them (350ms)
  ✓  17 [phone] › e2e/isolation.spec.ts:269:3 › no answer carries a private roster field › the scan sees online as a key and a sentinel after a comma (11ms)
  ✓  18 [phone] › e2e/isolation.spec.ts:286:3 › no answer carries a private roster field › the scan sees another seeded workspace's member on each workspace's private answers (14ms)

  18 passed (22.3s)
$ playwright test e2e/isolation.spec.ts --project=phone
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3477". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```
