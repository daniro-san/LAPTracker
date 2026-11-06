---
name: translate-copy
description: Bring every language of LAPTracker's public pages up to date with the English in lib/copy.ts — translate missing and stale keys with one Haiku translator subagent per language, stamp them, run pnpm check. Use when `pnpm check` (or the Stop hook) says "Run the translate-copy skill", after editing public strings in lib/copy.ts, or to add a language. Do NOT use for /admin, /brand or Discord copy (English only, D48) or to change the English itself.
---

# Translate the public copy

The public pages read in every language of `LANGUAGES` (`lib/copy.ts`). Each language is `lib/i18n/<tag>.ts`, a partial copy of `en`; a missing key shows English. `lib/i18n/<tag>.stamps.json` holds, per key, a hash of the English the translation came from, so `scripts/i18n-check.ts` (a step of `pnpm check`) fails when English changed and the translation did not. You orchestrate; the `translator` subagent (`.claude/agents/translator.md`) translates.

## Workflow

1. **List the work:** `pnpm -s i18n:todo > <scratch>/todo.json`. `{}` means nothing to do: stop. Otherwise it maps each language to its keys: `{ "ru": { "status.next": { "en": "…", "current": "…" } } }`.
2. **Dispatch one translator per language, all in one message** (they run in parallel): Agent tool, `subagent_type: "translator"`, prompt = the language tag and its JSON object from step 1, verbatim. Nothing else is needed: the agent reads the file, the glossary and the rules itself.
3. **Spot-check, don't retranslate.** For each language read its report and look at two or three of its new strings: placeholders present, game terms exactly as the glossary's "Game terms (from the game)" section gives them (English where it has none), length close to the English, and a quick back-translation that still means the English. A language that reads wrong: dispatch it again with a note, or on a bigger model (below).
4. **Stamp:** `pnpm -s i18n:stamp`. It marks every translated key fresh against today's English, so run it only after every language in `todo.json` came back done. Never stamp to silence the check.
5. **Check:** `pnpm check` must be green (types, placeholders and freshness). Then commit the dictionaries, stamps and glossaries with the English change.

## Model

The translator is Haiku on purpose: the strings are short and there are many languages, so the cost stays small. When one language reads poorly, rerun only that language with `model: "sonnet"` (or `"opus"`) in its Agent call; to change the default for every run, edit `model:` in `.claude/agents/translator.md`.

## Adding a language

1. Add its tag to `LANGUAGES` in `lib/copy.ts` (the switcher names it with `Intl.DisplayNames`).
2. Create `lib/i18n/<tag>.ts` exporting `{} as const satisfies Translation` (copy the header comment of another file) and register it in `lib/i18n/index.ts`.
3. Create `lib/i18n/glossary/<tag>.md` from another language's table, the right column empty, with a "Game terms (from the game)" section that lists only words sourced from the game's own text in that language (none: the four stay English).
4. Check `pickLanguage` in `app/_ui/locale.ts` maps the browser's tags to it (`REGIONAL` for one regional form, like pt → pt-BR).
5. Run the workflow above: every key is missing, so the translator writes the whole file. Then screenshot the event and alliance pages at 360 px, light and dark, and check nothing overflows. Right-to-left languages also need `dir="rtl"` and layout work first (D48).

## Rules the translator follows

Placeholders `{name}` exact; Might, Kills, Members and Level as the glossary's "Game terms (from the game)" section sources them, else English, never coined (D52; the translations test fails on any other word); labels at most two words (abbreviate the language's own way); `Label: {n}` for counts; DESIGN.md voice; the glossary reused and extended. They are in `.claude/agents/translator.md`; change them there.
