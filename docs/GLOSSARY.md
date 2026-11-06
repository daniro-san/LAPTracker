# Glossary

One name per concept, in code and in prose, so an agent can grep. UI word ↔ code/DB word.

| Term                      | Meaning                                                                                                                                       | In code / DB                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| LAP                       | Last Asylum Plague, the game. Its API keys start with `lap_`. Never "LAT".                                                                    | `LAP_API_KEY`                            |
| the tracker               | lastasylumtracker.com, the third-party site and API we read                                                                                   | —                                        |
| LAPTracker                | this project                                                                                                                                  | —                                        |
| event                     | one game event: a scheduled event or a manual event (D28)                                                                                     | `events`                                 |
| scheduled event           | the weekly event on `EVENT_WEEKDAY` (Saturday by default), made by the tick a day ahead; default title `<Weekday> Event <date>`               | `events.manual = false`                  |
| manual event              | a public event the owner creates on /admin and runs by hand; no schedule, never run by the tick (D28)                                         | `events.manual`                          |
| event title               | a manual event's name or a renamed event's; none while a scheduled event keeps its generated name, so pages show the date (D49)               | `eventTitle`, `isGeneratedName`          |
| snapshot                  | one collection run for one event and phase                                                                                                    | `snapshots`                              |
| phase                     | `before` or `after` the event                                                                                                                 | `phase`                                  |
| might                     | total alliance power (UI word)                                                                                                                | `total_power` (API `power`)              |
| kills                     | sum of the roster's member kills                                                                                                              | `total_kills`                            |
| board kills / board might | the server ranks board numbers; cross-check only, never in a delta                                                                            | `kills_board`, `power_board`             |
| delta                     | after − before for one alliance, roster vs roster                                                                                             | computed in `lib/compute.ts`             |
| fresh                     | roster `updated_at` within 20 min of the snapshot                                                                                             | `is_fresh`                               |
| stale                     | not fresh; shown with a marker and no delta                                                                                                   | `is_fresh = false`                       |
| complete                  | every row ok and fresh                                                                                                                        | `status = 'complete'`                    |
| partial                   | some rows missing or stale                                                                                                                    | `status = 'partial'`                     |
| failed                    | no rows                                                                                                                                       | `status = 'failed'`                      |
| source                    | where a row came from: the documented API or the internal fallback                                                                            | `source` (`v1` \| `internal`)            |
| identity                  | an alliance's or player's permanent id; names and tags are labels with a history                                                              | `union_id`, `uid`                        |
| tag                       | the alliance's short label (`abbr` in the API); case-sensitive, not unique                                                                    | `tag`                                    |
| name history              | distinct (tag, name) pairs per id, derived from snapshots                                                                                     | `lib/queries/names.ts`                   |
| quota                     | the 1,000 `/v1` requests per UTC day                                                                                                          | `remaining`                              |
| tick                      | the 15-minute scheduler call that decides whether a snapshot is due                                                                           | `POST /api/tick`                         |
| blocked roster keys       | roster fields kept in `raw_json` and never served                                                                                             | `BLOCKED_ROSTER_KEYS`                    |
| reference value           | an event's `after` row (fallback `before`), used for across-events deltas                                                                     | `lib/compute.ts`                         |
| ledger rank               | an alliance's position among the tracked alliances by might or by kills, per snapshot or per event; a player's, among their alliance's roster | `compute.rankBy`, `lib/queries/ranks.ts` |
| server rank               | the game's own power ranking of the alliance on the server                                                                                    | `server_rank` (API `rank.rank`)          |
| rank movement             | places moved between two ranks: `▲k` up, `▼k` down, `=` held, `—` unknown                                                                     | `compute.rankDelta`                      |
| copy / blank dictionary   | every user-facing string, keyed; the blank dictionary replaces each value with `░` for the ten-second test                                    | `lib/copy.ts`, `NEXT_PUBLIC_BLANK_COPY`  |
| dictionary / language     | the public pages' strings in one language (`en`, `lib/copy.<tag>.ts`), picked per request from the `lang` cookie or Accept-Language (D48)     | `requestCopy`, `useCopy`                 |
