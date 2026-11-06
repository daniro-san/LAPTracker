# Glossary: vi

Words already used in `lib/i18n/vi.ts`. Reuse them so the pages stay consistent; add a row when you coin a term another key will need again (translate-copy skill).

| English                   | vi                       | Key and use                                               |
| ------------------------- | ------------------------ | --------------------------------------------------------- |
| Server 325 · Event Ledger | Máy chủ 325 · Sổ sự kiện | `site.ledger` — the page title                            |
| Ledger                    | Sổ                       | `site.home` — the ledger, as a breadcrumb                 |
| kept by the Old Grandmas  | do Old Grandmas ghi chép | `site.byline` — Old Grandmas stays a name                 |
| Alliance                  | Liên minh                | `ledger.alliance`                                         |
| Member                    | Thành viên               | `ledger.member` — a player inside an alliance             |
| Player                    | Người chơi               | `ledger.player`                                           |
| Event                     | Sự kiện                  | `ledger.event` — a game event                             |
| Rank                      | Hạng                     | `ledger.rank` — the #n position                           |
| Ranking                   | Xếp hạng                 | `ledger.ranking` — the game's server rank                 |
| Sanctuary                 | Thánh địa                | `ledger.sanctuary` — a player's building level            |
| joined                    | vào                      | `ledger.joined` — after +n                                |
| left                      | rời                      | `ledger.left` — after −n                                  |
| Stale                     | Cũ                       | `fresh.stale` — data not fresh                            |
| server time               | giờ máy chủ              | `time.serverTime` — after a time: 14:01 …                 |
| your time                 | giờ của bạn              | `time.yourTime` — after a time, the viewer's zone         |
| Exact numbers             | Số chính xác             | `site.exactNumbers` — the toggle; legend.rounded names it |
| Manual round              | Vòng thủ công            | `site.manualRound` — an event the admin runs by hand      |
| Leader                    | Thủ lĩnh                 | `leadership.leader` — the R5                              |
| Run by hand by the admin  | Admin chạy thủ công      | `status.byHand`                                           |
| grandma                   | bà                       | the voice in empty states and errors                      |

- Might, Kills, Members and Level: the word in "Game terms (from the game)" below, also inside labels (`± Might`); English where that section has none. Never coin one (D52).
- Counts read `Label: {n}` so no plural forms are needed.

## Game terms (from the game)

The game's own word for each term, with the page that shows it in the game's text and the quote. A term not listed stays English. Add a row only with a source that carries the game's own text (datamined text or an in-game screenshot), never a guide's prose (D52).

| English | vi         | Source                                        | Quote                                                                     |
| ------- | ---------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Might   | Lực Chiến  | https://lastasylum.gg/vi/events/alliance-duel | công hội có hơn 20 thành viên vào Chủ Nhật và Lực Chiến đạt TOP32 máy chủ |
| Kills   | Tiêu diệt  | https://lastasylum.gg/vi/events/kingdom-war   | bảng xếp hạng Điểm tiêu diệt kẻ thù sẽ bị khóa                            |
| Members | Thành viên | https://lastasylum.gg/vi/research/alliance    | Tăng tốc độ thu thập Tài Nguyên của Thành viên Công Hội                   |

Level stays English: the game writes a level as `Lv.` before the number (`Nhà Thờ Lv.14`); `cấp` appears only in prose. In the game an alliance is a guild (Công Hội); this file still says liên minh.
