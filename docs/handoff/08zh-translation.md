# 08zh — Public pages in 18 languages with a language switcher (#60)

## Built
- Dictionaries: `lib/copy.<tag>.ts` for es, pt-BR, fr, de, it, nl, sv, pl, ru, uk, tr, zh-CN, ja, ko, id, vi, th. Each is `as const satisfies Dictionary`.
- `lib/copy.ts`:
  - `en`: the public pages' strings, split out of `source`. `copy` (English, with admin, brand and Discord) is unchanged for the English-only areas.
  - `Dictionary`: `en`'s keys with any text. A missing or extra key fails `pnpm typecheck` (tried: renaming one key in `copy.ru.ts` gave errors in that file and at `DICTIONARIES`).
  - `LANGUAGES` (each language in its own name), `Language`, `parseLanguage`, `BLANK` exported.
  - New key `settings.language`.
- `app/_ui/locale.ts`:
  - `pickLanguage(cookie, header)`: the `lang` cookie, else the first Accept-Language tag (by q) in a written language, else `en`. Any `pt` reads pt-BR, any `zh` reads zh-CN. The Intl locale is the viewer's own tag in that language, else the chosen language, else today's `pickLocale`.
  - `requestLanguage`, `requestCopy` (React `cache`; blanked when `NEXT_PUBLIC_BLANK_COPY=1`). `requestLocale` and `requestClock` follow the language.
- `LocaleProvider` carries the dictionary; `useCopy()` reads it. English outside the provider (global-error).
- Server components read `await requestCopy()`. Components shared with client trees or rendered in tests take `copy` as a prop: `SiteHeader`, `SiteFooter`, `ErrorPage`, `EventLabel`, `StatTable`, `MoreBar`, `StatusChips`, `Legend`, `FreshDots`, `SideHead`. Helpers take it as a parameter: `comparisonRows`, `emptyLine`, `joinedText`, `leftText`, `membersLostText`, `makeClock` (defaults to `en`, so /admin stays English).
- Metadata: the root layout, `/players`, `/players/[uid]`, the event and alliance pages and 404 build their titles from the request's dictionary (`generateMetadata`).
- `<html lang>` is the language. /admin (`AdminShell`) and /brand wrap their content in `lang="en"`; the admin header and footer get the English `copy`.
- `ViewerSettings`: `times` renamed `publicPage`. On public pages the panel opens with Language, a native `select` (`LanguagePicker`), then Theme, Times, Dates. Picking writes a one-year SameSite=Lax `lang` cookie and calls `router.refresh()`.
- `app/_ui/MightRange.tsx`: the member list's might range, moved out of `MembersExplorer.tsx` unchanged.
- Tests:
  - `app/_ui/locale.test.ts`: language resolution (cookie, q order, unsupported first tag, pt-PT, zh-TW, en-GB locale, bad cookie).
  - `lib/copy.test.ts`: every dictionary has the English keys and placeholders and keeps Might, Kills, Members, Level.
  - Existing tests pass `en` where components now take `copy`.
- Docs: D39 in DECISIONS.md; DESIGN.md `viewer-settings` and Voice; one GLOSSARY row.
- Screenshots in `docs/screenshots/`:
  - `08zh-{event,alliance,player}-{en,es,pt-BR,ru}-360-{light,dark}.jpg`: full pages.
  - `08zh-{event,alliance,player,settings}-all-360-{light,dark}.jpg`: the top 780 px of each page in all 18 languages, 6 across.

## Decisions
- D39 (D37 is an unused gap; I took the number after the highest).
- Languages: the owner widened the list mid-session from ru, es, pt-BR to the 17 above. Right-to-left (ar, fa, he) stays out: about 25 physical left/right classes, arrows in 12 files and a font check. A separate issue.
- Counts are written `Label: {n}` (`Устарело: 1`, `Desactualizados: 1`), so no language needs plural forms and there is still no i18n library.
- The four game terms stay English in every language, including inside labels (`± Might`, `Мин. Might`, `Might mínimo`). "Sanctuary" is translated.
- Brand names stay: "OG's LAP Tracker", "Old Grandmas".
- Language and Intl locale are separate. Without a cookie a Hungarian browser reads English words with Hungarian number formats, as before. With `lang=ru` numbers and dates are Russian.
- `LANGUAGES` names: English, Español, Português, Français, Deutsch, Italiano, Nederlands, Svenska, Polski, Русский, Українська, Türkçe, 简体中文, 日本語, 한국어, Bahasa Indonesia, Tiếng Việt, ไทย. Each option carries its own `lang` attribute.
- Exports `itIT` and `idID` (not `it`, `id`): `it` collides with Vitest.

## Deviations
- Scope: 17 languages instead of 3 (owner, in this session). The PR title says so instead of "ru, es and pt-BR".
- Switcher: a native `select`, not a fourth radio group as lane G suggested. 18 radios pushed Theme, Times and Dates out of the panel.
- `MightRange` moved to its own file: `MembersExplorer.tsx` passed the 300-line lint limit by 2 lines after the five `useCopy()` calls.
- Screenshots: full pages for the four languages the task named; the other 14 as contact sheets (top of each page). All 18 × 3 pages × 2 themes were checked by script (below). JPEG, to keep 32 files at 10 MB.

## Verified
- `pnpm check`: green. Prettier, ESLint, tsc, drift gate; 38 test files, 179 tests passed, 1 skipped (pre-existing).
- Local stack: throwaway Postgres 18 seeded (3 Saturdays + 1 rehearsal), WebSocket bridge for the Neon driver, `next dev` with upstream URLs pointed at a closed port. No Neon database touched; 0 upstream API calls; `/api/quota` not called.
- curl, per `lang` cookie: `<html lang>`, `<title>` and `<h1>` in the language; status `Обновлено: 31 окт., 14:01 по серверу`; 404 title `La abuela se fue de paseo.`; `Accept-Language: pt-BR` with no cookie → pt-BR; /admin with `lang=ru` → `<div lang="en">`, English header.
- Playwright + system Chrome, 360 × 780, light and dark, 18 languages × event, alliance and player page (full page) and the open settings panel: 144 captures. In every one `scrollWidth` = 360 and no element passes the right edge or is clipped (script checks every box, sr-only excluded).
- Switcher flow, no cookie and `en-US` → Русский → reload → 日本語 → reload → Português → English: `<html lang>` and `<h1>` follow each pick and survive reloads. Cookie: `lang`, 365 days, Lax. Console: only local badge-image 404s, no hydration warning.
- Blank mode still works: `requestCopy` blanks the chosen dictionary, keeping the game terms (unit tests).

## Open issues
- Translations are drafts by Claude. One native member per language should review before merge. Least sure:
  - all: `sanctuary` (the game's own word in each language is unknown), `byline` (Old Grandmas kept as a name), `manualRound`, the 404/500 jokes.
  - ru, uk: `time.serverTime` "по серверу" / "за сервером" after a time; `search.seen` "Последний раз" / "Востаннє"; `members.byName` "А–Я" over mostly Latin names.
  - es: `asOf` "Datos de {time}"; `fresh.fresh` "Al día"; `byHand` "Lo lanza el admin a mano".
  - pt-BR: `site.ledger` "Registro de eventos"; `byHand` "Rodado à mão pelo admin"; `empty.noMembers` "Ninguém aqui bate."
  - fr: `manualRound` "Manche manuelle"; `fresh.stale` "Périmé"; non-breaking spaces before colons.
  - de: `site.ledger` "Event-Chronik"; `settings.theme` "Design"; `members.clear` "Entfernen".
  - it: `site.byline` "tenuto dalle Old Grandmas"; `leadership.title` "Comando".
  - nl: `ledger.joined/left` "erbij" / "weg" (`+3 erbij`).
  - sv: `site.ledger` "Eventlogg"; `members.byName` "A–Ö".
  - pl: `ledger.joined/left` "doszło" / "odeszło"; `time.*` in the genitive ("14:01 czasu serwera").
  - tr: `ledger.since` "{date} sonrası"; `sanctuary` "Sığınak"; `legend.rounded` suffix "Tam sayılar’ı".
  - zh-CN: `ledger.ranking` "服务器排名"; `leadership.leader` "盟主".
  - ja: `legend.rounded` "概数：…"; `search.seen` "最終確認".
  - ko: `leadership.leader` "맹주"; `asOf` "{time} 기준".
  - id: `sanctuary` "Suaka"; `site.ledger` "Buku Event".
  - vi: `ledger.joined/left` "vào" / "rời"; `fresh.stale` "Cũ".
  - th: `manualRound` "รอบแมนนวล"; `legend.rounded`.
- At 360 px the header's Players link and date button wrap to two lines in ja, vi and pt-BR (`sáb., 31 de out.` is Intl's short date). No overflow; the buttons stay 44 px.
- Spanish compact numbers read `4370 M`: Intl's `es` compact format has no billions. It already happened for Spanish browsers before this change.
- Page titles (Young Serif) use the system serif for Cyrillic and Vietnamese; CJK and Thai use system fonts throughout.
- /admin words stay English, but its number and date formats follow the Intl locale, which now follows the `lang` cookie (they followed Accept-Language before).
- /brand's `MemberMark` specimen reads its screen-reader text in the viewer's language (it uses `useCopy`).
- Any Chinese browser, zh-TW included, reads Simplified Chinese.
- Without JavaScript the gear panel is empty, so the language comes from Accept-Language only (same as times and dates).
- Pre-existing, not changed: with load average ~67 the JSX-text scan in `lib/copy.test.ts` once timed out at 5 s; it passes on rerun.
- Follow-up: an issue for right-to-left languages (ar, fa, he).

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches page words only; the collector, cron path, quota and Discord messages are unchanged.
Owner must do first: get one native member per language to review the dictionaries (the files are `lib/copy.<tag>.ts`), then merge this PR into `dev`. No migration, no new environment variable.
Plan changes needed: none for Session 9. IMPLEMENTATION_PLAN.md §9 lists translation as v2 (ru, es, pt-BR); it is now v1.1 with 17 languages (D39).

<adjustments>
- If the owner's browser has a `lang` cookie or a non-English Accept-Language, public pages read in that language and numbers and dates follow it. Expected, not a dry-run bug. /admin, Discord messages and run logs are always English.
- The dry run's checks of public page text should use `lang=en` (or no cookie with an English browser) to compare with the English strings in handoffs.
</adjustments>

<adjustments for="Session 10">
- The README should say that the gear's first control picks the page language (18 languages); the choice is a cookie in that browser. Discord messages and /admin stay English (D39). Might, Kills, Members and Level are English in every language.
- Translations are in `lib/copy.<tag>.ts`; CONTRIBUTING.md should say that a new public string needs a key in `en` and in every dictionary (typecheck enforces it).
</adjustments>
