## D155 — The KvK opponent's tags suggested from its server's ranks board: one read per (KvK, server) from /admin, tags, names and might only (2026-11-22, owner in the chat 2026-11-22, issue 306; amends D133 and D152)

Why: D152 has the owner type up to 15 tags of the opponent's alliances, copied from the game. A wrong tag costs a call at the Start and leaves that alliance unread for the KvK. The owner (chat, 2026-11-22, relayed on issue 306): when the owner saves the opponent's server, read that server's ranks board once through `lib/sources/internal.ts`, as D133 reads ours, and suggest the 15 largest alliances by might; the owner confirms or edits them before saving. Plan: `.specs/features/306-opponent-tags/plan.md`.

**The request.** The same `GET /servers/catalog/<server>/ranks` as D133 (`fetchRanks(server)`), with the opponent's server number in place of ours. No other change: no refresh call, no Origin, Referer or cookies, GET only. It sends no API key, so it spends no `LAP_API_KEY` quota and enters none of D152's reserves.

**When** (`lib/opponent-suggest.ts`, `POST /api/admin/kvk-opponent`, PIN only).

- On the owner's save of the opponent's server, when that (KvK, server) has no row yet; or on the card's "Suggest tags" press (`{event_at, suggest: true}`).
- Only before the war, and only while the Start has stored no row for that opponent (409 `war_started`, `opponent_read` on the press; a save makes no read then).
- **One successful read per (KvK, server)**, kept in `kvk_suggestions` (migration 0071), unique on `(event_at, server)`. The row is claimed before the call, so two saves at once make one call. A `read` row is never read again (INVARIANT `suggest.one-read-per-event-server`). A `failed` row, or a `running` claim older than 2 minutes, may be claimed again by the press only, up to 3 attempts in all (INVARIANT `suggest.attempt-cap`).
- A failure stores `failed`, logs only the error's class (`kvk.suggest_failed`), and leaves the save as it was: the card says the board could not be read and the tags field works as before.

**What is kept.** The 15 alliances with the most might on that board (a tie to the lower id), counting only alliances whose tag passes D152's tag rule (the Start reads each by tag). For each: its tag, name and might, and the board's `pulled_at`. No union id, emblem, kills, place or member field; the players' boards in the same answer are never parsed (D133's parser keeps `alliance_power` and `alliance_kills` only).

**The wrong server.** The answer's own `sid` must equal the server asked for; the parser now reads it (optional, so a board without it still parses for D133). Another `sid`, no `sid`, or a board with nothing to suggest is a failed read. The card names the server it read ("Suggested from server N's ranks board"), and the Start's own `sid` check (D152 `wrong server`) still applies to every saved tag.

**Where it shows.** Only /admin's KvK opponent card: "Suggested from server N's ranks board, read HH:MM ST", the alliances as checked chips, and "Other tags" for the rest. Nothing is saved as the opponent's tags until the owner saves. No public page, public route, Discord message, log line or analytics event reads the table, so no PostHog flag (D91) is needed.

**No use anywhere else.** The opponent's Start and End stay on `/v1` (D152). The tick, the collector, samples and public pages never read another server's board.

**Amendments.**

- **D133**: `fetchRanks` may also read the KvK opponent's server, from this route only, under the rules above, and it now returns the answer's `sid` (`RanksBoard.server`). Its other uses are unchanged.
- **D152**: "discovering the opponent's tags from its server's ranks board" (Not built) is built here; "No use of `lib/sources/internal.ts`" still holds for the opponent's reads in the collector.
