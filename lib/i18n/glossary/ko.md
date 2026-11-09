# Glossary: ko

Words already used in `lib/i18n/ko.ts`. Reuse them so the pages stay consistent; add a row when you coin a term another key will need again (translate-copy skill).

| English                   | ko                     | Key and use                                                 |
| ------------------------- | ---------------------- | ----------------------------------------------------------- |
| Server 325 · Event Ledger | 서버 325 · 이벤트 장부 | `site.ledger` — the page title                              |
| Ledger                    | 장부                   | `site.home` — the ledger, as a breadcrumb                   |
| kept by the Old Grandmas  | Old Grandmas가 기록    | `site.byline` — Old Grandmas stays a name                   |
| Alliance                  | 연맹                   | `ledger.alliance`                                           |
| Member                    | 멤버                   | `ledger.member` — a player inside an alliance               |
| Player                    | 플레이어               | `ledger.player`                                             |
| Event                     | 이벤트                 | `ledger.event` — a game event                               |
| Rank                      | 순위                   | `ledger.rank` — the #n position                             |
| Ranking                   | 서버 순위              | `ledger.ranking` — the game's server rank                   |
| Sanctuary                 | 성소                   | `ledger.sanctuary` — a player's building level              |
| joined                    | 가입                   | `ledger.joined` — after +n                                  |
| left                      | 탈퇴                   | `ledger.left` — after −n                                    |
| Stale                     | 오래됨                 | `fresh.stale` — data not fresh                              |
| server time               | 서버 시간              | `time.serverTime` — after a time: 14:01 …                   |
| your time                 | 내 시간                | `time.yourTime` — after a time, the viewer's zone           |
| Exact numbers             | 정확한 숫자            | `site.exactNumbers` — the toggle; legend.rounded names it   |
| Manual round              | 수동 라운드            | `site.manualRound` — an event the admin runs by hand        |
| Leader                    | 맹주                   | `leadership.leader` — the R5                                |
| Run by hand by the admin  | 관리자가 직접 실행     | `status.byHand`                                             |
| Start                     | 시작                   | `status.start` — the capture window's start label           |
| End                       | 종료                   | `status.end` — the capture window's end label               |
| Compare                   | 비교                   | `compare.title`, `compare.action` — two events side by side |
| grandma                   | 할머니                 | the voice in empty states and errors                        |

- Might, Kills, Members and Level: the word in "Game terms (from the game)" below, also inside labels (`± Might`); English where that section has none. Never coin one (D52).
- Counts read `Label: {n}` so no plural forms are needed.

## Game terms (from the game)

The game's own word for each term, with the page that shows it in the game's text and the quote. A term not listed stays English. Add a row only with a source that carries the game's own text (datamined text or an in-game screenshot), never a guide's prose (D52).

| English | ko     | Source                                        | Quote                                                                                                   |
| ------- | ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Might   | 전투력 | https://lastasylum.gg/ko/events/alliance-duel | 일요일 길드 인원이 20명을 초과하고, 길드 전투력이 서버 32위 안에 드는 길드만 매칭에 참여할 수 있습니다. |
| Kills   | 처치   | https://lastasylum.gg/ko/events/kingdom-war   | 적 처치 랭킹을 올리고 목표 포인트를 달성하면 목표 보물상자 보상을 획득합니다.                           |
| Members | 인원   | https://lastasylum.gg/ko/events/alliance-duel | 일요일 길드 인원이 20명을 초과하고, …                                                                   |

Level stays English: the game writes a level as `Lv.` before the number (`성당 Lv.10+`), and `레벨` appears only as the pass level. In the game an alliance is a guild (길드); this file still says 연맹.
