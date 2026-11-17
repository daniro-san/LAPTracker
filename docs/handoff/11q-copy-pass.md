# 11q — Copy pass: every page written like a person

Issue #362. The owner said the text on /admin, the workspace and the public pages read like AI. Branch `chore/copy-pass` from `origin/dev` (5b17636), which already holds the in-flight UI PRs the issue waits for (#360, #367, #369).

## Built
- **Public pages** (`lib/copy.ts` and its parts), 10 English strings:
  - `empty.noMembers`, `search.pending`;
  - `balance.lead`, `balance.builderHelp`;
  - `flow.lead`, `flow.small`;
  - `merge.tag`, `merge.lead`;
  - `standing.leadGrowth`, `ledger.carriedRatioHelp`.
  - All 17 languages were translated again for these 10 keys with the translate-copy skill, one `translator` agent per language, then stamped.
- **/admin** (English only, D48), 8 strings: `status.quotaNoteOld`, `run.intro`, `run.live.note`, `rehearsal.help`, `members.help`, `members.unchangedHelp`, `guide.entries.network.action`, `workspaces.command.reasons.429`.
- **Discord admin messages**, 2 strings: `mightLine` (the em dash before the link is now ` · `) and `pinLocked`.
- **Workspace**, 25 keys, each in EN, pt-BR and fr (75 strings):
  - `dictionary.ts`: `signin.note`, `thanks.intro`, `members.checkinHelp`, `members.nodataHelp`, `intro.1.body`, `intro.3.body`, `intro.3.more`, `intro.3.note`, `howto.after`;
  - `dictionary.members*`: `list.headingLead`;
  - `dictionary.calendar*`: `calendar.legend`, `calendar.form.nameHint`;
  - `dictionary.notices`: `notices.lead`, `notices.empty`, `notices.conflict.banner`, `notices.show.help`;
  - `dictionary.thefts`: `thefts.form.whenHelp`, `thefts.e.failed`;
  - `dictionary.shots*`: `shots.lead`, `shots.help`, `shots.unrecognised`, `shots.soon`, `shots.e.cannot_save`, `shots.kindUnsure`, `shots.discord.unrecognised` (the last two are also Discord bot replies).
- `docs/DESIGN.md`: the quoted search-pending line follows the new wording.
- Tests: three expected strings updated (`lib/notify.test.ts`, `lib/quota-report.test.ts`, `lib/private/discord-interaction.test.ts`). No assertion was loosened.

## Decisions
- **What counted as slop.** None of the filler words in the brief ("seamlessly", "simply", "just", "Let's", exclamation marks, "AI") were in any English string. These patterns were:
  - semicolons joining two sentences;
  - em dashes as sentence joints;
  - "not X, not Y" contrasts;
  - the same idea said twice on one screen (the thanks card, the Members legend, To review, the flow page's chip and lead);
  - idioms a second-language reader trips on ("sorts it out", "a friendly word", "carried the week", "read, then forgotten", "leafing");
  - slogan lines ("Written once, read in each officer’s language");
  - `≠` used in place of words.
- **Kept the brand lines DESIGN.md names**: "Nothing recorded yet. The kettle is on.", "Grandma wandered off.", "Something cracked.", "It's okay, grandma will clean it.", "Grandma noticed", and the byline. The workspace's "Nothing here yet. The kettle is on." follows the same line. Only "Grandma checked twice" (a joke) was dropped, and "leafing" became "searching".
- **Changed only strings with a pattern.** Most strings were already short and literal, so the change is surgical, not a rewrite of every string. This also keeps the translation churn small.
- `shots.kindUnsure` became "{kind} (daily or weekly?)". A colon gave "Read: Alliance Duel: daily or weekly?" in the Discord reply.
- `thefts.e.failed` now uses the same "Could not save. Try again." as every other form.
- **Hand fixes after the translators**: in French, `flow.lead` kept a sentence the new English dropped; Swedish `balance.builderHelp` had the wrong word order; Polish `search.pending` still said "browsing".

## Deviations
- /brand page text (`lib/copy-brand*.ts`) was not changed. It describes the brand itself and is a design reference.
- No PR was opened and nothing was pushed, as the brief asked. The orchestrator opens the PR.

## Verified
- **`pnpm check` exit 0** (prettier, eslint, tsc, vitest, drift, i18n): 142 files passed, 2 skipped; 720 tests passed, 4 skipped. The i18n step reported "17 languages up to date with English".
- **360 px, production build** (`next build`, `next start` on :3337):
  - Setup:
    - a local Postgres on 54737, migrated through 0025, with its bridge on 54738;
    - the invented 11o seed (100 members, 16 end-of-day reads);
    - the 11o Discord stub on 54739;
    - upstream pointed at a dead port.
  - Screens, light: workspace Home, first-use cards 1 and 3, Members with the legend open, Notices, the notice editor, Calendar and Thefts, each in EN and PT; public Home, an alliance page, flow, merge and balance; /admin and /admin/members.
  - 46 checks: no sideways scroll anywhere. No paragraph, heading, list item or label is wider than its box, except /admin's three seal labels. Those labels are unchanged copy, and the screenshot shows them wrapping under the seals as designed.
  - Script and screenshots: `scratchpad/copy-pass/shots.mjs`, `scratchpad/copy-pass/shots/`.
- **No upstream, Groq or real Discord call.** All names are invented.

## Open issues
1. "The kettle is on." (public empty state and workspace Home) is an English idiom. A second-language reader may not get it. DESIGN.md names it as the brand line, so it is the owner's call.
2. "Grandma noticed" as the movers title does not say what the section holds; the tabs under it do. Owner's call, same reason.
3. `thefts.lead` says "Use it to warn them". It is unclear whether "them" means our members or the thieves. Not changed, because guessing would change the meaning.
4. /brand prose was not reviewed for this pass.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The pass fit one round. Most time went to the translator round-trips (17 agents, three at a time) and the local build.
Owner must do first: read the before/after sample (`scratchpad/copy-pass/SAMPLE.md`), and answer open issues 1–3.
Plan changes needed: none.

<adjustments>
- Copy rules that held up, for any new string: one idea per sentence; no semicolons or em dashes joining sentences; no "not X, but Y"; say each idea once per screen; no idioms. "Could not save. Try again." is the one save error.
- A translation pass for N changed public keys: `pnpm -s i18n:todo`, one `translator` per language, given its JSON file path and the worktree path, then spot-check that it did not keep sentences the new English dropped.
</adjustments>

PR not opened yet: the orchestrator opens it (title `chore(copy): plain, literal wording on public pages, /admin and the workspace (#362)`).
