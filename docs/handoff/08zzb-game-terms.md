# 08zzb — The game's own words for Might, Kills, Members and Level (issue #153)

## Built

- ko, vi and ru show the game's own word for Might, Kills and Members, in the column headers (`ledger.might`, `ledger.kills`, `ledger.members`) and inside the labels that carry them (`members.mightChange`, `members.killsChange`, `members.low`, `members.high`). Level stays English everywhere. ja and the other 13 languages keep English for all four.
- `lib/i18n/glossary/<tag>.md` (all 17): a "Game terms (from the game)" section. ko, vi and ru list English, word, source URL and quote; the others say "None sourced yet". The rule line above the section now points to it.
- `lib/copy.test.ts`: the translations test reads that section and fails when a dictionary's game term differs from the sourced word, or from English where the section lists none. It replaces the old "must equal English" assertion.
- `.claude/agents/translator.md` and `.claude/skills/translate-copy/SKILL.md`: a translator uses the glossary's sourced word or English, never its own, and never adds a row to the section.
- D52 in `docs/DECISIONS.md`; D48's line now says "amended by D52". `docs/DESIGN.md` "Numbers first" and "The game's four words stay in blank mode" updated. The header comment of every `lib/i18n/<tag>.ts` and the `GAME_TERMS` comment in `lib/copy.ts` now cite D52.

## Decisions

Rules for which words are used (D52):

- Use a word only if its source in the research data is the game's own text: datamined text on lastasylum.gg or an in-game screenshot. A guide's prose, a shop blog, an ad listing or a store review does not count.
- ko: 전투력 (Might, confirmed), 처치 (Kills, confirmed), 인원 (Members). 인원 comes from the datamined alliance-duel rules ("길드 인원이 20명을 초과하고"). 길드원 also appears in datamined text but names one member; a column that shows a count reads 인원.
- vi: Lực Chiến (Might, confirmed), Tiêu diệt (Kills, datamined kingdom-war text "Điểm tiêu diệt kẻ thù"), Thành viên (Members, datamined alliance research text "Thành viên Công Hội"). Capitalised as a header.
- ru: Мощь, Убийства, Участники (datamined event text). Nominative plural for headers; lower case after an abbreviation (`Мин. мощь`, `Макс. мощь`).
- Level: English in every language. The game writes a level as a prefix before the number (`Lv.10`, `ур.10`); no language switched to "Lv.".
- ja: English for all four. 戦力 and メンバー come from a fan guide's prose (elpisoul.site), and Lv. from an ad listing.
- Blank-dictionary mode is unchanged in code: `blankDictionary` keeps the request dictionary's four terms, so in ko/vi/ru the blank page shows the game's word.

## Deviations

- Stamps: no stamp file changed. The English source did not change, so `i18n-check` was already green; the stamps hash the English, not the translation.
- The task's optional "guild" switch (ko 길드, vi Công Hội) was not done: 연맹 appears in 4 ko strings and liên minh in 4 vi strings, and Korean particles change with the noun's final syllable (연맹이 / 길드가), so it is a retranslation, not a word swap. Follow-up below.

## Verified

- `pnpm check` green: prettier, eslint, tsc, vitest (201 tests), drift check, `i18n: 17 languages up to date with English`.
- 360 px light screenshots from `next dev` against the Neon preview branch, `lang` cookie per language: event table and an opened Details panel in ko, vi, ru and pt-BR (`docs/screenshots/08zzb-*.png`). pt-BR still reads Might, Kills, Members. The vi and ru labels fit the label column; the Details table's horizontal scroll at 360 px is the same as with English.

## Open issues

- ko and vi call an alliance 연맹 / liên minh; the game says 길드 / Công Hội. Needs a retranslation of those strings (the alliance-word rows in the glossaries too).
- 13 languages and ja have no sourced word. The research comment suggests asking alliance members for one in-game screenshot each for es, pt-BR, fr, de, it and tr; a screenshot adds a glossary row and the dictionary value.
- The game's languages include Arabic, Malay and Traditional Chinese, which LAPTracker does not offer; sv, pl and uk are not game languages (relevant to #140).

## Next

Session: none planned by this change; the v1.1.0 release (PR #159, `dev → main`) follows.
Model / effort: keep — data and docs change.
Owner must do first: merge this PR into `dev` before merging the release PR #159.
Plan changes needed: none.

<adjustments>
- Game terms are sourced per language in `lib/i18n/glossary/<tag>.md` "Game terms (from the game)"; `lib/copy.test.ts` enforces them. A session that adds a language or a game word adds a row there with a source URL and quote, not just the dictionary value.
- Already done: ko, vi, ru Might/Kills/Members. Level stays English by decision (D52), not by omission.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/160
