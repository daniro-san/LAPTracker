# 08zp — Docs and brand hygiene (#127, session 1 of 2)

Spec: the owner's decision comment on #127 (2026-11-05), "Session 1: hygiene". Branch `session/08zp-docs-brand-hygiene`, cut from `origin/dev` at 505979a.

## Built
- `lib/brand/tokens.css` — the three tokens declared twice in the `@media (prefers-color-scheme: dark)` block (`--frame-field`, `--check-mark`, `--select-arrow`, all `#b48ba6`) moved into `:root[data-theme="dark"]`. No value changed.
- `docs/DESIGN.md` — Typography table: display-xl/lg weight 400 (Young Serif), display-md/sm 700 (Alegreya Sans); label stays 600. The first of the two `member-filter` bullets deleted (the second holds all of its text). "Mark": the wax exception stated with real sizes, and the clear-space rule from `/brand` added.
- `lib/copy-brand.ts` — "Line mark: 24 px and up." → "Line mark: 96 px and up. The one exception is the mark pressed into wax: the header seal and the seal button."; the don't "Line mark below 24 px" → "below 96 px".
- `app/(pages)/brand/LogoSection.tsx` — "Minimum sizes" draws the line mark at 96 and 128 px (was 24, 32, 48). The "Correct and incorrect use" tiles draw it at 96 px (was 56) in 128 px tiles (was 96); the waxed tile and the "below 96 px" tile (14 px) are unchanged.
- `docs/brand/DRAWING.md` — a short paragraph on `GAIN` (`lib.py`, 1.4 for the 40 px Discord avatars) and `head(skip=…)` (`brim`, `beak`, `brow`, `pupil`).
- `docs/DECISIONS.md` — the second `## D30` (08k, /admin "Run something now") is now `## D40 … (numbered D30 by mistake until 2026-11-05)`. The cron-job.org D30 is unchanged.

## Decisions
- "by the owner's choice" stays in DESIGN.md only. On the public `/brand` page it read as an internal note, so the copy says "The one exception is …".
- The "Do" tiles also drew the line mark below 96 px (56 px), so they were changed with the "Minimum sizes" demo. The "Don't" tiles for stretched, rotated and colour moved to 96 px too, so the only sub-96 tile is the one that says so.

## Deviations
- **Header size.** The comment says "the header (32 px)". The header renders `WaxedMark size={40}` (`app/_ui/SiteHeader.tsx:134`, unchanged since #28), which draws `MarkLine` at 20 px inside the seal; `SealButton` draws it at 24 px. DESIGN.md already named "the wax seal" next to the header as an exception. So the exception is written as "the mark pressed into wax: the header's 40 px seal (mark at 20 px) and the seal button (24 px)", not as "32 px".
- **PR keyword.** The session brief said `Closes #127`; the owner's comment says this PR is `Part of #127` and the split session closes it. The PR follows the comment.
- **No D41.** The brief expected a D41 "one file stays". The owner's comment decides the opposite (split into `docs/decisions/`, D41 records the split, in session 2), so this PR adds no D41 and leaves the header's "split at ~25 entries" sentence alone.

## Verified
- Bug reproduced, then fixed, on local `next dev` (port 3127, `.env.local` → Neon preview branch, reads only; no upstream calls), Playwright + Chrome at 360 px, `/brand` "Components" select:
  - before, `theme=dark` cookie on a light-mode OS: paper `#1a1418`, and none of `--frame-field`, `--check-mark`, `--select-arrow` contained `b48ba6` (they were the light `#3b2436`).
  - after, same setup: all three contain `b48ba6`. System dark without a cookie: all three `b48ba6`. `theme=light` cookie on a dark-mode OS: paper `#efe6d3`, none `b48ba6` (light tokens, as before).
  - Before/after crops of the select were sent to the owner, not committed.
- `/brand` Logo section at 360 px, light: page `scrollWidth` 360 (no horizontal scroll); 96 and 128 px marks and the 128 px tiles fit.
- `grep -c '^## D30 ' docs/DECISIONS.md` → 1; `grep -o '^## D[0-9]*' docs/DECISIONS.md | sort | uniq -d` → empty.
- `pnpm -s i18n:todo` → `{}` (`/brand` copy is English only, D48).
- `pnpm check` → Prettier, ESLint, tsc clean; Vitest 39 files passed / 1 skipped, 184 tests passed / 1 skipped; drift "No schema changes"; "i18n: 17 languages up to date with English".

## Open issues
- `docs/IMPLEMENTATION_PLAN.md:56, :60, :440` cite "D30 (cron-job.org)". Now that D30 is unique the "(cron-job.org)" qualifier is redundant but correct; owner-only file, not edited.
- `docs/handoff/08k-*.md` still cites the /admin entry as D30. Handoffs are historical, not edited (owner's rule).
- Reserved letter clash: the owner's #127 comment reserves `08zy` for the DECISIONS split; the #130 session brief also reserves `08zy` (event terminology). The file names differ (`08zy-decisions-split` vs `08zy-event-terminology`), but the letter repeats. The split session can take another letter.
- Release: per the comment, this can reach `main` before Saturday if merged into `dev` by Friday ~21:00 server time and *Rehearse now* passes. The tokens fix is the reason to try.

## Next
Session: 10 — README and runbook polish
Model / effort: keep (haiku, medium) — no signal; this PR changed no README content.
Owner must do first: merge this PR into `dev`. No migration, no environment variable.
Plan changes needed: none required. Optional: `docs/IMPLEMENTATION_PLAN.md` §3.1 lines 56/60/440 can drop "(cron-job.org)" after "D30", since D30 is unique now.

<adjustments>
- D30 is only the cron-job.org scheduler entry. The 08k /admin "Run something now" entry is D40. Cite "D30" plainly in the README.
</adjustments>

<adjustments for="#127 session 2 (DECISIONS split)">
- D40 already exists in `docs/DECISIONS.md` (the 08k entry, with its "(numbered D30 by mistake until 2026-11-05)" note); carry the heading over as-is.
- `08zy` is also used by the #130 event-terminology session; pick another handoff letter.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/146
