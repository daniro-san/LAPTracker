# 08zzzzm — Power balance of the server and a bloc builder

Refs #283.

## Built
- `lib/balance.ts`: pure arithmetic. `shares`, `topShare` (top 3), `parseBlocs` / `tap` / `blocQuery` (blocs in the URL, an alliance in at most one bloc), `blocFigures` (share, might, members), `concentration` (top share per day).
- `lib/queries/balance.ts` (`powerBalance(db, now)`): each alliance's might from its newest usable daily roster in the last 90 days, and the top-3 share per complete day. Reads `total_power`, `member_count`, tag, name and badge id only.
- Page `/alliances/balance` (`app/(pages)/alliances/balance/page.tsx`, `app/_ui/BalanceBar.tsx`, `app/_ui/BalanceRows.tsx`):
  - the first sentence ("No alliance holds more than 8% of the server's might; the top 3 hold 22%."), a line saying might includes buildings and tech, and the server might next to the stacked bar;
  - the stacked bar (HTML boxes, D68), one box per alliance, plum for bloc A, yarn for bloc B;
  - the bloc builder: two cards labelled "Hypothetical" (share, might, members, alliances, tags), empty by default;
  - the alliance list: share and might per row, and two GET links, A and B (44 × 44 px), that add, move or remove the alliance (`?a=1,2&b=3,4`); a sticky line keeps both blocs' shares in view;
  - the top 3's share over time: the first chart's line, a sentence with the first and last values, a Details table.
- Link "% Server balance" in the title row of the home and event pages (`BalanceLink` in `app/_ui/ComparePicker.tsx`, `EventView.tsx`).
- `lib/copy-balance.ts` (27 keys as `copy.balance`), 17 languages translated and stamped; `sharePreciseText` in `app/_ui/format.ts` (one-decimal share).
- D85 in `docs/decisions/` and its line in the README.
- Tests: `lib/balance.test.ts` (10, with fast-check properties), `lib/queries/balance.test.ts` (3, PGlite).

## Decisions
- **Event rosters do not count.** Daily reads give every alliance on one server day; an event's Start and End are read at different minutes and the daily read is skipped on an event day (D60). The trend has a gap on those days. Recorded in D85.
- **Placement:** a public page `/alliances/balance`, linked from the title row of the home and event pages, not from the header (the header is full at 360 px).
- **A trend day counts only when every alliance of the current list has a usable roster that day.** Otherwise a smaller server would be compared with a larger one.
- **An alliance whose newest usable read is on an earlier day than the newest day shows "as of <date>"** on its row; its might still counts.
- **The lead's "more than {max}" is the greatest share rounded up to a whole percent**, so it stays true (8.7 % reads "9%"). The top-3 figure is rounded to nearest.
- **The tap links keep the page position** (`scroll={false}` and `#alliance-<id>`), and a sticky line shows both blocs' shares, so a tap's result is never off screen.
- **A URL with blocs is `noindex`.** Unknown, malformed and repeated ids are dropped; an alliance named in both blocs stays in A.
- **The stacked bar has no labels in its boxes** (smallest box about 7 px at 360 px); the list under it is the legend.
- **Bloc colour is not the only cue:** the cards carry "Bloc A / B" text, and the row's tap shows a check mark.

## Deviations
- The page is not behind the header's links. The task allowed "header or the alliance pages"; the title row of the home and event pages was used instead.
- Not pushed and no PR opened (the worktree sandbox blocks `git push`); the orchestrator does it. The PR URL line is left out.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest (508 passed), drift and i18n ("17 languages up to date with English") green.
- Local run (local Postgres from `pnpm db:local:*`, seed with 20 alliances and 12 daily reads, no upstream call): `/alliances/balance` and `?a=…&b=…`. One alliance renamed `TmSLONG` / `Ünbelievably Long Allianz Nam Without Any Break` in the local database only.
- Chrome, no horizontal scroll (`scrollWidth` equals the viewport) at 360, 412, 768 and 1280 px, light and dark; every A and B tap measured 44 px or more at 360 px; a tap kept the user at the row.
- Screenshots: `docs/screenshots/08zzzzm-balance-360-light.png`, `docs/screenshots/08zzzzm-balance-360-dark.png`, `docs/screenshots/08zzzzm-balance-1280-light.png` (blocs A and B set, the long name in bloc B).

## Open issues
1. **The trend is flat in the seed (22.2 % on every day)** because the seed grows every alliance by the same share; the line's shape was not seen on real data. The real figures came from the production history API only in the issue text (21.5 % on 11-05, 23.8 % on 11-16), not from this build.
2. **Daily reads exist from the first read day only**; until about two complete days exist the trend says "Not enough daily reads yet".
3. **Total is the tracked alliances' might, not the whole server's.** The page says "Server might"; the 58.5 B in the issue is the same sum.
4. **The glossaries of it, tr and ko have their table twice** (pre-existing, found by the translators; not changed).
5. **The seed script needs the WebSocket bridge** (`pnpm db:local:bridge` in a second shell) and a `.env.local` with the required variables; `pnpm db:local:seed` alone fails with "Failed query". Not documented where the local steps are listed.
6. **`next dev` in a worktree needs dummy values for every required variable** (`LAP_API_KEY` starting `lap_`, `CRON_SECRET` of 32+ characters, and the schedule variables).

## Next
Session: none queued for this track in `docs/SESSION_PLAYBOOK.md`; #280 and #282 are other builds.
Model / effort: keep. No signal that this work needed more.
Owner must do first: merge into `dev`; after the first real days of reads, look at the trend line on `/alliances/balance` and confirm the wording of the lead sentence.
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- `lib/balance.ts` holds the shares, top-3 and bloc arithmetic; a later "share needed for kingship" or a per-alliance trend belongs there, over the same `powerBalance` rows.
- Copy for this page is `lib/copy-balance.ts`; a new key there needs the translate-copy skill (27 keys today).
- Event rosters were left out on purpose (D85); do not add them without a rule for the event-day gap.
</adjustments>
