# 11i — Notices library with Translate and Improve writing (Groq, D81)

Issues #304 (notices library) and #305 (translation of officer-written text, Improve writing). Rules applied: D71, D73, D75, D77, issue 293's write rule. Decision D81. Branch `session/11i-notices` from `dev` (b860720), merged with `origin/dev` at 61eb192 (11n, #341).

## Built
- **`/w/[slug]/notices`**, the library (`app/(private)/w/[slug]/notices/page.tsx`):
  - `noticePage` (`app/(private)/_ui/notice-pages.ts`) runs `requireWorkspace` first, inside `withPageDb`, then the read; a refused visitor goes through `refuse`.
  - h1 "Notices", the lead line "Written once, read in each officer's language. Copy it straight into the game or Discord." (the panel's per-tab tip, issue 312), and "Write a notice".
  - One card per notice, the most recently changed first: the title; EN · PT · FR, each "✓", "may be out of date" or "—"; "Leadership only" or "For members", and "Until <date>" or "Ended <date>"; "Last change by <name> · <day hh:mm> server time". One column below 640 px, two from 640 px.
- **The Notices tab**: a sixth tab, a link with `aria-current`, between Calendar and Follow-up. Its mark is a megaphone drawn with the brand's 24 px icon helpers (the confident nib), added to `TabIcon.tsx`. Tab labels may now hyphenate or break inside a word (`hyphens-auto`, `overflow-wrap: anywhere`), so "Acompanhar" stays inside its 60 px column at 360 px.
- **`/w/[slug]/notices/new`**: the editor, empty. The first Save makes the notice and opens it.
- **`/w/[slug]/notices/[id]`** (`NoticeScreen.tsx`): a notice of another workspace is a 404.
  - The title, "Written by … · …", "Last change by … · …", the members flag and the end date, and Edit.
  - Each language, the officer's own first: its name, the counter, the text (`translate="no"`, `lang`), and **Copy EN / Copy PT / Copy FR** (the body only). An empty language reads "Not written yet."
  - A language that may be out of date shows "May be out of date — translate again?" with **Translate from <code>** (opens the editor and translates from the newest language into this one) and **Keep as is** (saves it unchanged, which clears the line).
- **The editor** (`NoticeEditor.tsx`, `NoticeLanguageField.tsx`, `notice-draft.ts`):
  - title; the three languages, each with the counter `n / 1000` (a soft warning over 1000: "Over the game's 1000 characters: the game may cut the end.", never a block), **Translate into <the other two>**, and **Improve writing** with six chips: More formal · Warmer · Kinder · More direct · Shorter · Fix mistakes only;
  - an answer is a draft: "Draft: read it and fix anything before saving." with Undo;
  - "Show to members" (off by default; "strategy stays with the leadership") and "Ends on" (a date, optional, with Clear);
  - a Save bar that stays above the tabs and holds the last error;
  - a field someone else saved first shows "<name> changed this <n> ago:", their text, and **Keep their version** / **Use my version**.
  - Without `GROQ_API_KEY` the AI buttons are disabled and the editor says "Translate and Improve writing are not set up on this site yet."
- **Saves** (`POST /api/w/[slug]/notices`, `{id?, changes}`): same origin and JSON (D71), a session, then `saveNotice` (`lib/private/notices.ts`):
  - each change is `{field, value, version, from?}`; `version` is the id of the edit the officer was looking at (0 for none);
  - in one transaction with the notice's row locked (`lib/repo/notices.ts` `writeNotice`), `planSave` (`lib/private/notice-rules.ts`) compares every version. Any stale one refuses the whole save with **409** `{code: "conflict", conflicts: [{field, value, version, by, at}]}` and nothing is written;
  - otherwise each changed field is a new `notice_edits` row (append-only, issue 293), and `notices.updated_by/at` move.
- **Drafts** (`POST /api/w/[slug]/notices/draft`): `{kind: "translate", from, to[], text}` or `{kind: "improve", language, tone, text}` → `{drafts: {<language>: text}}`. 503 `not_set_up` without the key; 504 timeout, 429 busy, 502 failed. `privateLog` codes only: `notices.translate.ok` etc. with `ms`.
- **`lib/ai/`** (D81), which imports nothing from the project:
  - `groq.ts`: `groqChat(key, fetch, timeoutMs)`; `openai/gpt-oss-120b` (`reasoning_effort: "low"`), then `qwen/qwen3.8-27b` (`"none"`) on any failure; temperature 0.2; 15 s per model; 2,000 completion tokens; an answer cut at the limit counts as a failure.
  - `notice-writing.ts`: `TRANSLATE_SYSTEM`, `improveSystem(limit)`, `translateText`, `improveText`, and `plainText`, which makes an answer pasteable (below).
  - `glossary.ts`: the short forms' meanings and the do-not-translate list.
- **`GROQ_API_KEY`**: optional in `lib/env.ts` (a `gsk_` key), made into `AppContext.ai` in `lib/app-context.ts` (null without it), on `secretsOf`'s redaction list, in `.env.example`.
- **Out of date** (`notice-rules.ts`): each language row stores `basis`, the revision of the notice its text reflects.
  - A hand change to up-to-date text starts revision `newest + 1`.
  - A translation takes its source's revision; a translation of a text that changed since gets 0, so it is behind at once.
  - Saving a language that was behind, or empty, by hand catches it up (`basis = newest`).
  - A language is out of date when its basis is below the newest written language's.
- **Tables** (migration **0021_notices**, `lib/schema-notices.ts`, listed in `drizzle.config.ts` beside `lib/schema.ts`):
  - `notices`: id, workspace_id, created_by/at, updated_by/at;
  - `notice_edits`: id (= version), notice_id, workspace_id, field (check: title, en, pt-BR, fr, for_members, ends_on), value, basis, edited_by/at.
  - Users are `on delete set null`; workspaces cascade.
- **Words**: 55 keys in en, pt-BR and fr, `tab.notices` and `notices.*`, in `lib/private/dictionary.notices.ts`, spread into each of the three dictionaries (one line each). French has U+00A0 before `: ; ! ?`. Language headings are each language's own name (English, Português, Français).
- **Analytics**: `ws_notice_translated` (no properties), sent when Translate fills drafts; D77 amended.
- **Fences**:
  - eslint zone: `lib/ai` imports nothing from the project;
  - `roster-fields.test.ts` asserts that `lib/ai/*.ts` and the draft route are in its scan.
- **Docs**: D81 and its index line, D77's event list, `docs/ARCHITECTURE.md` (`lib/ai`, the notices modules, the dependency rule), `docs/GLOSSARY.md` ("notice").
- **Tests** (12):
  - `lib/ai/groq.test.ts` (5):
    - the request shape: key, model, temperature 0.2, exactly five body keys, two messages;
    - fallback after a 429, a 503 and a cut answer, and "busy" when both answer 429;
    - a timeout of each model;
    - the prompts carry the do-not-translate list and the people-first rule, and Improve writing's exact request;
    - `plainText`.
  - `lib/private/notice-rules.test.ts` (4): the counter; the out-of-date marker played as a sequence of saves; a translation of an older text; a whole save refused on one stale field.
  - `app/(private)/api/w/[slug]/notices/route.test.ts` (3, PGlite): two officers on different fields both persist; on the same field the second gets 409 with the first one's text and author, and none of their changes is written; another workspace's notice is 404.

## Decisions
- **A sixth tab.** No Notices tab existed: the five were Home, Members, Roll call, Calendar and Follow-up. The prototype had notices inside Calendar, while the persona panel (#312) and 11e's handoff call Notices a tab. A sixth tab is the reading of "turn the Notices tab into a link" that needs no Calendar.
- **One title** for all three languages, as the brief lists it; Translate fills the bodies only.
- **409 refuses the whole save.** The officer's other changes stay in the editor and go out with the next Save, after choosing a version for each conflict. Different fields never conflict.
- **`for_members` and `ends_on` use the same versioned path** as the text: one write path, issue 293's rule for every field.
- **Characters are counted as a reader sees them** (`Intl.Segmenter` graphemes): an emoji is 1.
- **Copy copies the language's text only**, without the title: the game's notice board and mail have their own title field.
- **"Keep as is"** implements the owner's "until they are retranslated or saved" (#305) for a language that needs no change.
- **Plain text for the game.** gpt-oss-120b answered with U+202F narrow no-break spaces (also in "12:00 ST" and "Squad 1"), U+2011 non-breaking hyphens and Markdown's two trailing spaces on 3–5 lines per answer. The prompt now asks for plain text, and `plainText` maps U+202F to U+00A0 in French and to a space elsewhere, U+2011 to `-`, and drops trailing spaces. The final run's answers had none of these, and French had U+00A0 before `! : ?`.
- **The words live in their own module.** `dictionary.ts` was at 200 of 300 lines, and 11f edits the same three files.
- **The tables live in their own schema module.** With them, `lib/schema.ts` reached 314 counted lines (the cap is 300). `lib/schema-notices.ts` imports `workspaces` and `workspaceUsers` from `lib/schema.ts`, never the other way. No code uses Drizzle's relational `db.query`, so `lib/db.ts` is unchanged.
- **The draft route sits under `/notices`, but nothing in it is notice-specific** (text in, drafts out). The officer notes of #297 can call it as it is.

## Deviations
- **The migration is `0021_notices`** (journal idx 21, snapshot `prevId` = the id of dev's `0020_workspace_user_profile`), regenerated with `pnpm db:generate` after #341 (11n) took 0020 and was merged into this branch (61eb192). On the way it was briefly `0020_notices`. The SQL is identical every time.
- Not in the brief, added:
  - `plainText` (see Decisions);
  - "Keep as is";
  - Undo after a draft;
  - the error inside the sticky Save bar.
- D81 replaces D71's "player names are replaced by placeholders before sending" and "the result is cached for the next reader". The bake-off sent raw text (#305), and the officer saves the reviewed text.
- `reasoning_effort` ("low" for gpt-oss, "none" for qwen) is sent: the settings the bake-off measured.
- Not built from #304's first scope: images, a link to a calendar event, separate "copy for game notice / game mail / Discord" formats, and a view of the edit history. The history is stored, append-only.
- The per-tab tip is the Notices page's lead line. No line was added to the "?" sheet (11e's adjustment): the brief did not list it.

## Verified
- **`pnpm check` exit 0** after merging `origin/dev` at 61eb192 (11n) and regenerating the migration as `0021_notices`:
  - prettier, eslint, tsc;
  - vitest: **106 files passed, 2 skipped; 526 tests passed, 4 skipped**; no timeout;
  - drift gate: "Everything's fine";
  - i18n: 17 languages up to date.
  - Earlier rounds: 97 files and 491 tests before any merge; 100 files and 507 tests after merging 56c534e.
- **Groq model ids**: `GET /openai/v1/models` on 2026-11-16 listed `openai/gpt-oss-120b` and `qwen/qwen3.8-27b`, both active.
- **Probes**, each reverted: a scratch `lib/ai/zz-probe.ts` reading `daily_tech` and importing `lib/private/notice-rules`:
  - `roster-fields.test.ts` failed with `lib/ai/zz-probe.ts: daily_tech`;
  - eslint refused the import twice (the new D81 zone and D71's zone).
- **Local e2e** on a production build (`next build` + `next start`) of the merged tree:
  - setup: a local Postgres 18 cluster (54341) and its bridge (54342), the `ogs` workspace registered by SQL, a Discord stub with two officers (Ana, Bia), a worktree-only `.env.local` with random secrets, upstream pointed at a dead port, and the real `GROQ_API_KEY` copied from the main checkout's `.env.local` without printing it;
  - Playwright-core with system Chrome; harness `scratchpad/11i/pw/e2e.mjs`.
  - **81 of 81 checks passed**:
    - the Notices tab is a link and `aria-current`; the library says it is empty;
    - write a notice; the counter reads `369 / 1000`;
    - Translate EN → PT and FR, **real Groq**, 1.4 s for both; both are drafts;
    - PT and FR kept `[OGs]Mudkip`, `[OGs]Floki`, `12:00`, `11:50`, R4 and R5; FR has U+00A0 before `?`/`!`;
    - the officer edits the PT draft and saves; three languages, none out of date, "Leadership only";
    - Copy EN and Copy PT put exactly that text on the clipboard;
    - edit English: PT and FR show "May be out of date", and the card says so;
    - Improve writing → Warmer rewrote the English and kept names and times; Undo restored it;
    - "Translate from EN" on PT: only FR stays out of date; "Keep as is" on FR clears it;
    - **concurrent edit**: Ana and Bia open the editor; Ana saves the title first; Bia's save gets **409** with Ana's title and "Ana"; Bia sees "Ana changed this 1 second ago:" with the text, and the error stays in view beside Save; "Use my version", then Save, saves Bia's title and her other field;
    - 1,005 characters in French show the warning and still save (`1005 / 1000`);
    - no sideways scroll on list, notice and editor at 360 and 1280, light and dark, EN and PT, and FR at 360; every target at 360 is 44 px or more (a checkbox measured by its label); the tab labels fit in EN, PT and FR.
  - **Without the key** (the same build on 3242 with `GROQ_API_KEY=`): the editor says "not set up", Translate and Improve writing are disabled, and the draft route answers 503 `not_set_up`. 4 of 4 checks passed.
  - The server log held only `{"code":"notices.translate.ok","ms":1077}`, `{"code":"notices.improve.ok","ms":959}` and the like, never text.
  - **Groq use** in this session: 1 models list, and 17 chat requests over three full e2e runs and the smoke below (fallbacks, if any, are not counted separately). In the last run the server timed four draft calls at 654–1,077 ms each; the first was EN→PT and FR in parallel, at 1,077 ms.
- **Smoke after merging 11n** (61eb192), on a production build and a fresh local database where all 22 migrations applied in order (`0020_workspace_user_profile`, then `0021_notices`). 8 of 8 checks passed:
  - the Notices tab is still a link in 11n's shell;
  - write a notice, then Translate EN→PT/FR with the real key (1.8 s, two requests), which kept the names and 18:00;
  - Save: three languages, none out of date;
  - Copy FR copies the French; no sideways scroll at 360 px.
  - The French answer joined two paragraphs into one: another answer the officer reviews.
- **The invented e2e notice, translated by the real Groq in the final run** (EN source: "Hi OGs! KvK starts Saturday at 12:00 ST. … Thank you all, see you on the battlefield!"):
  - EN→PT: "Oi OGs! KvK começa sábado às 12:00 ST. / 1. Bubble up antes das 11:50 ST se você não estiver em um rally. / 2. Squad 1 fica em casa para reforçar as torres da Royal City. / 3. Rallies: siga [OGs]Mudkip e [OGs]Floki no AC. / 4. Guarde seu Elixir e pelo menos 3h de speedups para o contra-ataque. / Dúvidas? Pergunte a qualquer R4 ou R5. Obrigado a todos, nos vemos no campo de batalha!"
  - EN→FR: "Salut OGs ! KvK commence samedi à 12:00 ST. / 1. Bubble up avant 11:50 ST si vous n’êtes pas en rally. / 2. Squad 1 reste à la maison pour renforcer les tourelles du Royal City. / 3. Rallies : suivez [OGs]Mudkip et [OGs]Floki dans Alliance Chat (AC). / 4. Gardez votre Elixir et au moins 3 h de speedups pour la contre-attaque. / Des questions ? Demandez à n’importe quel R4 ou R5. Merci à tous, à bientôt sur le champ de bataille!"
- **Privacy terms** read 2026-11-16:
  - Groq Services Agreement §4.2: "Groq is not permitted to use Inputs or Outputs for training or fine-tuning any AI Model Services."
  - "Your Data": no retention by default; logs of up to 30 days for reliability or abuse, which Zero Data Retention turns off.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11i-shots/`:
  - list, notice and editor at 360 and 1280, light and dark, EN and PT, plus FR at 360;
  - drafts after Translate, Warmer, the conflict (full page and viewport), over the limit, without the key, the out-of-date view and list.

## Open issues
1. **#304's done_when needs the real notices.** Queen position, the weekly schedule and the Kingdom War defense have to be entered in `/w/ogs/notices` by an officer. They are not in the repo, because the repo is public. #305's "existing notices arrive pre-translated by the agents" needs a way to load them that keeps them out of git, for example an officer pasting them in.
2. The model's answers still need the officer's review:
   - "3h" sometimes became "3 h";
   - one French answer ended "bataille!" without the no-break space;
   - a Warmer rewrite shortened "Alliance Chat (AC)" to "AC";
   - the second Warmer run on the same text changed little.
3. **Out-of-date edge cases**:
   - A hand edit of a language that was behind counts as catching up, even when it adds something new; the others are not marked.
   - When the source text is edited after Translate and before Save, the translation is saved as a hand edit and may show as up to date.
4. **PT tab labels at 360 px hyphenate** ("Chama-da", "Acompa-nhar"), and EN "Follow-up" breaks at its hyphen. A shorter PT word for Follow-up would read better; that is a copy decision.
5. **The draft route has no rate limit**: signed-in officers only. Groq's free tier caps it at 1,000 requests a day per model.
6. **The game's own character count is unknown** (graphemes here).
7. **Notices cannot be deleted** (not asked).
8. **A fallback to the second model is not logged on its own**, only the outcome.
9. `lib/schema.ts` is at about 278 of 300 counted lines. A new table belongs in its own schema module listed in `drizzle.config.ts` (the `lib/schema-notices.ts` pattern).

## Next
Session: #300 — Workspace: Days tab with the event calendar and caravan picks (the last thing #331's members' board waits for).
Model / effort: keep — no signal. The session fit one build pass plus two e2e rounds; the failures were layout and model-output quirks, found by the e2e.
Owner must do first:
1. Merge this PR into `dev`. The migration is `0021_notices`; if 11f lands a 0021 first, this one is renumbered again (drop it and its journal entry, merge `dev`, `pnpm db:generate`, as done here).
2. Optional, recommended: Groq console → Data Controls → **Zero Data Retention** on, so no 30-day abuse logs of officer text are kept (D81).
3. Check that `GROQ_API_KEY` is set in Vercel Production and Preview (the #305 comment says it is).
4. For #304's done_when: an officer enters the three current notices on `/w/ogs/notices`, translates, reviews, and pastes each language into the game from a phone.
Plan changes needed: none. The workspace track lives in issues #293–#331, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- The save pattern for any workspace record (issue 293): `writeNotice(db, target, decide)` in `lib/repo/notices.ts` locks the row, reads the newest value per field (`DISTINCT ON`), and lets a pure `decide` refuse or write. `planSave` in `lib/private/notice-rules.ts` is the version check; `route.test.ts` beside the notices route is the two-officer test template. Calendar entries can copy all three.
- The tab bar has six columns (`Frame.tsx` `TABS`, `PATHS`). The Calendar tab only needs `PATHS.days`. Labels may hyphenate at 360 px.
- New tables go in their own schema module, listed in `drizzle.config.ts` (`lib/schema.ts` is at about 278 of 300 counted lines). New words go in their own dictionary module, spread into the three dictionaries (`dictionary.notices.ts`).
- Translate for any officer text: `POST /api/w/[slug]/notices/draft` takes `{kind: "translate", from, to, text}` and returns drafts. `AppContext.ai` is null without the key; pages pass `getAppContext().ai !== null` to disable the buttons.
- `for_members` in the calendar should match the notices: a value "true"/"false", off by default.
</adjustments>

<adjustments for="Session #331 (members' board)">
- Member notices are the notices whose newest `for_members` edit is "true" and whose newest `ends_on` is "" or not before today's server day (`serverDay`). `NoticeSummary` (`lib/private/notices.ts`) already carries `forMembers` and `endsOn`. A members-tier read needs its own access type: a member session must never get a `WorkspaceAccess`, which opens everything.
- Each notice has text per language and may lack one. Which language a member sees when theirs is missing is not decided.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/344
