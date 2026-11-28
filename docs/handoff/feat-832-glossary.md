# feat/832-glossary

Issue #832: an alliance glossary for translate, improve and fit.

## Built
- Alliance settings → Glossary card (`app/(private)/_ui/GlossaryCard.tsx`): add a word, remove a word, Undo for 10 seconds after a remove. Each change saves the whole list through `POST /api/w/[slug]/glossary`. The card has a row in the "On this page" index.
- Storage: table `workspace_glossary` (one row per workspace, `words` jsonb), migration `drizzle/0088_kind_junta.sql`. Deleted with the workspace (listed in `WORKSPACE_TABLES` with `file: null`, so it is not in the download).
- Rules (`lib/glossary.ts`, shared by card and route): at most 100 words, at most 40 characters each, no braces or control characters, spaces collapsed, repeats in any case dropped.
- Route and rules (`lib/private/glossary.ts`): officer session only (a member's session answers 401), 60 saves per 15 minutes per workspace, 403 `turned_off` when no translating feature is on.
- Requests (`lib/ai/notice-writing.ts`, `lib/ai/protect.ts`): `translateText`, `improveText` and `fitText` take the glossary. Words are listed in the system prompt (one JSON string each) and each occurrence in the text becomes `{G1}`, `{G2}`, … before the model sees it; the words are put back as written afterwards.
- Callers: the notices draft route (Translate, Improve, Shorten) and Discord's "Translate for me / for everyone" (`TranslationJob.glossary`, read with the guild's workspace).
- Copy in EN, PT-BR and FR (`lib/private/dictionary.glossary.ts`).
- Amendment to D81 dated 2026-11-28.

## Decisions
- The card shows, and saves and requests use the list, while any of `notice_translate`, `notice_improve`, `notice_fit`, `discord_translate_me`, `discord_translate_everyone` is on. The saved list stays when all are off.
- A dropped or invented placeholder fails the request the way a model failure does: Translate and Improve answer `failed` (502, allowance given back, officer's text unchanged); Discord shows its "could not translate" line; Shorten treats it as a try that did not fit and answers `still_over` after both tries.
- Matching is case-insensitive, whole words only, and the text's own spelling is what comes back.
- Undo is a second save of the list before (client-held), not a server-side record. No analytics event for glossary saves, so no word can reach analytics.
- The system prompt names the words and the text carries placeholders, so the model sees each word only in the prompt.

## Deviations
- None from the task. The glossary is not in "Download our data" (task did not ask for it).

## Verified
- `pnpm vitest related --run` on the changed files, then `pnpm check`: prettier, eslint, tsc, full vitest, drift check, i18n check all pass.
- New tests: `lib/ai/protect.test.ts` (words in the prompt and restored after the answer, case and whole words, dropped placeholder for translate, improve and fit), `app/(private)/api/w/[slug]/glossary/route.test.ts` (officer-only save and cleaning, Undo, no analytics payload with the words, cap and validation, switch off).
- Existing tests extended for the new table and route: `member-session.test.ts` fixture, purge seed, settings index, Discord job type.
- No call to Groq or any upstream API; all models are stand-ins.
- Not checked in a browser: the card was not rendered at 360 px.

## Open issues
- The card has no component test; its behaviour is covered through the route and the rules.
- A word is typed one at a time; there is no paste of a list.
- Placeholders cost one `{Gn}` per occurrence; a text with more than a few dozen occurrences gives the model many placeholders to keep.
- Patch notes (`lib/patch-notes.ts`) not edited; add an entry before the next release.

## Next
- Look at the card at 360 px, in dark mode, in all three languages (owner or a design persona pass).
- Add an entry to /admin/changes before the next release-prepare.
- Consider including the glossary in the workspace download (D125).
- Consider an Activity line when an officer changes the glossary.

What was missing from the task prompt? Which translating features count for showing the card (I used any of the five).

PR: (added by the orchestrator)
