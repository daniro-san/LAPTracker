Closes #

<!-- "Closes #N" in plain prose closes the issue when this merges into dev. Use "Part of #N" for one batch of a larger issue. -->

## What and why

<!-- One short paragraph or a few bullets: what changed for users, and why. Numbers beat adjectives (before/after). -->

## Acceptance criteria

<!-- Copy the issue's criteria. Tick each one and say where it was verified: a test name, a QA flow, a screenshot width. -->

- [ ] … — verified in …

## Data and privacy

<!-- Fields touched. Any private roster field (x, y, online, last_online_at, joined_at, daily_*, active, avatar_url)? Does anything reach logs, caches, analytics or Discord? "None" is a fine answer. -->

## Analytics plan

<!-- docs/analytics/tracking-plan.md, per CONTRIBUTING.md § Working rules. Name each event, and any PostHog insight, dashboard or Endpoint checked. Or "No change", and why. -->

- Added: <!-- event, and the product question it answers -->
- Changed: <!-- property, when it fires, or a funnel step's meaning; dated line in the plan's "Changed" -->
- Removed: <!-- out of both the code and the plan -->

## Verification

<!-- Paste real output, not "works". -->

- [ ] `pnpm check`
- [ ] QA: <!-- flows run, on a production build -->
- [ ] Widths 360 / 768 / 1024 / 1280 / 1440 (DESIGN.md § Layout system), light and dark
- [ ] DB cost <!-- only when reads or writes changed: queries per view, rows read -->

## Design validation

<!-- Only for changes in how something is presented or used (DESIGN.md § Validation): persona panel verdict, PostHog usage read, product persona. Delete otherwise. -->

## Gates

- [ ] Size: <!-- S / M / L per CONTRIBUTING.md § Working rules; M and L: the spec-lean plan, and the product-strategy persona's and adversarial reviewer's verdicts -->
- [ ] Review: <!-- full panel + adversarial for lib/private, privacy or quota; one reviewer otherwise -->
- [ ] `/pr-review`
- [ ] Decision: <!-- Dnn added or amended, or "none" -->
- [ ] Handoff: <!-- docs/handoff/<name>.md -->

## Follow-ups

<!-- Issues opened for findings not fixed here, or "none". -->
