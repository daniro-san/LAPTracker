## D114 — Share the thanks: a weekly baseline, the weekly appreciation post (game, Discord, members' board) and a thank-you card on the board (2026-11-17, owner, 11ae, issue 404; amends D105, D109)

Why: the owner liked "Worth a thank-you" (D109) and asked to make it sharable and warm. The alliance leader writes a weekly appreciation post, mostly on Sunday and sometimes on Monday (owner, 2026-11-17).

**Weekly baseline** (D109 amended, see its amendment).

- Progress compares the newest value saved in the week with the last value saved before Monday 00:00 ST of that week (`progressOf`, `lib/private/fact-trend.ts`). 10.0M → 10.3M → 10.6M in one week counts as +6 %. Versions saved after the week are not read.
- No value from before the week (a first-ever value, even with a second one in the same week): not named (D75).
- The member card says "+600K this week" / "+5 points this week" when the newest version is from the current game week (today's server day) and a value from before the week exists (`weekBase`). Otherwise it keeps "+400K since Nov 10" against the version before. So the card and the thanks compare the same pair. Words in `lib/private/trend-words.ts`.

**Which week the thanks cover** (`thanksWeek`, owner, 2026-11-17).

- Tuesday to Sunday (server day): the current game week. A Sunday post covers Monday to Sunday.
- Monday: last game week, so the leader does not post an almost empty list. The sheet's title says "Last week's thanks · Nov 9 – Nov 15" and a line explains it.
- The thanks box's list ("Worth a thank-you") on Members and Home uses the same week, so on a Monday it shows last week's list.

**Share the thanks** (`app/(private)/_ui/ShareThanks*.tsx`, `lib/private/thanks.ts`).

- A secondary button, "Share the thanks", under the "Worth a thank-you" list on Members and on Home.
- Step one, "Who to thank": the week's list, all ticked, each with what they did ("grew their main squad"). "Add someone else" searches the roster (name key, D74); an added person has no deed. Only the people the officer ticks are named; nobody is listed as missing (D75).
- Step two: the post in EN, PT and FR, one language at a time (the officer's own first), each freely edited, with "n of 1000 characters".
- Nothing is posted until the officer taps one of the three ways.

**The writing help** (`lib/ai/thanks-writing.ts`, `POST /api/w/[slug]/thanks/draft`).

- D81's model (Groq) with its own prompt: a leader's weekly appreciation post, warm, heartfelt and personal, simple words; specific about what each person did; no corporate or AI phrasing (a list of phrases it must not use), no emoji or hashtags; no numbers, no ranking, no comparison, no pressure.
- **No name and no number reach the model.** Each person is a placeholder (`{1}`, `{2}` …) followed by the deed in the target language's own words. The system prompt has no digits. The names are put back after the answer. An answer that drops or invents a placeholder fails ("Couldn't write it this time. Try again, or write it yourself below."). This keeps D81's rule that no roster name reaches a request.
- The data goes between `<text>` tags with D101's tag guard (`wrap`), marked as data, never instructions.
- One request per language, the three at once. Without `GROQ_API_KEY` the button reads "Write it yourself" and the fields open empty. The log carries the time taken and the number of people, never text or names.

**The three ways.**

- **Copy for the game**: the shown language's text as the game's notice text (`gameNotice`, D102): plain text, at most 1,000 characters, cut after the last whole line. The counter turns seal over 1,000, and Discord and the board are off until every language fits.
- **Post to Discord**: the `members` channel of `WORKSPACE_DISCORD_WEBHOOKS` (D102; `#guides-and-beyond` for the OGs) through D102's own message loop (`postMessages`). Title "Weekly appreciation · Nov 16 – Nov 22" (the forum post's name, or the bold first line). Each written language under its name. `allowed_mentions: {parse: []}` and D102's mention breaking. Once per request id (D100): a repeat gets the first answer; after `failed` the sheet takes a new id. No members channel: the button is off and says so.
- **Post to the members' board**: the card below.
- Routes: `POST /api/w/[slug]/thanks` (`share` with target, week, title, texts, names, request id; `take_down` with the share id) and `POST /api/w/[slug]/thanks/draft`. Officers only, `401 signed_out` (D99), codes only. Both are in `member-session.test.ts`.

**Record** (`thanks_shares`, `thanks_takedowns`, migration `0039_thanks_shares`).

- One append-only row per share (Discord or board): who, when, the week's Monday, the text per language as shared, the names ticked, the status (`posting`, `posted`, `failed`; a board share is `posted` at once). Unique per workspace and request id.
- "Take down" appends a `thanks_takedowns` row (who, when); the share row stays. One per share.
- Copy for the game is not recorded.

**The thank-you card on the members' board** (`BoardThanks.tsx`).

- The newest board share, until the next one is shared (any week) or an officer takes it down. A taken-down card is gone: no older card comes back, and the board renders exactly as with no thanks (no frame, no gap, no message) for members and in an officer's preview (owner, 2026-11-17).
- It shows "Thank you", "The week of Nov 16 – Nov 22", the text in the viewer's language with the other languages one tap away and D105's language tag, and the officer's name as the signature: "With love, Rook" ("With love, your officers" when the account is gone).
- Look: the drawn pen frame in yarn, a warm paper tint (yarn at 9 % on paper), the red wax seal pressed on the top right corner, the brand's ball of yarn (`YarnCorner`) in the bottom left corner beside the signature, the letter and the signature in Alegreya. It sits under the board's lead, above the week.
- An officer's preview shows "Take down", which asks first ("Take the thank-you off the members' board?", "Keep it" first).
- Board reads stay member-safe: only the card's text, its week and the officer's name; never a value or a ranking.

**Home.**

- On Sunday and Monday (server days), when the covered week has no Discord or board share yet, the members box shows "Time for the weekly appreciation post" above the button, even when the list is empty. Never a nag: no count, no reminder elsewhere; it is gone once shared. Only read on those two days.
- Recent activity (D108) gains "Ana shared the thanks on Discord", "Ana shared the thanks on the members' board" and "Ana took the thanks down from the members' board". A failed Discord post is not a line.
