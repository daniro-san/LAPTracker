# 08g — Upstream status bar

## Built
- `lib/queries/upstream-status.ts`: `getUpstreamStatus(db, now)` returns `{ down: false }` or `{ down: true, lastFreshAt }`. Exported from `lib/queries/index.ts`.
- `app/_ui/UpstreamBanner.tsx`: a slim `role="status"` notice (seal tint, `DroppedStitch` icon, title, one sentence, "Last fresh data at … server"). Rendered in `app/layout.tsx` above every page. No controls, so nothing to dismiss. It renders nothing when the rule is false or the DB read throws.
- `lib/copy.ts`: `copy.upstream`.
- `lib/queries/upstream-status.test.ts`: six tests, one per behaviour (healthy, deadline plus last-fresh time, 5xx/timeout rows, non-upstream failures and a minority of 5xx, stuck `running`, recovery / rehearsal / 24 h age-out).
- `docs/DECISIONS.md` D27 holds the rule.

## Decisions
- Rule: newest public snapshot, started under 24 h ago, and either still `running` after 10 min, closed with `error = "deadline"`, or `partial`/`failed` with at least half its rows at `http 5xx` / `TimeoutError` / `AbortError`. Full text in D27.
- Only upstream-looking row errors count. A 404, a 429 or stale rows alone do not raise the banner; the existing stale marks cover them.
- "Last fresh" is `MAX(source_updated_at)` over fresh, error-free rows of public events, shown in server time like the rest of the site.
- The banner sits in the root layout, not in `SiteHeader`, because `SiteHeader` is also used on error pages that have no DB and the layout covers every public page once.
- `lib/queries` keeps its own copy of the 10-minute figure (`RUN_STALE_AFTER_MS`): ARCHITECTURE's dependency rule gives queries no import from `lib/collector`.

## Deviations
- None from the task. The banner is not sticky; it scrolls away with the page, so the sticky header keeps its offset (`--lace`, table heads).

## Verified
- `pnpm check`: passes (prettier, eslint, tsc, 110 tests).
- The rule runs against PGlite with the real migrations (the six tests).
- Not verified: how the banner looks in a browser at 360 px, and the layout rendering against a live DB. No local DB with a failing snapshot was set up; the component is a plain block of text with no fixed widths.
- Upstream API calls: 0. Production not touched.

## Open issues
- The banner reflects the last attempt only. A recovery shows only after the next run; an outage between runs is invisible. A tick log or a lightweight attempt record would close that.
- Ideas not built: a status page, an outage history, a per-event banner variant.
- Every page request now makes two small queries for the banner (one on a healthy site). Not measured.
- `pnpm check` can fail on a PGlite `beforeAll` timeout under load (see 08f).

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev`; after the next release, open the site while the upstream is down, or after a deadline run, to see the banner once.
Plan changes needed: none.

<adjustments>
- After each rehearsal or real run in Session 9, check that the banner is absent on `/` when the run completed. Rehearsal snapshots are ignored by the banner on purpose, so a failing rehearsal will not show it.
</adjustments>
https://github.com/daniro-san/LAPTracker/pull/75
