# 08zzzzc — Discord: members with kills gained in the End picture (#276)

Closes #276.

## Built
- **Picture** (End only, after the existing sections): a section "Members with kills gained" with a skull mark, then one row for each of the first 4 alliances of `memberTurnout().withKills`: the tag (bold), a bar, and the figure as text, `54 % · 54/100`. Under the rows, one line: "Highest top 5's share of kills" on the left and `[tag] 98 %` (bold) on the right, taken from `topShare[0]`. The block is drawn only when `turnout` is not null. The Start picture ignores `turnout`.
  - Bars are two nested flex `div`s (a `rule` track, a `yarn` fill whose width is `gainers / n`); the text is HTML, not SVG. Colours come from the tokens the picture already reads.
  - The block adds 211 CSS px (422 px at 2×): the End picture is now 360 × 814 CSS px (720 × 1628 px) for 6 ledger alliances; it was 720 × 1206.
- **Split of `lib/event-image.tsx`** (it passed the 300-line lint limit): `lib/event-image-parts.tsx` (scale, row and section heights, `Colors`, `drawable`, `label`, the section heading; moved, not changed) and `lib/event-image-turnout.tsx` (`TurnoutRow`, `turnoutBlock`). `drawable` is still exported from `lib/event-image.tsx` for its test.
- **Data**: `notifyPublic` in `lib/run-notify.ts` calls `memberTurnout(db, detail.snapshots)` through `endTurnout` for the End phase only, and passes the result to `eventImage` (new optional `turnout` on `EventImageInput`) and to `publicSnapshotMessage` (new optional `turnout` on `PublicContext`). A throw logs `notify.turnout_failed` with the event id and gives null, so the message and picture go out without the block. No arithmetic is repeated: the shares come from `gainers / n` and `top / gained` of the existing rows.
- **Text**: one line after the stale line, `Most members with kills gained: [OGs] 54 %`, from `withKills[0]` (`turnoutLine` in `lib/notify.ts`, `shareText` in `lib/discord-format.ts`). It is written whether or not the picture drew, so the figure reads when the picture does not load. The link preview stays suppressed (angle brackets, unchanged). The picture's `description` (alt text) is now "The event's ledger by Might, its top gains and the members with kills gained".
- **Words**: `copy.discord.public.turnout`, `copy.discord.image.turnout`, `copy.discord.image.topShare` in `lib/copy-discord.ts` (English only, D48).
- **Tests**: `lib/event-image.test.ts` (the End is 422 px taller with turnout, equal height with null and for the Start; no network), `lib/notify-event-message.test.ts` (the text line, and none for null), new `lib/run-notify-turnout.test.ts` (the End's picture input and message get the turnout when `memberTurnout` returns one, and null and no line when it returns null). The existing alt-text assertion was updated.
- **Screenshots**: `docs/screenshots/08zzzzc-turnout-after-720.png` (real size), `docs/screenshots/08zzzzc-turnout-after-400.png` (the same picture scaled to 400 px wide, as a phone shows it).

## Decisions
- **4 rows, not 5.** The End picture was already 603 CSS px tall; each row costs 35 px. 4 rows plus the concentration line keeps the growth to 211 px and leaves a clear order (the four largest shares). The constant is `TURNOUT_ROWS` in `lib/event-image-turnout.tsx`.
- **The concentration line is included.** It fits on one line at 17 px with its label. "Highest" is in the label so the reader knows why one tag is shown; the wording is "Top 5's share of kills", with no blame word.
- **Whole percent with a space (`54 %`)**, as the issue writes it. The event page uses the locale's `54%`; Discord has one fixed English format (`lib/discord-format.ts`).
- **The text line is not tied to the picture.** `publicSnapshotMessage` writes it whenever it gets a turnout, also in the text-only fallback.
- **Alliances without a drawable tag** show their drawable name, else the union id (`label` in the parts file), the same rule as the ledger rows.
- **Ordering and ties** come from `memberTurnout` (larger alliance, then lower union id); the picture does not re-sort.
- **Skull mark** for the section: the same mark as "Kills ▲". No new drawing.

## Deviations
- 4 rows where the task says about 5 (Decisions 1).
- The picture and the text are not sent anywhere in this session: no webhook was called.
- `pnpm check` forced the module split and moving the two new text/data steps into functions (`turnoutLine`, `endTurnout`) to stay under the complexity limit of 12.
- Not pushed and no PR opened, on the coordinator's instruction (the sandbox blocks `git push`); the orchestrator pushes and opens the PR.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (61 files passed, 1 skipped; 281 tests passed, 1 skipped), drift ("Everything's fine"), i18n ("17 languages up to date with English").
- Rendered the End picture with `next/og` (the project's own `renderEventImage`, run with `tsx`, no network) for a synthetic event: 6 alliances, shares 100 %, 54 %, 48 %, 41 %, 34 %, 12 %, top-5 shares up to 98 %. Real size 720 × 1628 px; read at full size: the figure `100 % · 100/100` fits on one line (it wrapped in a first draft with a 122 px column and was widened to 138), bars are aligned, the concentration line is not clipped. Scaled to 400 × 904 with sharp 0.35.5 (the copy that ships with Next): all text including the figures and the concentration line stays readable. The same input with `turnout: null` renders the earlier 720 × 1206 picture.
- Not checked: a second renderer. `next/og` rasterises inside its own WASM; sharp was used only to scale the PNG. No separate sharp-or-resvg render of the SVG path exists in the repo's tests, so none was run.
- Not run: a real send to a Discord channel (zero webhook calls by rule); how Discord's own client shows the 814 px tall picture.
- One test in `app/(pages)/admin/gate.test.ts` ("/admin/runs/<unknown id> still calls notFound") timed out at 10 s in 4 of 6 full-suite passes on this machine and passed alone and in the other two full passes. The file is not touched by this change.

## Open issues
1. **`app/(pages)/admin/gate.test.ts` is slow on a cold import** and can hit the 10 s test timeout when the whole suite runs at once (pre-existing, not touched).
2. **The End picture is 814 CSS px tall.** Discord shrinks tall attachments in the channel list until the reader taps them. If the owner finds it too tall on a phone, lowering `TURNOUT_ROWS` to 3 or `LEDGER.after` to 3 saves 35 px per row.
3. **`memberTurnout` now runs a third time per event** (the event page already runs it and `memberMovers` reads the same member rows). One read at the End only; merging the reads stays a follow-up from `08zzzy-who-fought.md`.
4. **D58 and DESIGN.md still describe the End picture without this block** and say charts are out of v1. Neither was edited (not asked). The D58 "The pictures" paragraph and DESIGN.md "Discord event picture" need one sentence each.
5. A member who switched alliance during the event is in neither alliance's figure (from #271); the picture inherits this.

## Next
Session: 9, the dry run (docs/SESSION_PLAYBOOK.md, "Session 9 — Dry run against production").
Model / effort: keep (opus / high). The numbers to measure are unchanged; this session added no collector or quota code.
Owner must do first: merge this PR into `dev`; pick a weekday that is not Friday or Saturday for the dry run; say whether the 814 px tall End picture is acceptable on a phone (Open issues 2).
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md`; D58 and DESIGN.md "Discord event picture" need one sentence about the turnout block (Open issues 4).

<adjustments>
- The dry run posts to the admin webhook only (an `is_test` event), so it never draws or sends the public End picture: the turnout block and the `Most members with kills gained` line are not exercised by Session 9. First real check is the first Saturday's End message; look at the picture and the text line there.
- `notifyPublic` now reads `memberTurnout` once per End run (one query over the event's member rows, about 2,000 rows per snapshot pair). Add it to the timings in step 2 only if the End notification looks slow; it runs after the snapshot row is final, so it cannot affect `calls_used` or quota.
</adjustments>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://github.com/daniro-san/LAPTracker/pull/291
