# KvK matchup, slice 2: suggest the opponent's alliance tags from its server's ranks board (#306)

**Approved**: 2026-11-22 - owner, in the chat, relayed in the orchestrator's comment on #306 (2026-11-22): "when the owner saves the opponent's server on /admin → KvK opponent, read that server's ranks board once through `lib/sources/internal.ts`, as we do for our own server (D133). The card then suggests the 15 largest alliances by might, and the owner confirms or edits them before saving." Conditions in the same comment: one read per KvK, read-only, no member names; the Start and End reads stay on the official API (D152); its own decision amending D133 and D152; not built if the read cannot reach another server without imitating the site.

Size: M (one PR). Part of #306; follows D152 (slice 1).

## Gate (Step 0)

- (a) `fetchRanks(server)` (`lib/sources/internal.ts:69-70`) already takes the server as its only parameter and sends `GET /servers/catalog/${server}/ranks`. The request (`get`, `lib/sources/internal.ts:44-47`) carries only `User-Agent` and `Accept`: no Origin, Referer or cookie. Another server's board is the same request with another number. Passes.
- (b) `get` sends no `Authorization` header (the key is added only in `lib/sources/v1.ts:154`), so the read spends no `LAP_API_KEY` quota and no other counted quota. D133 records the board as "0 (internal)". D152's reserves need no change.

## Problem

D152 makes the owner type up to 15 alliance tags of the opponent's server, copied from the game's KvK ranking. A typo or a wrong tag costs one call at the Start and leaves that alliance unread for the KvK. The ranks board already lists every alliance of a server with its tag, name and might, at no quota.

## Shape

1. The owner saves the opponent's server on /admin → `POST /api/admin/kvk-opponent` (exists) → `saveOpponent` (exists) → `suggestTags` (new, `lib/opponent-suggest.ts`) when that (event, server) has no suggestion row yet.
2. The owner presses "Suggest tags" → the same route with `{event_at, suggest: true}` (new body) → `suggestTags`, which may also retry a failed row.
3. `suggestTags` claims the (event, server) row in `kvk_suggestions` (new table) before the call, then makes one `internal.fetchRanks(server)` call, keeps the top 15 alliances by might whose tag is a valid opponent tag and that are not on our own newest board, and stores their tag, name and might.
4. /admin's KvK opponent card (exists) reads the row (`adminKvk`, exists) and shows the alliances as checked chips; the owner unchecks or adds tags and saves (exists).

| Front       | What changes                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| stored data | one new table `kvk_suggestions`, empty until the owner saves a server; nothing to migrate                      |
| quota       | none (internal board, D133); at most 3 board reads per (event, server), at most 1 that succeeds                |
| sources     | a new use of `internal.ts` `fetchRanks`: another server's number, from /admin only (D155)                      |
| readers     | /admin's KvK opponent card only. No public page, route, Discord message, log line or analytics reads the table |

## Surface

| Route                          | In (new)                    | Out                                | Status (new)                                                                                                    | Who                        |
| ------------------------------ | --------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `POST /api/admin/kvk-opponent` | `{event_at, suggest: true}` | `{event_at, server, tags, result}` | 200; 404 `no_opponent` (no server saved); 409 `war_started`; 409 `opponent_read` (the Start read a tag already) | PIN, as the route's others |

## Landing

| One-way door               | Literal shape                                                                                                                                                                                                                                                                                                            | Alternative rejected                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1. `kvk_suggestions`       | `id serial pk, event_at timestamptz not null, server integer not null check (1–9999), status text not null check in ('running','read','failed'), attempts integer not null check (1–3), alliances jsonb (array of {tag, name, power}, at most 15), pulled_at, claimed_at not null, read_at`; unique `(event_at, server)` | columns on `kvk_opponents`: a changed server would overwrite the first server's row and its count |
| 2. A new `internal.ts` use | another server's `GET /servers/catalog/<server>/ranks`, only from this route, D155                                                                                                                                                                                                                                       | reading it at the Start: it would add a call inside the run and change nothing the owner sees     |

## Criteria

**The read**

1. WHEN the owner saves server S for the KvK at E and (E, S) has no suggestion row THEN the system SHALL claim the row and make exactly one `fetchRanks(S)` call
2. WHEN the owner saves server S again for E, or presses "Suggest tags", and (E, S) has a row with status `read` THEN the system SHALL make no call (INVARIANT `suggest.one-read-per-event-server`)
3. WHEN two saves of (E, S) arrive at the same time THEN the system SHALL make one call: the claim is an insert on the unique (event_at, server)
4. IF the call fails (any error) THEN the row SHALL be `failed`, the save SHALL still answer 200 with the server and tags saved, and the card SHALL say so and keep the tags field
5. WHEN the owner presses "Suggest tags" and (E, S) is `failed`, or `running` and claimed more than 2 minutes ago, with fewer than 3 attempts THEN the system SHALL claim it again and make one call; with 3 attempts it SHALL make none (INVARIANT `suggest.attempt-cap`)
6. IF the war at E has started, or the Start has stored a row for E's opponent THEN "Suggest tags" SHALL answer 409 (`war_started`, `opponent_read`) with no call, and a save SHALL make no call
7. IF no server is saved for E THEN "Suggest tags" SHALL answer 404 `no_opponent` with no call
8. The suggestion SHALL be the 15 alliances with the most might on S's board (a tie to the lower id), counting only alliances whose tag passes the route's tag rule and that are not on our own newest board
   - 20 alliances on the board → the top 15 by might; the 16th never appears
   - an alliance with no tag, or a tag with a space, is skipped and the next one takes its place
9. The row SHALL store only each alliance's tag, name and might, and the board's `pulled_at`: no union id, emblem, kills or member field
10. The read SHALL spend no `LAP_API_KEY` call and SHALL NOT enter D152's reserves

**The card**

11. WHEN (E, S) is `read` THEN the card SHALL say "Suggested from server S's ranks board, read HH:MM ST" (with the day when it is not today) and show each suggested alliance as a checked chip (tag and might), and the tags field SHALL become "Other tags"
12. WHEN no tags are saved THEN every chip SHALL be checked; WHEN tags are saved THEN a chip SHALL be checked only when its tag is saved, and the other saved tags SHALL fill "Other tags"
13. WHEN the owner saves THEN the tags SHALL be the checked chips in board order, then the other tags as typed, duplicates dropped, validated as before (at most 15)
14. WHEN (E, S) is `failed` THEN the card SHALL say "Server S's ranks board couldn't be read. Type the tags as before." and, while attempts remain, show "Suggest tags"
15. WHEN a server is saved with no row (saved before this change) THEN the card SHALL show "Suggest tags"
16. WHILE the war has started or the Start has read a tag THEN the card SHALL show no "Suggest tags" button
17. No public page, route, Discord message, log line or analytics event SHALL show the suggestion

**Decision**

18. The change SHALL add D155, amending D133 and D152, to docs/decisions and its README

## Out of scope

| Excluded                                                   | Why                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Saving the suggestion as the tags without the owner's save | owner: "the owner confirms or edits them before saving"                      |
| A limit on how many servers a KvK may be read for          | every read is a PIN save of a new server, before the war; see Validation (b) |
| An e2e flow                                                | no admin e2e spec exists, and `e2e/stub-server.mjs` serves no ranks board    |
| Kills or emblems on the chips                              | the owner asked for the largest by might                                     |

## Assumptions

| Assumption                         | Chosen default                                               | Rationale                                                                                   | Confirmed? |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------- |
| "One successful read" with retries | up to 3 attempts per (event, server), only the press retries | a failure must leave a way to try again; 3 bounds the unofficial source                     | n          |
| Alliances on our own board         | left out of the suggestion                                   | an alliance on our newest board is ours, never the opponent's; guards a board of our server | n          |
| An alliance without a usable tag   | skipped, the next one by might takes its place               | it cannot be read by tag at the Start                                                       | n          |

## Validation

See the handoff, `docs/handoff/feat-306-opponent-tags.md` § Decisions, for the owner-as-admin and adversarial checks and what was adopted.
