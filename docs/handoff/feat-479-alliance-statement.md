# feat-479 — The alliance's statement and how to join, on its public page

## Built

- A "Statement and joining" card on `/events/[id]/alliances/[unionId]`, right below the summary band (`app/_ui/AllianceStatement.tsx`).
  - The joining line comes first: "By application · 8.00M+ might · HQ 14+ · Full (101/100)", or "Open to join · HQ 15+ · 27 seats open (73/100)".
  - Then the alliance's own text under "Written by the alliance in game". It is plain text with its line breaks, with `lang` from `language` and `dir="auto"`, within the 65-character measure (`Measure`, D122).
  - Then "As of {date}", the server day of the read used.
- Show all: a text that may pass six lines at 360 px is cut at six lines. A small client component (`app/_ui/StatementText.tsx`) gives it a "Show all" / "Show less" button of 44 px with `aria-expanded`, and hides the button where the text fits. A shorter text is rendered on the server with no script.
- States:
  - No statement: the card is titled "Joining" and holds the line alone.
  - The newest read failed: the card uses the newest successful read, and its date says which.
  - No read with a response (discovered alliances, old rows): no card.
- Read model `allianceStatement(db, unionId)` (`lib/queries/statement.ts`). It picks only `declaration`, `bulletin`, `language`, `join.auto|power|castle_level`, `member_count` and `capacity` out of `daily_rosters.raw_json` in SQL. `members`, `leader_id` and the D71 fields never leave the database.
- Storage: `trimRaw` now keeps `declaration` and `bulletin` (it used to drop them). See Deviations.
- Copy: `lib/copy-statement.ts`, as `copy.statement` (12 keys), in all 17 languages, with stamps and glossary rows.
- Docs: D128 with its README line, a DESIGN.md `alliance-statement` component line, and a GLOSSARY row "alliance statement".
- `app/_ui/alliance-totals.ts`: `totalsMetric`, `totalsMetrics` and `showsMemberMark` moved out of the alliance page unchanged. The page sat exactly at the 300-line lint limit, and the card needed a few lines.

## Decisions

- D128 (amends D72, D22 and plan §6). The "8.00M" format comes from D78 (one compact format), not from the issue's "8M".
- "Open to join" replaces only the mode word. The minimums and seats still show, because the game applies them to open alliances too (`fixtures/v1-ids/67110415.json`: `auto: true`, `castle_level: 15`).
- A known language is one `Intl.DisplayNames` names (`fallback: "none"`). The game's `all` gets no `lang`.
- A `join.power` or `join.castle_level` of 0 means no minimum and is left out. Seats open never go below 0, because the game reports 101/100.
- A successful read is a `daily_rosters` row with `error IS NULL` and `raw_json IS NOT NULL`. A stale roster (`is_fresh = false`) still counts, since the statement does not depend on freshness.
- The card sits on the event alliance page, because `/alliances/[id]` (the issue's path) does not exist. The history page `/alliances/[id]/history` does not show it.

## Deviations

- The issue says the daily read already keeps the statement in `raw_json`. It did not: `trimRaw` dropped `declaration` and `bulletin` (plan §6). The card cannot work without them, so `trimRaw` now keeps both, for event snapshots too, since it is one shared rule. Consequence: **no statement shows until the first daily read after deploy** (23:37 server time). Until then the card shows the joining line alone, under "Joining".
- `lib/collector.test.ts` expected the old trimmed shape. It now expects `bulletin` and `declaration` kept.
- The issue's "8M" reads "8.00M+" (D78 and the persona panel).
- translate-copy: 11 keys went through one Haiku translator per language. The panel then added one key (`statement.full`, "Full ({members}/{capacity})"). I wrote its 17 translations myself from each language's own `seats` wording, rather than dispatch 17 more agents for one short string. Then I stamped.

## Verified

- `pnpm check` passes: prettier, eslint, tsc, vitest 1217 passed / 4 skipped (225 files), check-drift, i18n (17 languages up to date).
- New tests:
  - `lib/queries/statement.test.ts` (3 tests): only the listed fields are served; a failed newest read falls back; an empty statement and `all` give no text and no lang; no read gives null.
  - `app/_ui/AllianceStatement.test.ts` (6 tests): open, by application with one seat, full above the cap, plain text with HTML escaped and no link, a long text clamped with Show all, and no statement and no read.
- Local production build (`next build` + `next start`), local Postgres (51 migrations) with the seed and invented statements for five alliances: long, open, fallback, no statement, no response. No upstream call was made: the API base pointed at 127.0.0.1:9.
- Screenshots of 5 states × 360/640/1280 × light/dark × EN/PT-BR, with Show all opened: 64 PNGs. The checks: 0 horizontal overflow at every width; Show all is 44 px tall; the clamped text is 144 px (6 × 24 px lines) and expands to 288 px at 360; `aria-expanded` toggles; no card for the alliance without a response; the RSC payload carries only the card's fields.
- Persona panel (a player from another alliance, the alliance's R5, product strategy): SHIP WITH FIXES.
  - Applied: requirements marked as minimums (`8.00M+`, `HQ 14+`), and "Full (101/100)" instead of "0 seats open".
  - Declined:
    - The "day.…" ellipsis after a full stop is the browser's line-clamp, and changing it would need script truncation.
    - A Stale mark on the fallback date: "Stale" means upstream data over 20 minutes old here, and the date already says which day.
    - Counting blank lines out of the six: the clamp is visual.
    - "The viewport shot shows it open": the script took that shot after pressing Show all.
- The diff was checked against 127 names from the OGs fixture rosters: 0 hits. The fixture's real statement is not copied.

## Open issues

- Follow-ups (not built):
  - translate the statement on request (Groq; the issue scopes it out);
  - tappable links in the statement (the issue says not clickable);
  - the card on `/alliances/[id]/history`.
- The clamp's server guess (32 characters a line) can miss a short CJK text that runs past six lines at 360. Such a text shows in full, never cut without a button.
- `IMPLEMENTATION_PLAN.md` line 31 still says "`declaration`/`bulletin` not shown in v1", and line 197 lists them as dropped from `raw_json`. D128 supersedes both. I did not edit the plan.

## Next

- Model/effort: keep. This was a contained feature.
- Owner first: nothing to set up. After the next daily read (23:37 server time), open an alliance page whose alliance has a statement and check the text and the date.
- Plan change: §6 (raw_json trimming) and the "not shown in v1" line, as D128 says. Not edited here.

<adjustments>
- `daily_rosters.raw_json` holds `declaration`/`bulletin` only from the first daily read after this deploys. Older rows have none.
- Real `language` values seen: `en`, `ru`, `de`, `all`. Real `join` values: `power` 0 to 20M, `castle_level` 0 to 22. Real statements are 0 to 756 characters, with `declaration` and `bulletin` identical in every fixture.
- `app/(pages)/events/[id]/alliances/[unionId]/page.tsx` is at 274 counted lines (no blanks or comments) out of the 300-line lint limit.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/488
