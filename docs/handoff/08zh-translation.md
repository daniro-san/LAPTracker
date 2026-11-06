# 08zh — Public pages in 18 languages, a staleness check and the translate-copy skill (#60)

## Built
- **Languages** (D48): English plus es, pt-BR, fr, de, it, nl, sv, pl, ru, uk, tr, zh-CN, ja, ko, id, vi, th. `LANGUAGES` in `lib/copy.ts` is the one registry of tags.
- **Translations:** `lib/i18n/<tag>.ts`, each `as const satisfies Translation` (any of `en`'s keys). Registered in `lib/i18n/index.ts` (`TRANSLATIONS`).
  - An extra or misspelt key fails tsc.
  - A missing key reads English at runtime: `withEnglish`, applied once per language at start-up in `app/_ui/locale.ts`.
- **Staleness stamps:** `lib/i18n/<tag>.stamps.json` keeps, per key, 8 hex of the SHA-256 of the English the text was translated from.
- **`scripts/i18n-check.ts`**, now the last step of `pnpm check`:
  - It reports, per language, `missing`, `stale`, `extra` and `broken` (placeholders differ) keys.
  - On failure it ends with "Run the translate-copy skill (.claude/skills/translate-copy/SKILL.md)" and exits 1.
  - `pnpm i18n:todo` prints the work as JSON. `pnpm i18n:stamp` marks translated keys fresh.
- **`.claude/skills/translate-copy/SKILL.md`** orchestrates the run: todo, one `translator` per language in parallel, spot-check, stamp, `pnpm check`. It also covers how to add a language and how to raise the model.
- **`.claude/agents/translator.md`:**
  - `model: haiku`, on purpose for cost. Tools: Read, Edit, Write, Glob, Grep (no shell, no web).
  - Its rules: exact placeholders, game terms in English, labels of at most two words, `Label: {n}` counts, DESIGN.md voice, the glossary reused and extended.
- **Glossaries:** `lib/i18n/glossary/<tag>.md`, seeded from the words each language already uses (ledger, alliance, stale, server time, grandma…).
- **Language per request:** `pickLanguage` in `app/_ui/locale.ts`.
  - Order: the `lang` cookie, else the first Accept-Language tag in a written language, else English. Any `pt` reads pt-BR, any `zh` reads zh-CN.
  - The Intl locale is the viewer's own tag in that language, else the chosen language, else today's `pickLocale`.
  - `requestLanguage`, `requestCopy` (React `cache`); `requestLocale` and `requestClock` follow the language.
- **Client:** `LocaleProvider` carries only the request's dictionary; `useCopy()` reads it. English outside the provider (global-error).
- **Wiring:**
  - Server components read `await requestCopy()`.
  - These take `copy` as a prop, because client trees or synchronous test renders also use them: `SiteHeader`, `SiteFooter`, `ErrorPage`, `EventLabel`, `StatTable`, `MoreBar`, `StatusChips`, `Legend`, `FreshDots`, `SideHead`.
  - These helpers take it as a parameter: `comparisonRows`, `emptyLine`, `joinedText`, `leftText`, `membersLostText`, `makeClock` (defaults to `en`, so /admin stays English).
  - Titles come from the request's dictionary (`generateMetadata`).
  - `<html lang>` is the language. /admin (`AdminShell`) and /brand wrap their content in `lang="en"`.
- **Switcher:** the first control in the settings gear on public pages (`publicPage`, formerly `times`).
  - A native `select`; each option is named by `Intl.DisplayNames` in its own language.
  - A one-year SameSite=Lax `lang` cookie, then `router.refresh()`.
- `app/_ui/MightRange.tsx`: the member list's might range, moved out of `MembersExplorer.tsx` unchanged.
- **Tests:**
  - `app/_ui/locale.test.ts`: language resolution (cookie, q order, unsupported first tag, pt-PT, zh-TW, en-GB locale, bad cookie).
  - `lib/copy.test.ts`: every translation keeps the English placeholders and the game terms.
  - Existing tests pass `en` where components now take `copy`.
- **Docs:** D48 in DECISIONS.md; DESIGN.md `viewer-settings` and Voice; one GLOSSARY row.
- **Screenshots** in `docs/screenshots/`:
  - `08zh-{event,alliance}-{en,ru,de,ja,pt-BR}-360-{light,dark}.jpg`: full pages.
  - `08zh-{event,alliance,player,settings}-all-360-{light,dark}.jpg`: the top 780 px of each page in all 18 languages, 6 across.

## Decisions
- **The owner's decision on #60** (relayed by the triage session):
  - Native dictionaries, no runtime library, no external translation API.
  - The coding agent translates through a repo skill, and a check makes stale translations impossible to miss.
  - Translations run on Haiku through a project subagent.
- **D48**, as the triage session assigned. D40–D47 are reserved for other sessions; D48 is free on `dev`.
- **Right-to-left (ar, fa, he) left out:** about 25 physical left/right classes, arrows in 12 files, and a font check. A separate issue.
- **Counts read `Label: {n}`** (`Устарело: 1`), so no language needs plural forms. `Intl.PluralRules` is the tool if one ever does.
- **The four game terms stay English** everywhere, inside labels too (`± Might`, `Мин. Might`). "Sanctuary" is translated. Brand names stay.
- **Language and Intl locale are separate.** Without a cookie, a Hungarian browser reads English words with Hungarian number formats, as before.
- **`i18n:stamp` stamps every translated key**, not only the ones a translator changed: a key whose text is still right after an English rewording must be markable fresh. The skill allows stamping only after every language came back done.
- **Exports `itIT` and `idID`**, not `it` and `id`: `it` collides with Vitest.

## Deviations
- **Scope:**
  - The task named ru, es, pt-BR. The owner asked for 17 languages in this session.
  - Then the owner's decision (via the triage session) added the stamps, the check, the skill and the Haiku translator.
  - PR #136 was already open when the triage session's "do not open the PR yet" arrived; it carries all of it.
- **Switcher:** a native `select`, not a fourth radio group as lane G suggested. 18 radios pushed Theme, Times and Dates out of the panel.
- **`MightRange` moved to its own file:** `MembersExplorer.tsx` passed the 300-line lint limit by 2 lines.
- **The demo ran without the `translator` agent type.** Project agents load at session start, and this session predates `.claude/agents/translator.md`. Each translator ran as `general-purpose` on `model: haiku` with that file's body as its instructions and the same input. A new session gets `subagent_type: "translator"` with the tool limits.
- **No first full Haiku run.** The 17 dictionaries were written by Opus in this session, and stamping them made them current. The demo below is the first Haiku run: 1 key × 17 languages.

## Verified
- **`pnpm check`:** Prettier, ESLint, tsc, the drift gate and `i18n: 17 languages up to date with English` all pass.
  - 38 test files: 36 passed, 1 skipped (pre-existing); 179 tests passed.
  - Two PGlite suites (`players`, `running`) hit the 10 s `beforeAll` timeout at load average ~20 and pass on rerun. `dev` now has the fix for that (08zk), merged into this branch.
- **The loop, run on 2026-11-05:**
  1. Changed `empty.noEvents` in `lib/copy.ts` from "No events in the ledger yet." to "The ledger has no events yet.".
  2. `tsx scripts/i18n-check.ts` exited 1: `i18n es: stale empty.noEvents` … for each of the 17 languages, then "i18n: 17 language(s) out of date with lib/copy.ts. Run the translate-copy skill (.claude/skills/translate-copy/SKILL.md)."
  3. `pnpm i18n:todo` listed 1 key per language, with `en` and `current`.
  4. 17 Haiku translators ran in parallel.
     - 14 kept their text, correctly: the English was reworded, not changed in meaning.
     - de, pl and fr rewrote it: `Die Chronik hat noch keine Events.`, `Księga nie ma jeszcze żadnych wydarzeń.`, `Le registre ne contient encore aucun événement.` Spot-checked: same meaning, glossary words, no placeholders.
  5. `pnpm i18n:stamp`, then the check: `i18n: 17 languages up to date with English`, exit 0. tsc green. 22 files changed: the English line, 3 translations, 17 stamp files.
  6. Reverted all of it (`git restore lib/copy.ts lib/i18n`); the check is green again.
- **Cost and time of that run** (from the harness):
  - 17 subagents, 107,848–128,188 tokens each, 2,125,268 in all. 99–139 s each, run in parallel.
  - No price is shown. Almost all of it is input: each translator read the whole of `docs/DESIGN.md` and `lib/copy.ts` for one key.
  - Afterwards the agent prompt was changed to skip DESIGN.md unless a rule is unclear, and then to read only its Voice section. Not measured again.
- **Findings from the run:**
  - The Thai translator noted that Thai takes no full stop; the rule now says so.
  - Several general-purpose stand-ins reported Grep and Glob as unavailable and read files whole. The `translator` agent type lists them.
- **Local stack:**
  - Throwaway Postgres 18 seeded with 3 Saturdays and a rehearsal, a WebSocket bridge for the Neon driver, and `next dev` with the upstream URLs pointed at a closed port.
  - No Neon database touched, 0 upstream API calls, `/api/quota` never called.
- **curl, per `lang` cookie:**
  - `<html lang>`, `<title>` and `<h1>` are in the language; status reads `Обновлено: 31 окт., 14:01 по серверу`.
  - `Accept-Language: pt-BR` with no cookie gives pt-BR.
  - /admin with `lang=ru` gives `<div lang="en">` and an English header.
- **Playwright + system Chrome, 360 × 780, on the final code:**
  - 18 languages × event, alliance and player page, light and dark, plus the open panel: 144 captures.
  - Every one has `scrollWidth` = 360, and no element passes the right edge or is clipped (sr-only excluded).
  - The language list reads English, Español, Português (Brasil), Français, Deutsch, Italiano, Nederlands, Svenska, Polski, Русский, Українська, Türkçe, 中文（中国）, 日本語, 한국어, Indonesia, Tiếng Việt, ไทย.
- **Switcher flow** (no cookie, `en-US` → ru → reload → ja → reload → pt-BR → en):
  - `<html lang>` and `<h1>` follow each pick and survive reloads.
  - Cookie: `lang`, 365 days, Lax.
  - Console: only local badge-image 404s, no hydration warning.

## Open issues
- **No native review.** A native reviewer for each of 17 languages is not realistic.
  - The drafts are Claude's (Opus), spot-checked.
  - Players can report wording in an issue. A fix is one line in `lib/i18n/<tag>.ts` plus `pnpm i18n:stamp`.
- **Least sure, per language:**
  - all: `ledger.sanctuary` (the game's own word in each language is unknown), `site.byline` (Old Grandmas kept as a name), `site.manualRound`, and the 404/500 jokes.
  - ru, uk: `time.serverTime` "по серверу" / "за сервером" after a time; `search.seen` "Последний раз" / "Востаннє"; `members.byName` "А–Я" over mostly Latin names.
  - es: `ledger.asOf` "Datos de {time}"; `fresh.fresh` "Al día"; `status.byHand` "Lo lanza el admin a mano".
  - pt-BR: `site.ledger` "Registro de eventos"; `status.byHand` "Rodado à mão pelo admin"; `empty.noMembers` "Ninguém aqui bate.".
  - fr: `site.manualRound` "Manche manuelle"; `fresh.stale` "Périmé"; the non-breaking spaces before colons.
  - de: `site.ledger` "Event-Chronik"; `settings.theme` "Design"; `members.clear` "Entfernen".
  - it: `site.byline` "tenuto dalle Old Grandmas"; `leadership.title` "Comando".
  - nl: `ledger.joined` / `ledger.left` "erbij" / "weg" (`+3 erbij`).
  - sv: `site.ledger` "Eventlogg"; `members.byName` "A–Ö".
  - pl: `ledger.joined` / `ledger.left` "doszło" / "odeszło"; times in the genitive ("14:01 czasu serwera").
  - tr: `ledger.since` "{date} sonrası"; `ledger.sanctuary` "Sığınak"; `legend.rounded` "Tam sayılar’ı".
  - zh-CN: `ledger.ranking` "服务器排名"; `leadership.leader` "盟主".
  - ja: `legend.rounded` "概数：…"; `search.seen` "最終確認".
  - ko: `leadership.leader` "맹주"; `ledger.asOf` "{time} 기준".
  - id: `ledger.sanctuary` "Suaka"; `site.ledger` "Buku Event".
  - vi: `ledger.joined` / `ledger.left` "vào" / "rời"; `fresh.stale` "Cũ".
  - th: `site.manualRound` "รอบแมนนวล"; `legend.rounded`.
- **`Intl.DisplayNames` wording:** it names zh-CN "中文（中国）" and id "Indonesia". To prefer "简体中文" or "Bahasa Indonesia", override those two.
- **Header wrapping:** at 360 px the Players link and date button wrap to two lines in ja, vi and pt-BR (`sáb., 31 de out.` is Intl's short date). No overflow; the buttons stay 44 px.
- **Spanish compact numbers** read `4370 M`: Intl's `es` compact format has no billions. This already happened for Spanish browsers before.
- **Fonts:** page titles (Young Serif) use the system serif for Cyrillic and Vietnamese. CJK and Thai use system fonts throughout.
- **/admin formats:** its words stay English, but its number and date formats follow the Intl locale, which now follows the `lang` cookie.
- **/brand:** the `MemberMark` specimen reads its screen-reader text in the viewer's language (it uses `useCopy`).
- **Chinese:** any Chinese browser, zh-TW included, reads Simplified.
- **No JavaScript:** the gear panel is empty, so the language comes from Accept-Language only (the same as times and dates).
- **Stop hook:** it runs `pnpm check` in the main checkout, not the session's worktree (pre-existing, 08ze).
- **Follow-up:** an issue for right-to-left languages (ar, fa, he).

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches page words and dev tooling only; the collector, cron path, quota and Discord messages are unchanged.
Owner must do first: merge this PR into `dev`. No migration, no new environment variable. A session started after the merge has the `translator` agent and the `translate-copy` skill.
Plan changes needed: none for Session 9. IMPLEMENTATION_PLAN.md §9 lists translation as v2 (ru, es, pt-BR); it is now v1.1 with 17 languages (D48).

<adjustments>
- If the owner's browser has a `lang` cookie or a non-English Accept-Language, public pages read in that language, and numbers and dates follow it. That is expected, not a dry-run bug. /admin, Discord messages and run logs are always English.
- When checking public page text against the English strings in the handoffs, use `lang=en` (or no cookie with an English browser).
- `pnpm check` now ends with `scripts/i18n-check.ts`. A session that edits a public string in `lib/copy.ts` must run the translate-copy skill before it can finish.
</adjustments>

<adjustments for="Session 10">
- README:
  - The gear's first control picks the page language (18 languages). The choice is a cookie in that browser.
  - Discord messages and /admin stay English (D48).
  - Might, Kills, Members and Level are English in every language.
  - Players can report a wording problem in an issue.
- CONTRIBUTING.md:
  - A public string is written in English in `lib/copy.ts`, then `pnpm check` fails until the translate-copy skill has run.
  - The skill's translator is Haiku, and the skill says how to raise it for one language.
  - Adding a language is in the skill.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/136
