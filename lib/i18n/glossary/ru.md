# Glossary: ru

Words already used in `lib/i18n/ru.ts`. Reuse them so the pages stay consistent; add a row when you coin a term another key will need again (translate-copy skill).

| English                   | ru                          | Key and use                                                 |
| ------------------------- | --------------------------- | ----------------------------------------------------------- |
| Server 325 · Event Ledger | Сервер 325 · Журнал событий | `site.ledger` — the page title                              |
| Ledger                    | Журнал                      | `site.home` — the ledger, as a breadcrumb                   |
| kept by the Old Grandmas  | ведут Old Grandmas          | `site.byline` — Old Grandmas stays a name                   |
| Alliance                  | Альянс                      | `ledger.alliance`                                           |
| Member                    | Участник                    | `ledger.member` — a player inside an alliance               |
| Player                    | Игрок                       | `ledger.player`                                             |
| Event                     | Событие                     | `ledger.event` — a game event                               |
| Rank                      | Место                       | `ledger.rank` — the #n position                             |
| Ranking                   | Рейтинг                     | `ledger.ranking` — the game's server rank                   |
| Sanctuary                 | Святилище                   | `ledger.sanctuary` — a player's building level              |
| joined                    | пришли                      | `ledger.joined` — after +n                                  |
| left                      | ушли                        | `ledger.left` — after −n                                    |
| Stale                     | Устарели                    | `fresh.stale` — data not fresh                              |
| server time               | по серверу                  | `time.serverTime` — after a time: 14:01 …                   |
| your time                 | ваше время                  | `time.yourTime` — after a time, the viewer's zone           |
| Exact numbers             | Точные числа                | `site.exactNumbers` — the toggle; legend.rounded names it   |
| Manual round              | Ручной раунд                | `site.manualRound` — an event the admin runs by hand        |
| Leader                    | Лидер                       | `leadership.leader` — the R5                                |
| Run by hand by the admin  | Админ запускает вручную     | `status.byHand`                                             |
| grandma                   | бабушка                     | the voice in empty states and errors                        |
| Grandma noticed           | Бабушка заметила            | `ledger.movers` — the event's biggest gains and losses      |
| vs                        | против                      | `compare.title`, `compare.versus` — two events side by side |
| Before / After            | До / После                  | `compare.lead` — the two ends of one event's change         |

- Might, Kills, Members and Level: the word in "Game terms (from the game)" below, also inside labels (`± Might`); English where that section has none. Never coin one (D52).
- Counts read `Label: {n}` so no plural forms are needed.

## Game terms (from the game)

The game's own word for each term, with the page that shows it in the game's text and the quote. A term not listed stays English. Add a row only with a source that carries the game's own text (datamined text or an in-game screenshot), never a guide's prose (D52).

| English | ru        | Source                                        | Quote                                                         |
| ------- | --------- | --------------------------------------------- | ------------------------------------------------------------- |
| Might   | Мощь      | https://lastasylum.gg/ru/events/alliance-duel | входящие в топ-32 по мощи на сервере                          |
| Kills   | Убийства  | https://lastasylum.gg/ru/events/kingdom-war   | Повышайте свой рейтинг убийств и достигайте ступеней по очкам |
| Members | Участники | https://lastasylum.gg/ru/events/alliance-duel | допускаются альянсы с более чем 20 участниками в воскресенье  |

Nominative plural for the column headers (`Убийства`, `Участники`); lower case after an abbreviation (`Мин. мощь`). Level stays English: the game writes `ур.` before the number, not as a header.
