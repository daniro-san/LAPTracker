# feat/713-callouts: an alliance's own line at the top of our posts

Part of #713 (part B, callouts). Size M: a migration, a new decision, a change to what reaches Discord. Plan: `.specs/features/713-callouts/plan.md`. Decision: D156.

## Built

- `lib/post-callout.ts` (pure): `CALLOUT_LIMIT` 120, `calloutLength` (graphemes, `Intl.Segmenter`), `cleanCallout` (one line, single spaces, control characters, zero-width spaces and direction marks removed, the zero-width joiner kept, trimmed), `discordCallout` (`escapeDiscord`, then `#` / `-#` at the start, `://`, `discord.gg/` and `discord.com/invite`, `<#` and `</` broken with a backslash or a zero-width space), `withCallout`.
- Table `workspace_post_touches(workspace_id, post_key, callout, updated_by, updated_at)` in `lib/schema-discord.ts`, primary key `(workspace_id, post_key)`, `post_key` in `shield`, `thanks`, `garrison`. Migration `drizzle/0072_workspace_post_touches.sql` (generated).
- `lib/repo/post-touches.ts`: read all, read one, `liveCallout` (only while `post_callouts` is on; used by the tick's Raid Shield summary), `saveCallout` (an upsert that writes nothing when the text is the same).
- `lib/private/post-callouts.ts`: `calloutsView` (the card's rows; null with the switch off; the shield row only with `shield_check` on, the garrison row only with `garrison` on), `saveCalloutFor` (switch, 120 graphemes after cleaning, 30 saves per 15 minutes per workspace), `postCallout`.
- Posts: `lib/shield-post.ts` (`withCallout` before the hash, so a changed line or the switch turned off shows in the next edit), `lib/private/thanks.ts` and `lib/private/garrison-post.ts` (through a new `lead` argument of `discordMessages`, above the bold title, or above the text in a forum post). Notices are unchanged.
- Route `POST /api/w/[slug]/callouts {post, callout}`: officers only, codes `turned_off` 403, `too_long` 400, `rate_limited` 429; `ws_action` `post_callout` / `save` only when the line changed. Fixture in `member-session.test.ts`.
- Alliance settings: card "Your line on our posts" (`app/(private)/_ui/PostCallouts.tsx`) after Discord, one labelled group per post with a where-line, the field, "n of 120 characters" and "Preview of the next post"; one Save row. "On this page" index row "Your line on our posts · n of 3 set".
- Switch `post_callouts` in D134's catalog (Discord group), names in EN, PT-BR, FR and on /admin.
- Home activity: `lib/repo/desk-activity-callouts.ts` (a new small source) and the words "{who} changed the line on the Raid Shield summary / weekly thanks / garrison post" in EN, PT-BR, FR.
- D125: the table is in `WORKSPACE_TABLES` as `post-callouts.csv` (downloaded and deleted with the workspace), with its README line in EN, PT-BR, FR.
- Words: `lib/private/dictionary.callouts.ts` (EN, PT-BR, FR), spread into the settings dictionaries.
- Docs: D156, dated amendments to D108, D114, D121, D125, D134, D137, D147, the decisions index, the tracking plan's row and Changed line.
- Tests: `lib/post-callout.test.ts` (fast-check: nothing pings, links or makes a heading), `lib/private/post-callouts.test.ts` (save, read, the 120 boundary with an emoji, the Home line, switch off), one new test each in `lib/private/thanks.test.ts`, `lib/private/garrison.test.ts`, `lib/shield-post.test.ts` (the built Discord payload), `app/(private)/_ui/PostCallouts.test.ts` (render). The purge and download tests now see a seeded row (`lib/workspace-seed-parts.test-helpers.ts`), and `settings-index.test.ts` has the new row.
- E2E `e2e/desk-callout.spec.ts` (phone only, on the repeat's filler workspace): the officer saves the garrison post's line, it survives a reload, the garrison plan posted to the stub's leaders webhook opens with it (`@everyone` broken, `allowed_mentions` empty, no private field), and Home names the change without the text. The seed gives each filler workspace a weekly Undead Siege Lv.6 (`SIEGE_ENTRY` 60 + repeat).

## Decisions

- Notices take no line: a notice is the officers' own text from title to end, not a template of ours; officers can already put any line at its top in each language; one standing line would sit above unrelated notices.
- The members' board's thank-you card takes no line; only the Discord post does.
- No links at all in the line, not even invites or channel mentions (adversarial review).
- The word "line" on the card and on Home instead of "callout" (persona check). So Home reads "Ana changed the line on the Raid Shield summary", not the task's "Ana changed the Raid Shield callout".
- The line is downloaded with the alliance's data. D125 downloads every table the workspace owns except secrets, sessions and the owner's switches or codes; the line is the officers' own words, like Start here.
- `post_callouts` spends nothing, so it is allowed and on by default for every alliance (D134's free features).
- The e2e flow uses the garrison post, not the thanks: the thanks' share button shows on Home only on Sunday or Monday or with a week's progress, which the filler workspaces do not have, and the stub has only the leaders' channels.

## Deviations

- The activity wording differs from the task's example (see Decisions; persona check).
- Renumbered after #717 (`feat/306-opponent-tags`) took migration 0071 and D155: rebased onto that branch (a temporary base until #717 is squash-merged into dev), the migration regenerated as `0072_workspace_post_touches` (`prevId` chained to 0071's snapshot), and the decision renamed D156 in every reference of this branch.
- The table keeps one row per post, as specified, so Home shows only each post's latest change. An earlier officer's change is not kept once another officer changes the line.

## Verified

- `pnpm vitest related --run <changed files>`: 220 files, 1,221 tests passed.
- `pnpm check`: passed (356 test files passed, 2 skipped; drift and i18n clean).
- After the rebase onto #717 and the renumbering: related tests 195 files, 1,116 tests passed; `pnpm check` passed (357 files, 1,901 tests passed, 4 skipped; no drift); `e2e/desk-callout.spec.ts` on a fresh build passed on phone (wide skipped by design), no `e2e-outbound.log`.
- E2E on my own cluster and ports (Postgres 18 at `127.0.0.1:54420/lap_e2e`, app 3577, bridge 54477, https 3578, stub 3579), full suite on a fresh build of the final tree: 75 passed, 7 skipped (the new test's wide run is one of the skips), no `e2e-outbound.log`.
- Mutation check: `garrison-post.ts` posting without the line makes the garrison payload test fail; reverted.
- Persona check at 360 × 780 on the real card (D156 § Persona check): three officers, an adversarial reviewer and a designer each answered their question right from the first screen. Adopted: "line" not "callout", no links, notices left out, and the lead's "It stays on every post until you change it, so keep it about the whole alliance."

## Open issues

- A history of every line change (who wrote what, before another officer changed it), if the owner wants a full trail.
- The garrison page and the thanks sheet do not preview the line before posting; only Alliance settings does.
- Existing gap, not from this change: the purge job does not delete the `shield:ws:<id>` rate-limit counter of D137 (nor this change's `callout:ws:<id>`); both expire with their 15-minute window.

## Next

- Part C of #713 (the catalog framework and post 1) adds its own `post_key` to `POST_KEYS`, the table's check constraint (a migration) and a field on the card.
- Follow-up: the history of line changes (above), if asked.

What was missing from the task prompt? Which post the stub can trigger end to end: the thanks share needs a members' channel and a weekday or progress the filler workspaces lack, so the e2e uses the garrison post.

PR: (added by the orchestrator)
