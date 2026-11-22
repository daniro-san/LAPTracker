# insights-time-zones proofs

**HEAD**: 19ed0760
**Tree**: clean
**Shell**: /bin/sh
**Result**: 13 pass, 0 fail

| Check | Proof                                                                                                            | Result |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| C1    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > groups th` | pass   |
| C2    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > counts on` | pass   |
| C3    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > splits zo` | pass   |
| C4    | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the ` | pass   |
| C11   | `run unit / ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the ` | pass   |
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
 ✓ lib/private/dictionary.test.ts > pickWorkspaceLanguage > ignores a cookie that is not one of the three languages 0ms
 ✓ lib/private/dictionary.test.ts > pickWorkspaceLanguage > finds nothing for object-prototype names in the header 0ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > groups the zones that share an offset, west to east, cities most members first 320ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > counts only the newest daily update's members, and a cleared or missing zone as not recorded 58ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > splits zones whose clocks change before the reset, each on its own clock, and joins them after 65ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the clocks change before KvK when KvK comes first, and names a tie west to east 44ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says the reset and KvK on each zone's clock, with its weekday when its date is not the server's 45ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > shows the next KvK start, never one already running 28ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > gives the server hours most members are within their usual hours as ranges, through midnight 59ms
 ✓ lib/private/insights-zones.test.ts > the Insights Time zones card (owner, 2026-11-22) > says no time zone is recorded yet, with no rows, then names the one member's group 56ms

 Test Files  2 passed (2)
      Tests  18 passed (18)
   Start at  12:37:40
   Duration  1.29s (tests 63%, import 26%, transform 10%)
```

`PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH pnpm test:e2e e2e/desk-insights.spec.ts -g "Time zones" --proje` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [wide] › e2e/desk-insights.spec.ts:22:1 › Time zones: the largest group and its reset, the groups west to east, and the members to ask (997ms)
  ✓  2 [phone] › e2e/desk-insights.spec.ts:22:1 › Time zones: the largest group and its reset, the groups west to east, and the members to ask (1.1s)

  2 passed (8.8s)
$ playwright test e2e/desk-insights.spec.ts -g 'Time zones' --project=phone --project=wide
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3477". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`PATH=/opt/homebrew/opt/postgresql@18/bin:$PATH E2E_NO_BUILD=1 pnpm test:e2e e2e/isolation.spec.ts --project=ph` - exit 0

```
  ✓   8 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's officer as __Host-lap_ws.msh sees no page of b's desk or board (639ms)
  ✓   9 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's officer as __Host-lap_ws sees no page of b's desk or board (571ms)
  ✓  10 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's member as __Host-lap_ws.lnk sees no page of b's desk or board (545ms)
  ✓  11 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's member as __Host-lap_ws.msh sees no page of b's desk or board (549ms)
  ✓  12 [phone] › e2e/isolation.spec.ts:166:5 › one workspace's sessions never open the other's › a's member as __Host-lap_ws sees no page of b's desk or board (549ms)
  ✓  13 [phone] › e2e/isolation.spec.ts:223:5 › no answer carries a private roster field › the public pages (380ms)
  ✓  14 [phone] › e2e/isolation.spec.ts:223:5 › no answer carries a private roster field › a's desk (441ms)
  ✓  15 [phone] › e2e/isolation.spec.ts:223:5 › no answer carries a private roster field › a's board (77ms)
  ✓  16 [phone] › e2e/isolation.spec.ts:250:3 › no answer carries a private roster field › the scan sees the own desk's fields where D71 allows them (87ms)
  ✓  17 [phone] › e2e/isolation.spec.ts:269:3 › no answer carries a private roster field › the scan sees online as a key and a sentinel after a comma (5ms)
  ✓  18 [phone] › e2e/isolation.spec.ts:286:3 › no answer carries a private roster field › the scan sees another seeded workspace's member on each workspace's private answers (7ms)

  18 passed (8.6s)
$ playwright test e2e/isolation.spec.ts --project=phone
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3477". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```
