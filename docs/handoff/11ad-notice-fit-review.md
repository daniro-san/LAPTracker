# 11ad — Notices: Fit to 1,000, localized Translate, review requests

Issue #402 and the owner's comment of 2026-11-17. Branch `session/11ad-notice-fit-review`, rebased onto `origin/dev` 9bc0b507 (after #400, #401 and #403). Decision D113 (amends D81). Rules applied: D52, D71, D75, D81, D99, D100, D101, D102, D105.

## Built
- **Fit to 1,000** (`lib/ai/notice-writing.ts` `fitSystem`, `fitText`; `kind: "fit"` on `POST /api/w/[slug]/notices/draft`):
  - A third button, "Fit to 1,000 / Keeps the key points", appears on a language tab only while its text is over 1,000 characters (`canFit` in `notice-draft.ts`). On a phone it spans the row under Translate and Improve writing; from 640 px the three sit side by side.
  - The answer is a draft ("Draft from Fit to 1,000, not saved") with Accept and Undo.
  - The first request asks for 950 characters. If the answer is still over 1,000, one more asks for 800. If that is also over, the route answers 422 `still_over` and the editor shows a plain line; the officer's text stays.
  - The prompt writes in the tab's language, in that language's officer voice, and keeps dates, times, names, numbers and calls to action.
- **Localized Translate** (`localizeSystem(to, limit)`): the notices' Translate sends a localizer prompt per target language with the 1,000-character budget. It keeps D81's data-only rule, the `<text>` neutralising and the term rules. Discord's translator (D101) keeps `TRANSLATE_SYSTEM`: the localizer is used only when a limit is passed.
- **Review requests**:
  - Tables `notice_reviews` and `notice_review_outcomes` (migration `drizzle/0038_notice_reviews.sql`, regenerated after the rebase). Both are append-only and each row carries a request id.
  - `lib/repo/notice-reviews.ts` (reads and inserts, the officer list) and `lib/private/notice-reviews.ts` (ask, answer, the notice's list, Home's list).
  - `POST /api/w/[slug]/notices/reviews`: `ask` and `approve`. Officers only (401 `signed_out` otherwise), 403 `not_reviewer`, 409 `closed`.
  - The save route takes an optional `review: {id, requestId}`. After a successful save it closes that request as "edited".
  - Notice page (`NoticeReviews.tsx`): open requests at the top, with Approve and "Edit and save" for the officer who may answer. Further down, a "Review" section with the five newest outcomes and "Ask for a review" (a sheet: whole notice or one written language; the team or one officer).
  - Home: `ToReview` gets a `reviews` prop and lists one link per open request for this officer, above "Send screenshots".
  - The Home tab's number (`toReviewCount`, every page) adds the open requests for this officer to the screenshot drafts. A request the officer made does not count for them.
  - Recent activity (D108): "Ana asked Rook to review the notice “X” · PT" (or "asked the team"), "Rook approved the notice “X” · PT", and "Rook edited the notice “X” after a review". These are two more parts of the small-sources union read (`lib/repo/desk-activity-reviews.ts`). The edited line stands for the save it came with, which shares the outcome's instant (D108's rank rule).
- **Copy**: 31 keys in `lib/private/dictionary.notices-review.ts` (EN, PT-BR, FR), spread into `dictionary.notices.ts`. French uses U+00A0 before `:` and inside « ».
- **Tests**:
  - `notice-draft.test.ts` (+1): Fit only over the limit, counted in graphemes; its draft gets Accept and Undo.
  - `draft/route.test.ts` (+2): Translate sends each target's localizer with the 1000 budget. Fit is refused within the limit, retried at 800 after an answer over the limit, and gives 422 when both tries are over.
  - `groq.test.ts` (+1): the localizer and Fit keep the data-only line and the `<text>` neutralising.
  - `notices/reviews/route.test.ts` (new, 1): a request to one officer and one to the team; who sees which on Home; approve only by the one named, idempotent per request id; edit and save closes as edited; a late approve gets 409.
  - `member-session.test.ts`: the reviews route is added to the fixtures.
- **Docs**: D113, the decisions index, a dated amendment line in D81, `docs/ARCHITECTURE.md`.

## Decisions
- **Fit budgets 950, then 800.** The task gave no figure. Asking for a little under the limit first saves a retry when the model overshoots.
- **A fitted fresh translation keeps its source** (coordinator's decision). The save takes the source's basis, so the other languages are not marked out of date. Fit on hand-written text behaves like Improve writing. Undo after Fit on a translation that was not yet accepted brings back the text from before the translation, as Undo after Improve writing does.
- **Discord's translator is unchanged.** The issue is about the notices' Translate, so `translateText` uses the localizer only when the route passes a limit.
- **The localizer voices.** Brazilian Portuguese addresses members as "vocês"; French as « vous » (plural address, and the desk's French UI already uses vous).
- **Who answers a team request.** Any officer except the one who asked.
- **Who can be named.** A workspace user with an officer session row who is not blocked. Asking yourself is refused (400 `reviewer`).
- **No note field.** The owner allowed an optional short note "only if it costs nothing". It would need its own field, copy and display, so it is left out.
- **Edit and save with no change** does not close the request. The editor closes without saving, as it always does. Approve is the action for "no change needed".
- **Groq quota.** Fit is one more request on the same route. The app has no counter of its own for notice AI requests (Discord's Translate has one, D101), so Fit uses Groq's free tier exactly as Improve writing does.

## Deviations
- **Size limits after the rebase.** Home's page and `lib/repo/desk-activity.ts` would have passed 300 lines. The review links are now built inside `ToReview`, and the review parts of the union read sit in `lib/repo/desk-activity-reviews.ts`. In `lib/private/desk-activity.ts`, every notice line (save, post, review asked, review answered) goes through one `noticeItem`, to stay under the complexity limit.

## Verified
- **`pnpm check` exit 0** after the rebase: prettier, eslint, tsc, vitest (185 files: 183 passed, 2 skipped; 973 tests: 969 passed, 4 skipped), the drift check ("Everything's fine") and i18n (17 languages up to date).
- **Tests added after the rebase**:
  - `desk-activity-feed.test.ts` (+1): the four feed lines in order. The save that came with an "edited" outcome is not a second line. Portuguese wording checked.
  - `notice-draft.test.ts` (+1): a fitted fresh translation keeps its source and English's basis, and Translate on that tab still refills it from English; Fit on hand-written English has no source.
  - `notices/reviews/route.test.ts`: the Home tab number is 2 for Rook, 1 for Wren, 0 for Ana.
- **Local e2e**:
  - Setup: a production build (`next build`, `next start` on :3991). Local Postgres 18 on 55991 with all 37 migrations, the bridge on 55992. Three invented officers (Ana, Rook, Wren) with session cookies. A Groq stub on 55993 behind a fetch preload; it answers by the system prompt and logs each prompt's first line and budget.
  - Rerun after the rebase on a fresh database (39 migrations, 0038 last) and a new build: `e2e.mjs` **93 of 93**. Then `e2e-feed.mjs` **9 of 9**:
    - the tab number on the Notices page: "1 to review" for Rook, nothing for Ana and Wren;
    - Wren's Home feed has "Ana asked Rook to review the notice “Saturday duel plan” · PT", "Ana asked the team … · All languages", "Rook approved … · PT" and "Rook edited … after a review", and no separate "Rook saved" line;
    - the Portuguese feed has "Ana pediu a Rook que revise o aviso …".
    Shots: `f-feed-360-light-{en,pt-BR}.png`.
  - Harness: `scratchpad/11ad/e2e.mjs`, **93 of 93 passed**:
    - Fit: hidden on an empty tab. Shown at 1,555 / 1000. The first request asked for 950. The draft came back at 102 characters, and Fit is hidden once the text is within the limit.
    - Translate: one request per language, PT and FR, each with the localizer and budget 1000. PT came back at 761; FR at 1,210, with Fit offered there. FR Fit was asked in French and came back within the limit. Accept, then Save.
    - Reviews: Ana asks Rook for PT. The notice shows "Review asked by Ana · PT / For Rook ·", and Ana gets no Approve. Rook's Home lists "Review “Saturday duel plan” · PT, asked by Ana"; Ana's and Wren's Homes do not. Rook approves: "PT · Approved by Rook ·" appears, and his Home clears.
    - Ana then asks the team for the whole notice, and Wren sees it on Home. Rook taps "Edit and save", sees the Reviewing line, edits and saves: "All languages · Edited by Rook ·". The outcomes table holds `approved,edited`. `notice_edits` holds both EN texts.
    - 360 and 1280, light and dark, EN and PT, on the read page with an open request, Home, the editor with Fit and the ask sheet: no sideways scroll and no target under 44 px.
  - Screenshots (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ad-shots/`: `a*` Fit and translate, `b*` the ask sheet, `c*` Rook's Home and approve, `d*` edit and save, and `e-{read,home,fit,ask}-{360,1280}-{light,dark}-{en,pt-BR}`.
  - WebKit was not run this time.
- **Design look** (360 shots): the PT labels fit in the buttons ("Ajustar a 1.000 / Mantém o essencial"). The request card sits under Edit, where the reviewer sees it first. The Home link wraps to two lines in PT at 360 and stays readable.
- **No real Groq, Discord or upstream call.** All processes I started were stopped by PID; the local cluster was stopped.
- **Privacy**: only invented names and texts (Ana, Rook, Wren, "Saturday duel plan", "Garden rota"). The diff was grepped against the OGs fixture roster.

## Open issues
1. **The officer list depends on session rows.** /admin "Sign out users" deletes sessions, so an officer signed out that way is missing from the "Who reviews it" list until they sign in again.
2. **A deleted reviewer.** `reviewer_id` is `on delete set null`, which turns an open request for that person into a team request. Users are not deleted today.
3. **The stub's answers are not real model output.** Fit's real length behaviour (how often the 800 retry is needed) is unmeasured until a session with the Groq key tries a few real notices.

## Next
Session: the next workspace issue the orchestrator picks; the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The three items fit one pass. Most of the time went to keeping functions under the 80-line lint rule and to the e2e harness.
Owner must do first: nothing to configure. Optionally, try Fit and Translate on one real long notice with the production key and say whether the PT and FR read like an officer wrote them.
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Review requests live in `notice_reviews` (asked_by, asked_at, language, reviewer_id) and `notice_review_outcomes` (by, at, outcome). Both feed Home's recent activity through `lib/repo/desk-activity-reviews.ts`.
- `translateText(model, from, to, text, limit?)`: passing a limit switches to the localizer. Any new caller that wants the old literal-style prompt omits it.
- Groq stub without code changes: `NODE_OPTIONS="--import ./scripts/db-local-preload.mjs --import <groq-preload.mjs>" next start`, with any `gsk_…` key in `.env.local`. Copies are in `scratchpad/11ad/` (`groq-preload.mjs`, `groq-stub.mjs`, `make-env.mjs`, `seed.sql`).
- Home's `ToReview` now takes a `reviews` prop. The tab number (`toReviewCount`) includes open review requests for the viewer.
</adjustments>

PR: (added by the orchestrator)
