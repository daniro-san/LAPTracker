# feat/713-webhook-look: part A of #713

## Built
- Each channel card in Alliance settings → Discord (leaders, members, Raid Shield) has a visible help line, key `discord.channel.look`, in EN, PT-BR and FR: "Posts show this webhook's name and picture. Change them in Discord: Server Settings → Integrations → Webhooks."
- The board's thank-you card (D114) shows the alliance's emblem beside the officer's signature, through `AllianceBadge` and `/img/badge/[id]` (D22). It shows nothing when the alliance has no badge id.

## Decisions
- `git grep` found no post that sets `username` or `avatar_url` (lib/notify.ts says so in a comment), so the help line is true.
- The badge id was already on `BoardAccess.alliance.badgeId` (from `alliances.badge_id`). The card did not show it. No new query, no new field served.
- `BoardThanks` takes an optional `badgeId` prop; the board page passes `alliance?.badgeId ?? null`.
- The badge is left out when there is none, rather than showing the drawn placeholder, so a card without a badge looks as before.

## Deviations
- None.

## Verified
- `pnpm vitest related --run` on the four changed source files: 78 files, 411 tests passed.
- New tests: `DiscordChannels.test.ts` (help line on all three cards), and one case in `BoardThanks.test.ts` (badge on the card, absent without an id).
- `pnpm check`: see the PR.
- The desk e2e has no flow for the Discord section or the board card, so none was changed.

## Open issues
- None.

## Next
- #713 part B (callouts) and the later parts, as listed in the spike comment. Part B opens a one-way door (new table), so its plan goes to the owner first.
- Real-Chrome check of the card at 360 px with a badge is not done here.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
