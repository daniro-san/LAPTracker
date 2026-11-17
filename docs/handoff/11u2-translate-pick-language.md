# 11u2 — "Translate for me": pick another language (D101 amended)

## Built
- **Already in the asker's language.** "Translate for me" no longer answers "This message is already in your language." It answers at once, privately, without the translator:
  - the message's text in an embed headed with its language ("🇬🇧 English");
  - the line "Already in English. Translate to:" / "Já está em português. Traduzir para:" / "Déjà en français. Traduire en :" in the embed's footer;
  - a button for each other language, by its own name: [Português] [Français].

  The same reply comes when the translator finds the text already in the asker's language (D81's `same`).
- **A translation.** Under the translated text, the footer says "Other language:" / "Outro idioma:" / "Autre langue :" and has a button for each language except the one shown. "Partly untranslated", when present, stays on the line above it.
- **A press** (`tm:<to>:<shown>:<user id>`):
  - It counts only when that user id is the presser, the message is private (`flags & 64`) and the message's `interaction_metadata` user is the presser. Anything else gets "Only the person who opened this menu can use it."
  - It counts one unit against the per-person limit and the daily cap.
  - It is answered with type 7: "Translating…" and no buttons. Then the same message is edited with the new language and its own buttons.
  - Past a limit, the type 7 line says so and keeps the text and the buttons. When the translator fails after a press, the failure line comes with the buttons back.
- The text is read back from the shown embed, as Post reads the picker's. It is masked again before the request. Every reply and edit sends `allowed_mentions: { parse: [] }`.
- Files:
  - `lib/private/translate-message.ts`: `parseSwitchId`, `switchRows`, `forMeMessage`.
  - `lib/private/discord-translate.ts`: the "already" reply, `switchLanguage`, and `translateComponent` dispatching to `pickerPress`.
  - `lib/private/discord-translate-run.ts`: `forMe` draws the reply with the buttons.
  - `lib/private/dictionary.translate.ts`: `translate.discord.same` is replaced by `translate.discord.already` and `translate.discord.other` in EN, PT and FR.
  - The D101 dated amendment.
- **Moved, not changed:** the text check and the quota (`checkedText`, `quota`, `quotaLine`, `TRANSLATE_PER_*`) went from `discord-translate.ts` to the new `lib/private/translate-limits.ts`. With the new code, `discord-translate.ts` was over eslint's 300-line limit. The new press tests are in `lib/private/discord-translate-me.test.ts` for the same reason.

## Decisions
- **The source of a press is the text shown, not the original message.** The app does not keep the message, and the brief says to read it from the shown embed. So English → Português → English shows the Portuguese translated back, not the original words. This is written in the D101 amendment.
- The "already" reply shows the message's text, so that a press has something to read back.
- The "Already…" and "Other language:" lines go in the embed footer. Discord cannot put text inside a button row, and the footer sits directly above the buttons. Button labels are the plain language names, with no flags, as the brief's example shows.
- A press does not check again that the server has a workspace. The picker's presses do not check it either.

## Deviations
- None from the brief. The file split above was needed to pass lint.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest **918 passed, 4 skipped**, drift check, i18n check.
- New and changed tests:
  - already-in-language shows the two buttons;
  - a press answers type 7 and makes a job from the shown language into the pressed one;
  - a press by someone else, or from someone else's message, is refused;
  - a press counts one unit (the 6th in a minute is refused);
  - the edited reply leaves out the shown language's button;
  - a pressed job edits `@original` with Portuguese and [English][Français].
- **Local e2e** on a production build (`next build`, `next start` on :3971):
  - Setup: local Postgres 18 with 35 migrations, the bridge, an invented workspace row, a Discord API stand-in that records every request, and an in-process Groq stand-in preload. Interactions were signed with a test Ed25519 key.
  - **20 of 20 checks pass:**
    - already: type 4 private, the footer line, the text shown, [Português][Français], buttons bound to the asker, mentions off;
    - a press: type 7 "Translating…" with no buttons, then one PATCH of the press's `@original` with the Portuguese embed, the channel mention put back, the content cleared, the footer, [English][Français], mentions off;
    - a second switch to French: [English][Português];
    - someone else's press and a press on a non-private message are refused, with no Discord or Groq call;
    - "for me" in French: deferred, then "Autre langue :" with [English][Português];
    - the 4th and 5th units pass and the 6th is refused with type 7, keeping the buttons.
  - The Groq stand-in got **5 calls**, one per counted unit. Refused presses called nothing.
  - Server log: only `discord.translate.me` ×5, `done` ×5 and `limited` ×1. A grep for the message text, the ids, the bot token, the gsk key and the webhook token found nothing.
  - No real Discord, Groq or upstream call.
- Privacy: the diff and the new files were grepped against the 307 names in `fixtures/`: no hit. Everything is invented.
- Not run: screenshots. The change is Discord message payloads only, with no page, and a Discord client cannot be rendered here. The e2e checks the exact payloads.

## Open issues
- On real Discord, confirm:
  - an embed footer with two lines ("partly" plus "Other language:") reads well on mobile;
  - editing `@original` from a component interaction's token edits the private message the button is on. Discord documents this; the "for everyone" Post already relies on it.
- Translating the shown translation (see Decisions) can drift over several switches. If the officers notice it, a fix would put the original text in the reply as well.

## Next
- Model/effort: keep. The change fit one pass. The extra time went to the lint split and the e2e harness.
- What the owner must do first: merge and release. No new env var, no migration, no need to register the commands again.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- `translate.discord.same` no longer exists. Use `translate.discord.already` or `translate.discord.other`.
- The quota and text checks for Discord Translate are in `lib/private/translate-limits.ts`. Import `TRANSLATE_PER_MINUTE` and `TRANSLATE_PER_DAY` from there.
- `TranslationJob` now requires `userId` and has an optional `pressed`.
- `discord-translate.ts` is close to the 300-line limit. New Translate behavior should go in its own module.
</adjustments>

PR: (added by the orchestrator)
