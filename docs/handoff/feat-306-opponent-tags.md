# feat/306-opponent-tags: suggest the KvK opponent's tags from its server's ranks board (#306, D155)

## Built

- **Gate (Step 0), passed.**
  - (a) `fetchRanks(server)` (`lib/sources/internal.ts:69-70`) sends `GET /servers/catalog/${server}/ranks`. Another server's board is the same request with another number. `get` (`lib/sources/internal.ts:44-47`) sends only `User-Agent` and `Accept`: no Origin, Referer or cookie.
  - (b) It sends no `Authorization` header. The key is added only in `lib/sources/v1.ts:154`. So the read spends no `LAP_API_KEY` quota and no other counted quota, and D152's reserves are unchanged.
- **Plan**: `.specs/features/306-opponent-tags/plan.md`, with EARS criteria 1–18.
- **Decision**: `docs/decisions/D155-opponent-tags-from-its-servers-ranks-board.md` amends D133 and D152, and is in the README index. The rules files changed with it: the `.claude/rules/collector.md` internal-source line and the header comment of `lib/sources/internal.ts`.
- **Storage**: `kvk_suggestions` (migration `0071_kvk_suggestions`), unique on `(event_at, server)`. Its columns are status (`running`, `read`, `failed`), attempts (1–3), alliances (jsonb `{tag, name, power}[]`, at most 15), `pulled_at`, `claimed_at` and `read_at`.
- **Read**: `lib/opponent-suggest.ts` `suggestTags`.
  - The repo claims the row before the call (`claimSuggestion`, one statement) and writes the answer over it (`finishSuggestion`).
  - The answer's `sid` must equal the requested server. The parser now reads `sid` as optional and returns it as `RanksBoard.server`.
  - It keeps the 15 alliances with the most might (a tie goes to the lower id) whose tag passes D152's tag rule. That rule moved from the route to `lib/kvk.ts` `opponentTag` and is shared.
  - A board with nothing to suggest counts as failed.
- **Route**: `POST /api/admin/kvk-opponent`.
  - A save of server and tags reads the board when that (KvK, server) has no row yet.
  - The new body `{event_at, suggest: true}` is the "Suggest tags" press. It answers 404 `no_opponent`, 409 `war_started` or 409 `opponent_read`. Its other outcomes answer 200.
  - The read's failure never fails the save.
- **Card**: `lib/queries/admin-kvk.ts`, `app/_ui/admin/KvkCard.tsx` and `KvkForm.tsx`.
  - It shows "Suggested from server N's ranks board, read HH:MM ST. Untick what you don't want, then save." The day is added when the read was not today.
  - The 15 alliances appear as checked chips (`CheckField` chip, "TAG · 4.1B"), with "Other tags" for the rest.
  - The chips start checked when no tags are saved. Otherwise a chip is checked only when its tag is saved.
  - Saving sends the checked chips in board order, then the typed tags.
  - A failure says "Server N's ranks board couldn't be read. Type the tags as before."
  - "Suggest tags" shows while the board may be read.
- **Tests**:
  - `lib/opponent-suggest.test.ts`: 6 tests on PGlite with a stubbed internal source.
  - `app/api/admin/kvk-opponent/route.test.ts`: 1 new test.
  - `lib/sources/internal.test.ts`: 1 new assertion, `sid`.

## Decisions

- **One successful read per (KvK, server), up to 3 attempts.** A `read` row is never claimed again. A `failed` row, or a `running` claim older than 2 minutes, can be claimed again only by the press, up to 3 attempts in all. A save never retries.
- **The wrong server: the answer's `sid` must match.** The fixture shows the board answer carries `sid`. I first excluded alliances on our own newest board. I dropped that because it would also drop an alliance that has moved to the opponent's server; the `sid` check covers the same risk exactly.
- **An alliance whose board tag cannot be read by tag is skipped**: no tag, a space, `/`, more than 12 characters. The next one by might takes its place.
- **The read runs inside the save request.** It is not deferred, so the refreshed card shows the result. `fetchRanks` keeps its 30 s timeout. The route sets no `maxDuration`, on purpose: Vercel's default function timeout is 300 s, far above the read's 30 s timeout (review of PR 717).
- **The form keeps what was typed across a board read** (review of PR 717). The chips and "Other tags" are the form's state. A new suggestion moves any typed tag it contains onto its chip, ticked, and leaves the rest typed. The form resets only on another KvK or a save of its tags.
- **No PostHog flag.** The suggestion is admin-only, and D91 covers public features.
- **Persona check, run on the built code with invented data:**
  - **Owner as admin user, 360 px phone: approve.**
    - The first save stores the server and shows "Saved." while the chips appear unsaved. Adopted: the line says "Untick what you don't want, then save."
    - A mistyped server shows its own number in the line, so the owner sees the wrong server at once.
    - 15 chips of "TAG · 4.1B" wrap at 360 px, and each is 44 px tall.
    - The press shows no "Saved." notice. The card's line shows the outcome after the refresh.
  - **Adversarial (quota, unofficial-source creep, a wrong server): approve with changes.**
    - Adopted: the `sid` check; the claim before the call; the 3-attempt cap; no read once the war starts or the Start has read a tag; no read from the tick, the collector or any public page; failure logs carry only the error's class; only tag, name and might are stored, and the players' boards in the same answer are never parsed.
    - Not adopted: a cap on how many different servers one KvK may be read for. Each read is a PIN-authenticated save of a new server before the war, so the owner's own actions bound it. It is listed below as a follow-up.

## Deviations

- **No e2e flow.** No admin e2e spec exists, and `e2e/stub-server.mjs` answers only `/v1/quota`, Groq and Discord. It does not serve the ranks board.
- **No designer review or screenshots of the card.** The task asked for the owner and adversarial check only.

## Verified

- `pnpm vitest related --run` on the changed files: 354 files, 1886 tests passed, 4 skipped.
- `pnpm check`, exit 0: typecheck, lint, format, tests, drizzle check and i18n.
- Each new test was shown to fail when its rule breaks:
  - a claim that always succeeds fails the one-read test and the attempt-cap test;
  - storing the board's labels unfiltered fails the top-15 test and the stored-fields test.
- Review of PR 717 added tests: `lib/queries/admin-kvk.test.ts` (4, `canSuggest`), plus three in `lib/opponent-suggest.test.ts` (two saves at once make one call, the stale `running` reclaim, a missing `sid`). It also split the bundled route test into four. Seven mutations each failed at least one test: attempts `<=`, stale at exactly 2 minutes, no war check, no Start-read check, a claim that always succeeds, no stale reclaim, and a missing `sid` accepted.
- No network call and no upstream call were made. The stored-fields test runs the real `fetchRanks` parser over `fixtures/ranks-325-20261104T201831Z/ranks.json`, with `fetch` mocked and `sid` rewritten to 326. It then checks that no player uid, avatar, badge or URL reaches the row.

## Open issues

- Nothing in the code limits the number of servers per KvK (see Decisions).
- A save now waits for the board read, up to 30 s on a slow board.
- The card was not rendered in a browser in this session.

## Next

- Follow-ups:
  - an /admin screenshot of the card at 360 px and in dark mode, per the guide-screenshots rule;
  - a patch-notes line in `lib/patch-notes.ts` for the next release ("The KvK opponent card suggests the opponent's 15 largest alliances from its ranks board");
  - optionally, a cap on board reads per KvK across servers, if the owner wants one.
- Owner's first step: on /admin → KvK opponent, save the next opponent's server. Check that the line names that server and the chips look right, then save the tags.

What was missing from the task prompt? Whether a failed read may be retried, and how often ("one successful read" implies yes). I chose the press only, 3 attempts in all.

PR: (added by the orchestrator)
