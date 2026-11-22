## D140 — Follow-up: every fact to ask by name, a panel per person with a ready message in their language, and the Alliance Help coins tip (2026-11-20, owner, issue 460; amends D104; uses D75, D109, D122, D127, D132, D136, D137)

Why: the owner, 2026-11-19: Follow-up is hard to act on. "5 things still to ask" does not say what to ask or how, and tapping a person should lead straight to an action. Owner corrections on the issue: "Alliance Duel role" does not exist in the game; the facts to ask are `factsToAsk`'s (main squad might, troops, AD Tech, time zone, languages). Owner-approved the same day: the guest sheet's coins tip as a reason.

**The page** (`/w/[slug]/follow-up`):

- A "what to do" line first, in one sentence: "Say hello, write down what they said, mark how it went. Nothing is sent for you." ("Deem um oi, anotem o que a pessoa disse e marquem como foi. O app não envia nada.", "Dites bonjour, notez ce qu’on vous a dit, indiquez comment ça s’est passé. Rien n’est envoyé à votre place."). D104's help line stays under it.
- A new member's row names every fact still to ask: "Still to ask: Main squad might, Troops, AD Tech, Time zone, Languages". Never only a count.
- A third group, **"A tip to share · n"** ("Uma dica para passar", "Une astuce à partager"), after Check in and New. A member is in the first group that holds them; a row shows every line that applies.

**The coins tip** (`coinsTip` in `lib/private/follow-up-rules.ts`, `tipsOf` in `follow-up.ts`):

- The line: "Alliance Help coins below 1,000 most days. Maybe share that helping gives coins." (owner's words; "Moedas de Ajuda da aliança abaixo de 1.000 na maioria dos dias. Vale contar que ajudar dá moedas.", "Pièces d’Aide d’alliance sous 1 000 la plupart des jours. Rappeler qu’aider rapporte des pièces ?").
- It shows when `daily_honor` was below 1,000 on at least 5 (`COINS_TIP_DAYS`) of the member's last 7 server days (the card's "Last 7 days", `lastDays`, D136). The threshold is fixed and never compares people.
- "None" on a read that lists the member (D127) counts as below 1,000. A day with no read of the member is not counted at all, so missing data never brings the tip (D75): 4 days below and 3 days with no read is no tip.
- Not for a member on a break, and not for a member first seen less than 7 days ago (`OFFLINE_GRACE_DAYS`, the offline signal's grace, D127). Assumption: the issue does not say; a newcomer is still settling in, so the same grace applies.
- Recording any answer takes the member off the list for the week, as D104's other reasons.
- Real numbers (2026-11-20, one live roster read mid-day): 47 of 100 at the cap, 48 below, 5 with none yet. D127's end-of-day read had 74 of 98 at the cap. A weekly count of tip rows is still to be seen.

**The panel** (`FollowUpSheet.tsx`, `FollowUpPanelParts.tsx`). A tap on the person, or "Add a note", opens it: a bottom sheet below 1024, the pane beside the list from 1024 (D122's master-detail, the open member in `?m=`; the thefts section moved into the list's column, so nothing follows the list and its pane). Top to bottom:

1. The rank, and "Came from [TAG] Name · joined us …" from the member card (D136; officers always see it). The card is read from `/api/w/[slug]/members/[uid]` when the panel opens.
2. "Why they’re on the list": the reasons, the facts still to ask, the tip.
3. **"A message you can send"** with EN · PT · FR chips (44 px, `aria-pressed`), the member's language picked first, "In Portuguese. Nothing is sent for you: copy it into the game’s mail or Discord.", the text, then "Copy for game mail" (`gameMail`, D102) and "Copy for Discord" (`discordLiteral`: a name's markdown shown literally, mentions broken). Clipboard only; nothing is sent.
4. **"Fill in what they told you"**: one button per fact still to ask, each opening the facts editor at that field (`focusField`: the field's first control gets the focus); then "Paste what they told you" (D109) and "Edit info". With nothing to ask, only "Edit info" (persona panel: keeps the answers close).
5. "What happened?" with D104's four answers, the note and Save, unchanged.
6. "Last notes": the newest 3 follow-up notes from the card, by any officer.

A save closes the panel and shows D104's saved line with Undo. A member whose facts were filled in the panel may leave the list on refresh; the panel stays open until the officer closes it.

**The ready message** (`lib/private/ready-message.ts`, words in `lib/private/dictionary.ready.ts`): fixed sentences, never a translation request (no Groq, no AI cap spent; the issue's D113 path is not needed for EN, PT and FR). Shared so the member card's "Copy a hello" (issue 516) calls the same builder.

- A hello, or a welcome for a new member ("Hey Wren, welcome to the alliance! Glad to have you.");
- one line for the first reason: quiet ("How are things going? All good on your side?"), might the same ("How's the game going? Need a hand with anything?"), KvK ("How did KvK go for you? Anything we can help with?");
- the tip ("Small tip: helping alliance mates gives you Alliance Help coins, up to 1,000 a day.");
- every fact still to ask by name ("Quick one for the alliance sheet: could you tell me your main squad might, troop tier and languages?");
- the end: "Just checking in 🙂" after a reason, "Thanks! 🙂" after a question, "Have fun! 🙂" after the tip alone (a thanks there reads as praise for doing better).
- No number about the member (the 1,000 in the tip is the game's daily cap), no "you didn't", nothing about being watched. The issue's example "Haven't seen you around for a couple of days" was softened by the persona panel: it told a member someone tracks when they are online. The owner may restore it (`READY_MESSAGE.*.idle`).
- PT and FR are written gender-neutral and informal (você, tu), as a message between players.

**The member's language** (`messageLanguage`): the languages officers recorded (member facts) first, then the game's language from this workspace's own newest `player_reads` row that has one (`gameLanguages`, D132), else the officer's own language. D137's Raid prep message uses the same pick with English last. In six real reads (2026-11-20) the game language was "en" for 5 and "fr" for 1: it is the game client's language, so a Portuguese speaker who plays in English gets English until an officer records their languages or picks PT on the chip.

**Privacy** (D71). Reads go through `lib/private` after `requireWorkspace`. The game language is read for the workspace's own alliance only; another workspace's reads of the same player are never seen (the issue 471 suite). Nothing new is logged or sent; no blocked roster field reaches the page.

**Review of PR 523 (2026-11-20).**

- After a facts save the panel reads the card again (`useCard`'s `reload`), and offers no editor until the new read is in, so a second edit in the same open panel starts from the officer's own save, not a 409 (`follow-up-card.ts`, `panelCard`).
- A failed card read says "Could not read their card, so their notes and info are not here." with Try again, and a signed-out one shows the signed-out note (D99); never "No notes yet". The "Fill in" buttons stay off and the same line says why.
- `gameLanguages` reads only the members on the list, from the last 14 days (`LANGUAGE_DAYS`), one row each (`DISTINCT ON`): no scan of the whole history (#521).
- The coins tip reads the end-of-day rosters `membersView` already fetched (`MembersView.reads`), not a second fetch.

**Not built here** (left as follow-ups): a separate "Shared the tip" answer and collapsing the tip group above some size (decide after a real week's count); one line on what the two copies change; saying where the language came from ("from their languages", "game language"); the issue's AI translation into other languages.

**Persona panel** (2026-11-20; an R4 on a phone, a regular member receiving the message, a Portuguese-first member who plays in English, product strategy; invented-data screenshots plus six real `/v1/players` reads seen locally and deleted after). All four: accept with changes. Applied: the language chips; the quiet line softened in all three languages; PT "Quieto há" became "Sem aparecer há" (gendered); the end after the tip alone; only "Edit info" when nothing is to ask; one PT register in the "what to do" line.

**Tests:** `lib/private/ready-message.test.ts` (each reason and the tip offer their line; every fact named, PT and FR; the language order); `lib/private/follow-up-rules.test.ts` (the tip on 5 days below, never for days with no read); `lib/private/follow-up.test.ts` (the tip on the list with the game's language from the workspace's own reads); the issue 471 suite (`cross-workspace-reads.test.ts`: Alpha's message language never comes from Bravo's newer read of the same player).

**Amendment 2026-11-22 (issue 516):** the member card's "Copy a hello" is built as "Message to send ▾" ("Mensagem para enviar", "Message à envoyer"): it opens this panel's message block on the card and copies nothing by itself (persona panel). Its message comes from `readyTexts(inputOf(item))` in `ready-message.ts`, which Follow-up's page now uses too. A copy from either place is counted as `ws_message_copied` (`where` `card` or `follow_up`, `to` `game` or `discord`). See D136's amendment of the same day.

**Amendment 2026-11-22 (issue 585 batch 3):** the "what to do" line is no longer first: the week and its two numbers come before it ("{n} to look at · everyone else is fine", "{m} others already noted this week ↓"), because an officer missed the count line under it at a first glance. The groups are now "Worth a hello · n", "New · n" and "A tip to share · n". See D104's amendment of the same day.

**Amendment 2026-11-22 (issue 585 batch 3, slice 3):** the "what to do" line no longer stands on the page. With D104's help line it moved, word for word, into "How this list works" under the week's numbers (its summary: "Tap a name to write down what they said."), open on an officer's first visit on that browser and closed after. A row has one button, "Talked to them"; "Add a note" is gone, and a tap on the name (now in the link style) opens this panel. A line every row of a group holds, such as "Still to ask: …" or the coins tip, is said once under the group's title. See D104's amendment of the same day.

**Amendment 2026-11-22 (issue 585 batch 3, slice 5):** a member in Follow-up's "After KvK, offer help" (D104) gets the existing KvK line first in their ready message: "How did KvK go for you? Anything we can help with?" ("Como foi o KvK para você? Podemos ajudar com algo?", "Comment s'est passé le KvK pour toi ? On peut t'aider ?"), then their other reasons, the tip and the facts to ask. The message carries no number about their might, since a copied message leaves the app (D139). The member card's message does not read the KvK yet (follow-up).

**Amendment 2026-11-22 (issue 585 batch 4, slice S2):** the "what to do" line reads "Say hello, write down what they said, mark how it went." ("Deem um oi, anotem o que a pessoa disse e marquem como foi.", "Dites bonjour, notez ce qu’on vous a dit et indiquez comment ça s’est passé."). Its second sentence, "Nothing is sent for you." ("O app não envia nada.", "Rien n’est envoyé à votre place."), is gone: D104's line under it already says "Nothing is sent", and 6 of 6 officer personas asked for it once. "How this list works" is now closed on every visit (D104's amendment of the same day).
