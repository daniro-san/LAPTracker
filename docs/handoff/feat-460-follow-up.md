# feat — Follow-up: what to ask, a ready message, and the coins tip (issue 460)

## Built

- **The list** (`app/(private)/w/[slug]/follow-up/page.tsx`, `FollowUpList.tsx`):
  - A "what to do" line at the top: "Say hello, write down what they said, mark how it went. Nothing is sent for you." D104's help line stays under it.
  - A new member's row names every fact still to ask: "Still to ask: Main squad might, Troops, AD Tech, Time zone, Languages". There is no count any more.
  - A third group, "A tip to share · n", after Check in and New.
  - A tap on the person, or "Add a note", opens the member's panel. Below 1024 it is a sheet; from 1024 it is the pane beside the list (D122 master-detail, `?m=`). The thefts section moved into the list's column.
- **The coins tip** (`coinsTip` in `lib/private/follow-up-rules.ts`, `tipsOf` in `lib/private/follow-up.ts`):
  - It shows when Alliance Help coins were below 1,000 on at least 5 of the last 7 server days (the card's `lastDays`). "none" counts as below; a day with no read never counts.
  - It is not shown for members on a break or first seen less than 7 days ago.
- **The panel** (`FollowUpSheet.tsx`, `FollowUpPanelParts.tsx`), top to bottom:
  - the rank and "Came from …" from the card route;
  - "Why they’re on the list";
  - the ready message, with EN · PT · FR chips, "Copy for game mail" and "Copy for Discord";
  - "Fill in what they told you": each missing fact opens the facts editor at its field, plus "Paste what they told you" and "Edit info". Only "Edit info" shows when nothing is missing;
  - D104's four answers, the note and Save;
  - the last 3 notes.
- **The ready message builder** (`lib/private/ready-message.ts`, words in `lib/private/dictionary.ready.ts`):
  - Fixed sentences in EN, PT-BR and FR, pure and browser-safe. It is shared so the card's "Copy a hello" (#516) can call it.
  - `messageLanguage` picks the language: recorded languages, then the game's, then the officer's. Raid prep (D137) now uses the same pick.
- **Repo:** `gameLanguages` in `lib/repo/player-reads.ts` gives each member's newest game language from the workspace's own `player_reads`.
- **Small shared changes:**
  - `readCard` is exported from `MemberSheet.tsx`.
  - Each fact row in `FactFields.tsx` carries `data-fact`, and `focusField` focuses it.
- **Docs:**
  - D140 (new);
  - a D104 amendment;
  - the decisions index;
  - two glossary rows ("ready message", "coins tip").

## Decisions

- **D140** records the page, the tip, the panel, the message and the persona panel. D138 (#520) and D139 (#522) were merged first.
- The tip is a group of its own ("A tip to share"), not a Check in reason. A member is in the first group that holds them.
- **Assumption:** the tip uses the offline signal's 7-day grace (D127) for newcomers. The issue does not say.
- **Assumption:** "5 of the last 7 days that have data" means the 7 server days of the card's "Last 7 days". A day with no read is left out, so a member needs 5 days with data below 1,000.
- The message is built on the server in all three languages. The browser only picks one and copies it.

- **Settled by the coordinator (2026-11-20):** keep the softened quiet line, keep the 7-day grace for the tip, wait for real data before sizing the tip group, and leave AI translation out.
- **Rebased onto `origin/dev`** after #517, #520 and #522 merged. Two conflicts were resolved by keeping both sides: the decisions index (D138 and D139 before D140) and the header comment of `cross-workspace-reads.test.ts` (Insights and Follow-up both named). This change adds no migration.

## Deviations

- **No AI translation (the issue's D113 path).** EN, PT and FR are fixed templates. The brief forbids Groq calls, and no other language is offered.
- **The issue's example "Haven't seen you around for a couple of days" was softened** to "How are things going? All good on your side?" after the persona panel: it told a member that someone tracks when they are online. To restore the issue's wording, edit `READY_MESSAGE.*.idle`.
- **The persona panel changed some words:**
  - PT "Quieto há 3 dias" (D104) is now "Sem aparecer há 3 dias", because "Quieto" is gendered.
  - The PT "what to do" line uses the plural, matching the line under it.
  - Both changes are recorded in the D104 amendment and in D140.
- **"Tapping a person" keeps the row's chips.** "Talked to them" stays one tap. "Add a note" now opens the same panel.

## Verified

- **`pnpm check` passes:** prettier, eslint, tsc, vitest (265 files, 1,389 tests pass, 4 skipped, after the rebase), drift, and i18n (17 languages).
- **New tests**, about one per behaviour:
  - `lib/private/ready-message.test.ts` (3): each reason and the tip have their line; every fact is named, in PT and FR; the language order.
  - `lib/private/follow-up-rules.test.ts` (+1): the tip with 5 days below 1,000; no tip when the extra days are days with no read.
  - `lib/private/follow-up.test.ts` (+1): the tip on the list, in the game's language from the workspace's own reads; no tip from days with no read.
  - The #471 suite, `cross-workspace-reads.test.ts` (+1): Alpha's message language never comes from Bravo's newer read of the same player.
- **Local production build** (`next build` and `next start` on local Postgres 18 with all 60 migrations). The data was invented:
  - OGs with 24 invented members and 7 end-of-day reads;
  - another alliance a newcomer came from;
  - game languages and an older note from another officer;
  - a stubbed officer session.
- **The e2e passes 228 of 228 checks:**
  - list and panel at 360 and 1280, light and dark, EN and PT; FR at 360; PT at 1024 (the pane);
  - the words, every fact named and the tip group;
  - the member with days missing gets no tip;
  - the panel opens in the address;
  - the message is in Portuguese for a member whose game is in Portuguese;
  - both copies reach the clipboard;
  - a missing fact opens the editor with the focus on that field;
  - the other officer's note shows;
  - the language chips switch the text and its line;
  - only "Edit info" shows when nothing is missing;
  - All fine saves, the member leaves the list, and Undo brings them back;
  - no sideways scroll, every target at least 44 px, and no blocked roster key in the HTML.
- **Screenshots** are in the scratchpad: `460-shots/` (before the persona fixes) and `460-shots-2/` (after).
- **Real data, seen locally only:** six plain `/v1/players` reads of OGs members, without `fresh` and 1 s apart. The raw answers were deleted after the review.
  - All six were in OGs. The game language was "en" for 5 and "fr" for 1.
  - In the live roster read mid-day, 47 of 100 had 1,000 Alliance Help coins and 48 had fewer.
- **Persona panel:** an R4 on a phone, a member receiving the message, a Portuguese-first member who plays in English, and product strategy. All four voted "accept with changes". The agreed fixes are applied (see D140).
- **Privacy:** none of the 2,064 names in the fixture rosters appears in the added lines.

## Open issues

- **The tip's real volume is unknown.** End-of-day reads had about a quarter of members below the cap. After one real week, decide whether to collapse "A tip to share" above some size, or to add a "Shared the tip" answer (persona panel, "not now").
- **The game language is the client's language, not the member's.** Five of the six real reads said "en". Recorded languages, or the officer's chip, decide the language more often than the game does.
- **Left for later** from the persona panel: a line on what each copy changes; saying where the language came from; the editor's field order (might, AD Tech, Troops) differs from the message's order.
- **#516 can now add "Copy a hello" to the member card** with `readyMessage` and `messageLanguage`. The card route would also need the game language (`gameLanguages`).

## Next

- **Model and effort:** keep.
- **What the owner must do first:**
  1. Merge.
  2. Open Follow-up on a phone and check the tip group's size during the first week.
  3. To restore the issue's original quiet line, say so.
- **The plan itself needs no change.**

<adjustments>
- Ready messages to members go through `lib/private/ready-message.ts` (`readyMessage`, `messageLanguage`). The words are in `lib/private/dictionary.ready.ts`.
- A member's game language comes from `gameLanguages` in `lib/repo/player-reads.ts`, which reads the workspace's own `player_reads` only.
- `followUpView` items carry `tip` and `language`, and the view carries `zones` for the facts editor.
</adjustments>

PR: (added by the orchestrator)
