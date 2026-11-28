# feat/830-link-previews

## Built

- `lib/link-card.tsx`: a 1200 × 630 link preview card drawn by `next/og`. It has a plum band with `MarkLine` and the site name, then the page's name, one line under it, and either up to 4 figures (label, value, change or rank) or an event's first 5 ledger rows. The yarn corner sits bottom right. Fonts and colours come from `lib/brand`, and text goes through `drawable`. The card carries no badge, photo or URL. `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=3600`.
- `app/_ui/link-card-facts.ts` builds the cards from the facts each page shows (`playerCard`, `allianceCard`, `eventCard`, `boardCard`) and turns them into the og:description line (`cardText`).
- Four routes read the public shared cache (D143) only and make no upstream call. A malformed or unknown id gets the bodyless `/img` 404. A URL with any query string gets a 308 to the same URL without it (`canonicalRedirect`), before anything is read or drawn, so a made-up `?v=` cannot force a render.
- The alliance-in-an-event card's rank is the page's: the End's rank by might, else the Start's (the summary band and og:description use the same rule).
  - `/img/card/player/[uid]`: the player page's `player` entry. That read moved from the page into `sharedPlayer` in `app/_ui/public-reads.ts`, so the page and the card share it.
  - `/img/card/event/[id]`: the event page's entry (`loadEventPage`), through the new `eventCardRows` in `app/_ui/event-page.ts`.
  - `/img/card/event/[id]/alliance/[unionId]`: the same event entry, the alliance's row.
  - `/img/card/alliance/[unionId]`: a new `alliance-card` entry (newest tag and name, ranks board row).
- Metadata on `/players/[uid]`, `/events/[id]`, `/events/[id]/alliances/[unionId]` and `/alliances/[unionId]/history`: `cardPreview` (`app/_ui/preview.ts`) sets og:title, og:description, og:image (with width and height), and `twitter:card summary_large_image` with the same title, text and image. It replaces `previewImage` (the square badge or framed photo), which is removed.
- The brand font loader moved from `lib/event-image.tsx` to `lib/event-image-parts.tsx` (`loadFonts`), so the Discord picture and the cards share it.
- D164 is added to `docs/decisions/` and indexed.

## Decisions

- Route handlers under `/img/card/...`, not the `opengraph-image.tsx` file convention. A route handler sets its own Cache-Control, sits with the other `/img` routes (deny-all CSP in proxy.ts), and the file convention's og:image alone does not set `twitter:card summary_large_image`, which Discord needs to show the large picture.
- The picture is drawn in English ("en" labels and numbers), because one cached picture serves every viewer. The og text follows the page's language, through `requestCopy` / `requestLocale`.
- No new public strings: the labels are existing `copy.ledger` keys (Might, Kills, Members, Level, Rank). So translate-copy was not needed, and `i18n-check` passes.
- The event card's text names the top 3 rows. The picture shows 5.
- The alliance page card (`/alliances/[unionId]/history`) shows the ranks board line's Might and Kills with their board rank. It shows nothing for an alliance that is off the board, because the page shows nothing either.

## Deviations

- PR #837 (`/alliances/[unionId]`) was not in dev when this branch was cut. Per the task, the card covers the alliance history page and the event alliance page. `/img/card/alliance/[unionId]` is ready for the new page's metadata.
- D65's `/img/preview/player/[uid]` is no longer linked from any page. It was left in place, not deleted (D164 point 5).

## Verified

- `pnpm vitest related --run` on the changed files: 17 files, 103 tests passed. After the review fixes: 1 file, 5 tests passed.
- `pnpm check`: exit 0. After the review fixes: 403 files passed, 2 skipped; 2212 tests.
- New tests in `app/img/card/routes.test.ts`, with a tick-seeded event on PGlite:
  - Each of the four routes returns a 1200 × 630 PNG with the Cache-Control above, and its card data holds the page's facts. For the event: rows, rank, Might and change. For the alliance: Might, Kills and Members with change, and Rank. For the player: name, alliance, Might, Kills and Level. For the board: Might #4, Kills #7.
  - No card holds a blocked roster key or the seeded `last_online_at` value. This test draws its own four cards. The seeded raw member rows carry `online`, `last_online_at`, `x` and `y`.
  - A malformed uid, an unknown uid, an unknown event id, an alliance that is not in the event, and an unknown alliance each get a 404 with an empty body, and nothing is drawn.
  - `?v=123` and a bare `?` get a 308 to the URL without a query string, and nothing is drawn.
  - The player page's `generateMetadata` sets og:image to `/img/card/player/[uid]` (1200 × 630), the facts as og:description, and `twitter:card summary_large_image`.
- Rendered locally with invented data (not committed), in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/830/`: `event.png`, `alliance.png`, `player.png`, `board.png` (53–75 KB each). The script is `render.mts` in the same folder.
- Not checked: a real paste into Discord. That needs a deployed URL.

## Open issues

- `/img/preview/player/[uid]` and its test are now unused. Removing them needs an owner decision (D65).
- The og:image URL has no version, so Discord can show an older card for a link it already unfurled. Discord caches by URL. The CDN copy expires after 5 minutes.
- The alliance page card reads the tag and name from the board, else from the name history. The history page's title reads them from its roster history. The two agree in practice, but they come from different reads.

## Next

- When PR #837 merges: give `/alliances/[unionId]` the same `cardPreview(`/img/card/alliance/${unionId}`, …)`. If that page shows growth (a change), extend `boardCard`, or add a builder that uses the page's figures.
- Paste a production link of each page type into Discord after release, and check the large card and the text.
- Owner: keep or remove `/img/preview/player/[uid]`.

What was missing from the task prompt? Whether the large card should replace the existing small badge or photo previews (D22, D65), or sit beside them. I replaced them, because a chat app shows one picture.

PR: (added by the orchestrator)
