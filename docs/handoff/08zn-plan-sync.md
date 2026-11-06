# 08zn — Plan and playbook synced with what shipped (issue #118)

Branch `session/08zn-plan-sync`, cut from `origin/dev` at `0678e78`. Docs only.

Authority: the owner's decision comment on #118 (2026-11-05) allows this session, and only this session, to edit `docs/IMPLEMENTATION_PLAN.md` and `docs/SESSION_PLAYBOOK.md` for the items listed in #118. That overrides the CLAUDE.md rule for this session.

## Built

Rewritten in place, operator-facing text first:

- **Rehearsal verdict and test-event wording** → `[rehearsal]` prefix, `✓ Pass` / `✗ Fail`, one admin message per event edited in place (D31). Source: `lib/copy-admin.ts:182-185`, `lib/copy-discord.ts:18`, `lib/notify.ts:28`, `rehearsalVerdictMessage` in `lib/notify.ts`. Plan §3.1 (verdict bullet, scheduled-rehearsal bullet), Phase 6 "Test events", Phase 7 items 1–2, Phase 8 item 1. Playbook Session 4 task 3c and its `/admin` line (`✅/❌` → `✓/✗`), Session 8 task 4, Session 9 task 1. The text now says that an edit does not notify, so the operator opens the `[rehearsal]` message or *Last rehearsal* on `/admin` ~50 min after the start.
- **Discord payload** (Phase 6) → no `username` / `avatar_url` override (`lib/notify.ts:42`); a new bullet states the one-message-per-channel rule (D31) and the extra admin message on a `partial` / `failed` run.
- **Scheduler** → cron-job.org "Vercel Ticker", cited as "D30 (cron-job.org)"; `tick.yml` is the manual path and a second scheduled path at minutes 7/22/37/52 that fails on any non-2xx (D26). Plan §3.1 (heading, intro, tick bullet, precision, keepalive, manual fallback), Phase 6 (new scheduler bullet, `tick.yml` bullet, "No scheduler retries"), Phase 8 items 2–3.
- **Releases** → D29 and README "Deploy and operate". Plan §11.6 release bullet; playbook item 8, Session 8 task 3, Session 9 `<done_when>`.
- **Observability** → D36. Plan §5 Observability line, Phase 6 Observability intro, Phase 6 "Frontend tracking" (was "No frontend tracking").
- **Phase 5** card bullet (`*` mark, D33; member-loss note in Details; freshness marks), Routes header (status chips `Last updated` / `Next update` in server time, quota only on `/admin`), table bullet (ledger-rank order, Details panel, no "Game board" section). **Phase 5c** member filters (sort chips, two-thumb might range, "Show all (n)") and a summary-band bullet. **Phase 5e** `B` mark → the row's server time. **Phase 5f** blank dictionary keeps the four game terms (D23).
- **§10b**: a new sub-entry "Sessions 6–8 (2026-11-05): sections rewritten in place under #118" that lists each rewritten section with the handoff that found it and names #118 as the one exception. The sentence "Sections are not rewritten retroactively" is unchanged.

## Decisions

- Cited plain "D30 (cron-job.org)" everywhere. #127 (rename of the duplicate 08k D30 to D40) has not landed on `dev` at `0678e78`, so there is no D40 to cite, and nothing here cites the `/admin` D30.
- Handoffs cited per item in §10b are the ones whose text records the change: 07b, 07c, 07d, 07f-alliance-page, 07f-discord-templates, 08, 08b, 08f, 08j, 08o, 08q, 08zd. The owner's list (07b, 07d, 07f-*, 08, 08j) is a subset.
- Historical session prompts (Sessions 4 and 8, already run) were rewritten only where #118 names their lines, plus the Session 4 `/admin` line (`✅/❌` → `✓/✗`), which is the same verdict wording as task 3c.

## Deviations

- Playbook Session 8 task 1 (`tick.yml` with `*/15` and `curl --fail`, line 686) is unchanged: #118's scheduler item names plan lines only, and the task is history (Session 8 ran). The plan's Phase 6 now carries the shipped `tick.yml`.
- No D-number added (docs sync only, as the decision says). #47 and #49 were not edited: the decision says the decisions session already changed them.

## Verified

- `grep -n 'Rehearsal PASS\|\[TEST\]\|username: "LAPTracker"\|min might' docs/IMPLEMENTATION_PLAN.md docs/SESSION_PLAYBOOK.md` → no output, exit 1.
- §3.1 cites D26 and D30 (cron-job.org); Phase 6 cites D26, D30 (cron-job.org), D31 and D36; §11.6 cites D29; §5 cites D36. §10b has the Sessions 6–8 sub-entry.
- Every rewritten fact was read from the code or a D-entry first: `lib/copy-admin.ts`, `lib/copy-discord.ts`, `lib/notify.ts`, `lib/rehearsal.ts:62` (`REHEARSAL <iso>`), `lib/env.ts` (`REHEARSAL_AT` default `fri 18:00`), `.github/workflows/tick.yml`, README "Deploy and operate", D23, D26, D29, D30 (cron-job.org), D31, D33, D36, and handoffs 07b, 07c, 07d, 07f-alliance-page, 07f-discord-templates, 08q, 08zd.
- `pnpm check` (prettier, eslint, tsc, vitest, drift, i18n) → exit 0; `prettier --check` on the three changed files after the handoff was written → clean.

## Open issues

- README.md line 24 still says "the scheduler is GitHub Actions"; its own "Scheduler" paragraph below says cron-job.org (D30). README was outside #118's permission; a one-line fix for a later docs PR.
- Playbook Session 8 task 1 still describes the original `*/15` `tick.yml` (see Deviations).
- `docs/DECISIONS.md` D1 ("Scheduling: a dumb tick from GitHub Actions") and D21's "`[TEST]` admin note" / "admin lines start with `[TEST]`" are superseded by D30 and the 07f/08o wording but carry no "superseded" note. DECISIONS.md was not in #118's scope.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change is text only; nothing in the cron path, collector or quota code moved.
Owner must do first: merge this PR into `dev`. No migration, no environment variable, no release needed for the docs to take effect (sessions read `dev`).
Plan changes needed: none beyond this PR. The plan and playbook now carry the shipped rehearsal wording, scheduler, releases and analytics.

<adjustments>
- The verdict is not a separate `[TEST] Rehearsal PASS/FAIL` message. It is added to the rehearsal's one `[rehearsal] **REHEARSAL <iso>**` admin message, which the After edits in place (D31). Discord does not notify on an edit: open the message, or read *Last rehearsal* on `/admin`, about 50 minutes after the tap. A run that ends `partial` or `failed` also posts a new admin message of its own.
- The tick comes from cron-job.org (D30 (cron-job.org)); `tick.yml` scheduled runs may not appear in `gh run list --event schedule`, which is expected. For the scheduler proof, read the job's History on cron-job.org.
- Releasing `v1.0.0` after this session: Actions → Prepare release with `major` (the latest tag is `v0.6.0`), merge the PR with a merge commit; `release-publish` tags it (D29). `gh release create` only if the tag does not appear.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/141
