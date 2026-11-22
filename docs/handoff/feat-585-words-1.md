# feat/585-words-1: one way to write dates, times and zones on the desk, the board and Me (#585 batch 4, slice S1)

Part of #585 (F35, F31). Size L (batch 4 needs more than one PR), planned with `/tlc-spec-lean` in `.specs/features/585-words/plan.md` (all slices) and `checks.md` (S1). F19 was planned as part of S1 but is not built: see Deviations.

## Built

- **`lib/date-words.ts` (new):** `dateWords(language, zone)`, one form per purpose, made once per language and zone. A `YYYY-MM-DD` string is a server day; a `Date` is written on `zone`'s clock.
  - `day` "Fri, Nov 20" (PT "sex., 20 de nov.", FR "ven. 20 nov."): every date in a line.
  - `at` "Fri, Nov 20, 18:54" (PT "… às 18:54", FR "… à 18:54"); the line adds " ST". `joinAt` is the join alone, for the browser.
  - `dayMonth` "Nov 20", `long` "Friday, November 20", `sentence` "November 20", `withYear` "November 20, 2026", `time` "18:54", `range` "Nov 16 – 22".
- **Callers moved to it** (about 20 hand-made `Intl.DateTimeFormat`s): `calendarDates`, `cardFormats` (card, Me, squads), `dayFormat`, `shortDate`, the thefts page, theft client, notices' words, Home's To review, garrison, invite, shots, Follow-up's week range and sheet, the away sheet, the pictures-due card, the deletion date, the read status, shield status and Raid prep clocks, the time-zone picker.
- **Dates that end a sentence** take `sentence` or `withYear`, so PT and FR never print "nov..": the deletion banner, invite expiry, the shots draft, the garrison's carried enemy, Insights' "Based on … since", the pictures-due card, a picture's "kept", a reopened theft, Follow-up's KvK reason.
- **The notice picture's "kept" day** is written on the server (`noticeWords().picture`) and passed to the client as words; it was formatted in the browser with no zone.
- **ST:** `time.server` is "{time} ST" in all three languages. Every desk, board and Me time ends in "ST". The full term appears only in a line that also names ST: EN "server time (ST)", PT "horário do servidor (ST)", FR "heure du serveur (ST)". PT says "seu horário" (it said "sua hora").
- **Zones:** one offset form, `offsetText` (`lib/calendar-time.ts`); `time-zones.ts`' `offsetLabel` is it. The board's time column reads "your time (UTC−3)" at the instant shown (it read the browser's "BRT"/"GMT"). /admin's schedule row reads "UTC−2 (server time)" (it read "Etc/GMT+2").
- **Board vs Me:** the board's title is "Next 7 days in the alliance" and its section "Next 7 days" (PT "Os próximos 7 dias da aliança" / "Próximos 7 dias", FR "Les 7 prochains jours de l’alliance" / "Les 7 prochains jours"). "This week" now always means Monday to Sunday. On Me, the squads' seen line puts the member's time first with its own date ("seen Fri, Nov 20, 00:32 your time · Thu, Nov 19, 22:32 ST"); the browser works out only the viewer's "00:32". "Where you’re needed" says "Times are in server time (ST)."
- **Tests:** `lib/date-words.test.ts` (new, machine zone Asia/Tokyo, server UTC−2); two guard tests in `lib/private/dictionary.test.ts` (ST wording; no ".."); one in `BoardSections.test.ts` (offset, summer time); one in `MemberSquads.test.ts` (Me's order). Changed on purpose: `MemberSquads`, `follow-up-groups`, `fact-trend` (PT "10 de nov."), `theft-data` (formats type), `BoardSections` (signature), and the e2e board heading and KvK-reason assertions.
- **Docs:** amendments dated 2026-11-22 to D104, D105, D106, D108, D109, D113, D116, D136 and D142; the glossary's ST row, a new "date words" row and the members' board row.

## Decisions

- **The PT break date** is `dayMonth` in every language ("até 24 de nov."), not `day`: French writes "jusqu’au {date}", and `day` would print "jusqu’au mar. 24 nov.". The plan's criterion 1 was amended while building.
- **/admin keeps "server time"** as its word. Only its zone row changed in S1. Its three date forms are S7 (product strategy).
- **Me's own-time-first line** applies to Me only. The desk card keeps server time first and does not follow the Server/My time switch, which it never did (adversarial finding 6).
- **Basis:** the panel record in the plan's Validation section (a) to (d). The officer panel approved every change, some with changes. The PT and FR experts set the joins, the full terms and the titles. Product strategy and the adversarial reviewer approved S1 with changes, all adopted.

## Deviations

- **F19 (one rule for a member's average) is not built.** Both gate verdicts (product strategy and adversarial) asked for the owner's own yes. F19 reverses a rule D136 states ("none" left out of the card's average), and the standing approval covers only a plan both verdicts approve. Its criteria, examples and the question for the owner are in the plan as S1b. The test asked for (the card, Me and Insights agree) belongs to S1b.
- Criterion 5 covers the lines that end a sentence with a date, not every line with an article before a short date (about 50 keys, e.g. FR "le {date}"). That sweep moves to S4.

## Verified

- `pnpm vitest related --run <changed>`: green after the fixes above.
- `pnpm check`: exit 0 (prettier, eslint, tsc, 1738 tests passed and 4 skipped, drift, i18n). No public string changed, so translate-copy was not needed.
- `pnpm test:e2e` (local, `next build`, own cluster on 54390, ports 3490/3491/54392): 51 passed, 3 skipped (single-project tests).
- `validate_plan.py` and `validate_checks.py`: 0 errors.
- Not run: the tlc-spec-lean Verifier sub-agent and `check_proofs.py` (C9 is an e2e proof that needs the cluster). Left for the PR review.

## Open issues

- **S1b waits for the owner.** The question, word for word, is in the plan under S1b.
- AC 4 (the picture's kept day), AC 8 (/admin's zone row) and AC 13 (Me's ST line) have no test of their own: each is a one-line wiring.
- The ".." guard test checks the dictionary lines against the sentence form. It does not check that each caller passes that form. The callers changed here are listed under Built.
- The officer panel's "yesterday/today before a date" (SHOULD) and the "−" glyph check at 360 px are not done.
- Pre-existing, not changed: `calendar-words.ts`' comment says dates never end a sentence, but about 14 lines did before this PR.

## Next

Remaining slices, in order (plan `.specs/features/585-words/plan.md`):

1. **S1b** F19, one average rule (`dayAverage`), after the owner's yes; a new decision supersedes D136's average sentence and D139's "This differs" paragraph.
2. **S2** "daily update" instead of "read" as a noun (F25), with one PT and one FR word; Follow-up's shorter "How this list works" (#656 first-visit fold).
3. **S3** Notices and Thefts words (F30, F43). Translating titles may add AI requests: size it then.
4. **S4** French and Portuguese terms (F44), plus the article-before-a-date sweep and lowercase after a colon on Me.
5. **S5** Members head and Former members (F45, F47).
6. **S6** Start here (F46).
7. **S7** /admin's date forms (with #392 if that batch runs first).

Follow-ups: `dateWords` for Discord ready messages and theft warnings (with the players' persona); "UTC−2" on the public pages; for two weeks after release, watch `$exception` on the board and Me, and Me page views (product strategy).

Analytics: no change. No event or property changes meaning; `board_section` `week` keeps its days.

What was missing from the task prompt? That F19 reverses an owner-stated rule (D136), which takes it outside the standing approval once the gate verdicts ask for the owner, and that the brief's F35 covers lines that end a sentence with a date in PT and FR.

PR: https://github.com/daniro-san/LAPTracker/pull/662
