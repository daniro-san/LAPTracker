# Decisions

One paragraph per decision, dated, **append-only**. A reversal is a new entry that names the one it supersedes; old entries are never edited.

Why one file, not an ADR folder: at ~10–15 decisions, a single file you can grep beats N files plus an index. Split into `docs/decisions/` when this file passes ~25 entries, or when people other than the owner start proposing decisions via PR.

The header text above is the old file's, kept as it was. The split it describes happened in [D41](D41-one-file-per-decision-in-docs-decisions.md), which supersedes its second paragraph.

## Adding a decision

- Create `docs/decisions/DNN-<slug>.md` with the next free number, zero-padded, and a heading `## DNN — Title (date, who, session, issue)`.
- Add one line to the index below, in numeric order.
- Never edit another session's entry. A reversal is a new entry that names the one it supersedes.

## Index

- [D1 — Scheduling: a dumb tick from GitHub Actions, times in env vars (2026-11-04, plan §3.1)](D01-scheduling-a-dumb-tick-from-github.md)
- [D2 — Persistence: Neon Postgres + Drizzle, keep everything forever (2026-11-04, plan §3.2)](D02-persistence-neon-postgres-drizzle-keep-everything.md)
- [D3 — Edit protection: one shared PIN (2026-11-04, plan §3.3, §12.2)](D03-edit-protection-one-shared-pin.md)
- [D4 — Which alliances: all 20, by union_id, fixed per event (2026-11-04, plan §3.4)](D04-which-alliances-all-20-by-union.md)
- [D5 — Data sources: /v1 is the product; the internal API is optional garnish (2026-11-04, plan §3.5)](D05-data-sources-v1-is-the-product.md)
- [D6 — Run duration: maxDuration 120 s (2026-11-04, plan §3.6)](D06-run-duration-maxduration-120-s.md)
- [D7 — Dependency policy and the initial set (2026-11-04, plan §12.4, Session 1)](D07-dependency-policy-and-the-initial-set.md)
- [D8 — TypeScript 6.0, not 7.0 (2026-11-04, Session 1)](D08-typescript-6-0-not-7-0.md)
- [D9 — eslint-plugin-import-x instead of eslint-plugin-import (2026-11-04, Session 1)](D09-eslint-plugin-import-x-instead-of.md)
- [D10 — Install scripts denied by default (2026-11-04, Session 1)](D10-install-scripts-denied-by-default.md)
- [D11 — CSP with a per-request nonce in proxy.ts (2026-11-04, Session 1, plan §12.3)](D11-csp-with-a-per-request-nonce.md)
- [D12 — gitleaks: `gitleaks git --pre-commit --staged`, plus a lap_ rule (2026-11-04, Session 1)](D12-gitleaks-gitleaks-git-pre-commit-staged.md)
- [D13 — Planning docs live in docs/ (2026-11-04, Session 1, owner request)](D13-planning-docs-live-in-docs.md)
- [D14 — Tests may exceed max-lines-per-function (2026-11-04, Session 1)](D14-tests-may-exceed-max-lines-per.md)
- [D15 — A null member `kills` or `power` stays null and sums as 0 (2026-11-04, Session 2, plan Phase 2)](D15-a-null-member-kills-or-power.md)
- [D16 — Source adapter details the plan left open (2026-11-04, Session 2)](D16-source-adapter-details-the-plan-left.md)
- [D17 — tsx runs `pnpm snapshot:dry` (2026-11-04, Session 3)](D17-tsx-runs-pnpm-snapshot-dry.md)
- [D18 — Collector details the plan left open (2026-11-04, Session 3)](D18-collector-details-the-plan-left-open.md)
- [D19 — PGlite for DB-backed tests (2026-11-04, Session 4, owner's choice)](D19-pglite-for-db-backed-tests.md)
- [D20 — Route details the plan left open (2026-11-04, Session 4)](D20-route-details-the-plan-left-open.md)
- [D21 — Event-driven tick and rehearsals (2026-11-04, Session 4 follow-up; supersedes parts of D20)](D21-event-driven-tick-and-rehearsals.md)
- [D22 — Player photos and alliance badges, served from our own origin (2026-11-05, owner)](D22-player-photos-and-alliance-badges-served.md)
- [D23 — Language-light pages: copy, locale, server time, ranks (2026-11-05, Session 7b)](D23-language-light-pages-copy-locale-server.md)
- [D24 — Two moderate Dependabot alerts accepted as dev-only, dated exception (2026-11-05, owner)](D24-two-moderate-dependabot-alerts-accepted-as.md)
- [D25 — The collector closes the snapshot as partial at a 100 s deadline (2026-11-05, 08e)](D25-the-collector-closes-the-snapshot-as.md)
- [D26 — The tick runs at minutes 7, 22, 37 and 52 and fails on any non-2xx (2026-11-05, 08f)](D26-the-tick-runs-at-minutes-7.md)
- [D27 — A banner says when the upstream is not answering (2026-11-05, 08g)](D27-a-banner-says-when-the-upstream.md)
- [D28 — Manual rounds: a public event the owner runs by hand (2026-11-05, 08h)](D28-manual-rounds-a-public-event-the.md)
- [D29 — Releases: Prepare release opens the PR, the merge stays manual, publishing is automatic (2026-11-05, 08j)](D29-releases-prepare-release-opens-the-pr.md)
- [D30 — cron-job.org is the scheduler; GitHub's schedule is not relied on (2026-11-05, 08)](D30-cron-job-org-is-the-scheduler.md)
- [D31 — Discord: one editable message per channel per event (2026-11-05)](D31-discord-one-editable-message-per-channel.md)
- [D32 — Alliance capacity is stored; a one-roster member list is not diffed (2026-11-05)](D32-alliance-capacity-is-stored-a-one.md)
- [D33 — A `*` on a falling total whose members left, with one legend item (2026-11-05)](D33-a-on-a-falling-total-whose.md)
- [D34 — The dependency rule is linted; migration drift fails `pnpm check` (2026-11-05, 08s)](D34-the-dependency-rule-is-linted-migration.md)
- [D35 — Static assets carry no CSP; the proxy matcher stays narrow (2026-11-05, 08t)](D35-static-assets-carry-no-csp-the.md)
- [D36 — Vercel Web Analytics and Speed Insights on production (2026-11-05, owner, issue #69)](D36-vercel-web-analytics-and-speed-insights.md)
- [D37 — /admin: framed sections, status at a glance, one poller in the shell (2026-11-05, 08zb, owner-approved mock, issue #91)](D37-admin-framed-sections-status-at-a.md)
- [D38 — Per-viewer time zone and date order are cookies, set from a header settings gear (2026-11-05, owner, issues #26, #27)](D38-per-viewer-time-zone-and-date.md)
- [D39 — Any public event can be renamed from /admin (2026-11-05, 08zb, issue #106)](D39-any-public-event-can-be-renamed.md)
- [D40 — /admin "Run something now": one row of seals, a manual round options form (2026-11-05, 08k) (numbered D30 by mistake until 2026-11-05)](D40-admin-run-something-now-one-row.md)
- [D41 — One file per decision in `docs/decisions/`; supersedes the header's "split at ~25 entries" sentence (2026-11-11, owner, 08zzy, issue #127)](D41-one-file-per-decision-in-docs-decisions.md)
- [D42 — Client IP: Vercel overwrites x-real-ip and x-forwarded-for; the limiter keeps them (2026-11-06, 08zo, owner, issue #119)](D42-client-ip-vercel-overwrites-x-real.md)
- [D43 — Collector and route robustness: a lost phase is not a failure, a 150 s run lock, bounded shutdown and notify (2026-11-06, 08zr, owner, issue #120)](D43-collector-and-route-robustness-a-lost.md)
- [D44 — Data correctness: retry status and quota-call retries in the trace, `active` blocked; five limits accepted (2026-11-06, 08zs, owner, issue #123)](D44-data-correctness-retry-status-and-quota.md)
- [D45 — Tick heartbeat: a tick log, a watch route and one alert per silent hour (2026-11-06, 08zt, owner, issue #121)](D45-tick-heartbeat-a-tick-log-a.md)
- [D46 — Post-deploy smoke check; release auto-merge declined; 504s count against the quota (2026-11-11, owner, 08zq, issue #128)](D46-post-deploy-smoke-check-release-auto.md)
- [D47 — Local Postgres without Docker: an initdb cluster, a ws bridge and a WebSocket preload (2026-11-11, owner, 08zv, issue #126)](D47-local-postgres-without-docker-an-initdb.md)
- [D48 — Public pages in 18 languages: native dictionaries, a staleness check and a translate-copy skill (2026-11-05, owner, issue #60)](D48-public-pages-in-18-languages-native.md)
- [D49 — Events are named by their title; the closed event selector shows the date only (2026-11-05, owner, 08zj, issues #132, #130)](D49-events-are-named-by-their-title.md)
- [D50 — An officer's mark comes from the title text, with the in-game names as aliases (2026-11-05, 08zx, owner)](D50-an-officer-s-mark-comes-from.md)
- [D51 — Event, scheduled event, manual event: the domain terms; "Saturday" names only the weekday (2026-11-06, owner, 08zy, issue #130)](D51-event-scheduled-event-manual-event-the.md)
- [D52 — Game terms: the game's own word in each language, English where it is unknown (2026-11-06, owner, 08zzb, issue #153)](D52-game-terms-the-game-s-own.md)
- [D53 — Movers: one ranking for the page and Discord, unusable sides left out, no "left" split (2026-11-06, owner, 08zze, issue #70)](D53-movers-one-ranking-for-the-page.md)
- [D54 — Movers tabs lead with drawn marks (2026-11-06, owner, 08zzf, issue #70)](D54-movers-tabs-lead-with-drawn-marks.md)
- [D55 — A complete manual round is closed (2026-11-06, owner, 08zzg)](D55-a-complete-manual-round-is-closed.md)
- [D56 — Officer titles read the game's names: God of War and Goddess (2026-11-07, owner, 08zzl, issue #179)](D56-officer-titles-read-the-game-s.md)
- [D57 — Event vs event: a compare page over each event's in-event change (2026-11-08, owner, 08zzo, issues #177, #189)](D57-event-vs-event-a-compare-page.md)
- [D58 — The Discord event report carries a picture of the event (2026-11-09, owner, 08zzj, issue #172)](D58-the-discord-event-report-carries-a.md)
- [D59 — The footer shows the live version, read at build time (2026-11-09, owner, 08zzo, issue #193)](D59-the-footer-shows-the-live-version.md)
- [D60 — Member history: a daily roster read and a page per alliance (2026-11-10, owner, 08zzt, issue #197)](D60-member-history-a-daily-roster-read.md)
