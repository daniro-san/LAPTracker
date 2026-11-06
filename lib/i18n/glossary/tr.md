# Glossary: tr

Words already used in `lib/i18n/tr.ts`. Reuse them so the pages stay consistent; add a row when you coin a term another key will need again (translate-copy skill).

| English                   | tr                              | Key and use                                               |
| ------------------------- | ------------------------------- | --------------------------------------------------------- |
| Server 325 · Event Ledger | Sunucu 325 · Etkinlik Defteri   | `site.ledger` — the page title                            |
| Ledger                    | Defter                          | `site.home` — the ledger, as a breadcrumb                 |
| kept by the Old Grandmas  | Old Grandmas tarafından tutulur | `site.byline` — Old Grandmas stays a name                 |
| Alliance                  | İttifak                         | `ledger.alliance`                                         |
| Member                    | Üye                             | `ledger.member` — a player inside an alliance             |
| Player                    | Oyuncu                          | `ledger.player`                                           |
| Event                     | Etkinlik                        | `ledger.event` — a Saturday event                         |
| Rank                      | Sıra                            | `ledger.rank` — the #n position                           |
| Ranking                   | Sıralama                        | `ledger.ranking` — the game's server rank                 |
| Sanctuary                 | Sığınak                         | `ledger.sanctuary` — a player's building level            |
| joined                    | katıldı                         | `ledger.joined` — after +n                                |
| left                      | ayrıldı                         | `ledger.left` — after −n                                  |
| Stale                     | Eskimiş                         | `fresh.stale` — data not fresh                            |
| server time               | sunucu saati                    | `time.serverTime` — after a time: 14:01 …                 |
| your time                 | senin saatin                    | `time.yourTime` — after a time, the viewer's zone         |
| Exact numbers             | Tam sayılar                     | `site.exactNumbers` — the toggle; legend.rounded names it |
| Manual round              | Elle tur                        | `site.manualRound` — an event the admin runs by hand      |
| Leader                    | Lider                           | `leadership.leader` — the R5                              |
| Run by hand by the admin  | Admin elle başlatır             | `status.byHand`                                           |
| grandma                   | nine                            | the voice in empty states and errors                      |

- Might, Kills, Members and Level stay in English, also inside labels (`± Might`).
- Counts read `Label: {n}` so no plural forms are needed.
- `{date} sonrası` avoids suffix harmony on a placeholder.
