# 11ae — Share the thanks (issue 404, D114)

Includes the owner's two additions of 2026-11-17: the Sunday and Monday nudge, a Monday post covering last week, the card's lifetime, "weekly appreciation" wording, and a Take down that leaves no trace on the board.

## Built
- **Weekly baseline** (`lib/private/fact-trend.ts`). `progressOf` compares the newest value saved in the week with the last value saved before Monday 00:00 ST. Versions saved after the week are not read. `weekBase` gives the card the same baseline: "+600K this week" / "+5 points this week" when the newest version is from this game week, else "+400K since Nov 10" as before. The card's trend words moved from `member-card.ts` to `lib/private/trend-words.ts` to keep that file under its line limit.
- **Which week** (`thanksWeek`, `appreciationDay`). Tuesday to Sunday: this game week. Monday: last week. The Members and Home thanks lists use it too (`membersView`).
- **Share the thanks** (`ShareThanks.tsx`, `ShareThanksPick.tsx`, `ShareThanksEdit.tsx`, `share-thanks-data.ts`). A secondary button under "Worth a thank-you" on Members (`MembersThanks.tsx`, moved out of the page) and on Home (`HomeMembers.tsx`, moved out of the page).
  - Step one: the week's list, all ticked, with what each person did; "Add someone else" searches the roster.
  - Step two: EN, PT and FR, one at a time, the officer's language first, freely edited, with "n of 1000 characters".
  - Then: Copy for the game (`gameNotice`, cut at 1,000), Post to Discord, Post to the members' board.
- **Writing help** (`lib/ai/thanks-writing.ts`, `POST /api/w/[slug]/thanks/draft`). A dedicated warm prompt through D81's model. People are placeholders `{1}`, `{2}` with their deed in the target language. No names and no digits reach Groq. Names are put back after the answer. A missing or invented placeholder counts as a failure. One call per language, all three at once. Without `GROQ_API_KEY` the button reads "Write it yourself".
- **Sharing** (`lib/private/thanks.ts`, `POST /api/w/[slug]/thanks`, actions `share` and `take_down`). Discord uses D102's message loop (`postMessages`, now exported from `notice-publish.ts`) on the `members` channel, with `allowed_mentions` empty, once per request id. The board share is recorded at once.
- **Record**: `thanks_shares` (who, when, week, texts, names, target, status) and `thanks_takedowns` (who, when), both append-only (the Discord status is the one update, as in `notice_publishes`). Migration `0039_thanks_shares` from `pnpm db:generate`.
- **Board card** (`BoardThanks.tsx`, `ThanksTakeDown.tsx`). Shows the newest board share until the next one or a Take down, under the board's lead. Drawn frame in yarn, warm paper tint, wax seal on the corner, the yarn ball beside the signature, letter in Alegreya. The text is in the viewer's language with D105's tabs and tag. Signature "With love, {officer}". Take down asks first; afterwards the board renders exactly as with no thanks.
- **Home**: "Time for the weekly appreciation post" on Sunday and Monday until the week was shared on Discord or the board (`thanksNudge`). The share table is only read on those two days.
- **Activity feed**: "Ana shared the thanks on Discord", "… on the members' board", "Ana took the thanks down from the members' board".
- Words in `lib/private/dictionary.share.ts` (EN, PT, FR), plus the "this week" card keys and the three feed lines.

## Decisions
- D114 (new). D109 and D105 each have a dated amendment (2026-11-17). DESIGN.md gains the "Note card" line and records the card as the one card allowed an ornament.
- Names never go to Groq: placeholders instead. This keeps D81's rule ("no name list can reach a request") while the post still names people.
- "Stays until next week's thanks" is read as "until the next board share, whatever week". A Take down hides the newest share; an older one never comes back.
- The nudge counts Discord or board shares only. Copy for the game is not recorded, so a copy-only share leaves the nudge on until Tuesday.
- On a Monday the thanks list on Members and Home also switches to last week, so the box and the sheet agree.
- A person with no week value (first-ever value, even with a second one in the same week) is not thanked (D75); the card then still shows "+X since {date}".

## Deviations
- The issue says "Reuse the D102 publish code": the loop is reused; the claim and record are a separate table (`thanks_shares`), because `notice_publishes` requires a notice id.
- Officers add someone by roster search (name key), not from a full list, to keep the sheet short at 360.
- No 30-second cooldown between two Discord shares of the thanks (D102 has one for notices). Each share is once per request id only.

## Verified
- `pnpm check` exits 0 on the branch rebased onto dev at 5c264cd8 (#406): 184 files, 971 tests passed (4 skipped); drift fine; i18n "17 languages up to date".
- New tests:
  - `lib/private/fact-trend.test.ts`: two saves in one week count against the week start (10.0 → 10.3 → 10.6M is +6 %); the ST boundary (01:00Z Monday is last week); a first-ever value is not thanked; Monday covers last week without Monday's own saves; the card says "+600K this week", then "+300K since Nov 16" a week later.
  - `lib/private/thanks.test.ts` (4): the prompt carries no number and no name (names come back after); the copy for the game is within 1,000, cut after a whole line; Discord posts once per request id with `allowed_mentions` empty and mentions broken; the nudge on Sunday and Monday only, gone after a board share.
  - `app/(private)/_ui/BoardThanks.test.ts` (1): a member sees the card in PT with the signature and no Take down; the officer preview has Take down; after Take down, `view.thanks` is null and the card renders as "" for a member and in the preview, and the older card does not come back.
  - `lib/private/desk-activity-feed.test.ts` (+1): the two share lines and the takedown line; a failed Discord post is not a line.
  - `member-session.test.ts`: fixtures for `thanks/route.ts` and `thanks/draft/route.ts`; both refuse no session and a member with `401 signed_out`.
- e2e on a local production build (:3957), local Postgres 18, an invented 40-member roster, stand-ins for Discord sign-in, the webhook and Groq (loaded with a preload, so nothing left the machine): **35 of 35 checks pass**. They cover:
  - the thanks: Fennick, Isolde and Juniper are named, Marlow (+4 %) is not; Fennick's card says "+600K this week";
  - the sheet: three people start ticked, Bramble added, the draft names all four; the Groq stand-in got 3 requests with no name and no number; the PT draft is Portuguese;
  - Copy for the game: 564 characters, ending with the officer's edit;
  - Discord: one message to the members channel, `allowed_mentions` `{"parse":[]}`, EN, PT and FR in it, the button rests after posting;
  - the board share, then the Home feed lines; no nudge on a Tuesday;
  - the member's card in EN and PT, light and dark: right language, no number, no Take down, no sideways scroll;
  - Take down in the preview: the card is gone; the member sees no card and no message; the feed line appears.
- Privacy grep of the diff against the 101 names of the OGs fixture: 0 hits.
- Screenshots (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ae-shots/`: `board-card-360-{light,dark}-{en,pt}`, `board-{360,1280}-{light,dark}-{en,pt}`, `board-card-preview-360-light-en`, `board-takedown-ask-360-light-en`, `board-after-takedown-360-light-en`, `share-{pick,edit,done}-360-light-en`, `share-edit-360-light-pt-tab`, `share-{pick,edit}-360-dark-pt`, `members-360-light-en`, `card-trend-360-light-en`, `home-360-light-en`.
- Designer pass: the first card left the bottom-left corner empty, and a second sign-off typed into the text repeated the signature. I added the yarn ball beside the signature, and the e2e now edits the closing line instead. Nothing overflows at 360.

## Review round 2 (PR 407)
The code review and a persona panel (the alliance leader, a member, a copywriter). D114's "Review round" section lists each change.
- **Rebase.** Onto dev at f7c163ab (#405). The migration is now `0039_thanks_shares` from `pnpm db:generate`, after dev's `0038_notice_reviews`. Conflicts kept both sides: Home now reads the review requests and the nudge together. In the feed, the thanks rows moved to `lib/repo/desk-activity-thanks.ts`, beside dev's `desk-activity-reviews.ts`.
- **Code review.**
  - The draft route counts three units against D101's `quota` and answers 429 `busy` past it.
  - Sharing the same week to the same place within 30 s answers 409 `recent`, with its own line.
  - A claim still `posting` after `STUCK_MS` counts as `failed`.
  - On a Monday the card compares with the thanked week ("+600K last week", `cardBase`).
- **Persona musts.**
  - The prompt is rewritten (first person, one varied thought per person, banned stock phrases, no invented events).
  - Each ticked person has an optional "A few words about them" field (80 characters). A person with no deed and no note gets a plain thank-you.
  - The textarea opens at the top and grows up to 60 % of the screen.
  - The members' board is the one filled button, then Discord and Copy, all full width.
  - The signature drops the rank tag and is in ink (15.9:1 in dark).
  - The seal is whole, the yarn ball is larger, the names are bold (Alegreya Sans bold, since Alegreya is loaded at 400 only), each person is on their own line with a gap, and Take down sits under the card.
  - The PT and EN button and help words are the panel's.
- **Nice-to-haves done.** "Draft it for me" / "I'll write it". A "Posted" line per channel, with only that button resting (as before). "Say thanks to" in its own block on Home and Members. "Everyone looks fine this week." is hidden on Home beside it.
- **Not done.** The board preview strip still wraps at 360 px (D105's own words).
- **Verified (r2).**
  - `pnpm check` exits 0: 185 files, 994 tests passed (4 skipped).
  - New or changed tests:
    - `thanks.test.ts` (9): no name or number, notes and "no reason given"; a dropped or invented placeholder rejects; names with `{1}` or `@here` survive the draft, the record and the Discord post; the copy limit; once per id with no pings; the 30 s cooldown; a failed post, then a retry with a new id, and a stuck claim; take-down refuses another workspace's share and a Discord share; the nudge.
    - `fact-trend.test.ts`: the Monday card ("+600K last week", and a Monday version belongs to the new week).
    - `BoardThanks.test.ts`: bold names and a signature without "(R4)".
  - Short e2e on a production build (local DB; Discord, webhook and Groq stand-ins, nothing real called): **28 of 28** checks pass. They cover "Say thanks to"; the new pick help; four note fields; Bramble's note used; no repeated line endings and no stock phrase; Groq got 3 requests with no name or number; the editor at the top and grown, and at the top after a language switch; board, then Discord, then Copy, with the board as the one primary; one Discord message with no pings; no sideways scroll; a second draft within the minute refused as busy; the second Discord post refused (cooldown); the card in EN and PT, light and dark: signed "Ana", names in bold, signature contrast 15.9:1; the PT panel words.
  - Screenshots: `r2-*` in `11ae-shots/`.

## Open issues
- The counter reads "319 of 1000 characters" without a thousands separator, as D102's "first 1000 characters" does.
- The nudge cannot be seen live on a Tuesday; the test covers Sunday and Monday.
- A first-ever value saved this week and then raised the same week shows "+X since {date}" on the card but gets no thanks (D75, as the issue asks).
- WebKit was not run this session.

## Next
- Model/effort: keep. The scope, including the owner's two additions, fit one session.
- What the owner must do first: merge; the release applies migration `0039_thanks_shares` (two new tables). No environment change: it reuses `WORKSPACE_DISCORD_WEBHOOKS` and `GROQ_API_KEY`.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- `progressOf(history, members, monday, zone)` now uses a weekly baseline and ignores versions after the week. Use `thanksWeek(today)` for the week the thanks cover; do not use `view.week[0]`.
- The card's trend words live in `lib/private/trend-words.ts`; `factLines` and `cardData` take a fifth/eighth argument `WeekBase`.
- `postMessages` (`lib/private/notice-publish.ts`) is the one Discord webhook loop; reuse it for any other post.
- Any new Groq prompt that must mention people should use the placeholder pattern in `lib/ai/thanks-writing.ts` (`writeThanks`, `withNames`), so no name reaches the model.
- The Members thanks box is `app/(private)/_ui/MembersThanks.tsx`, and Home's members box is `app/(private)/_ui/HomeMembers.tsx`. Both pages were at their line limits.
</adjustments>

PR: (added by the orchestrator)
