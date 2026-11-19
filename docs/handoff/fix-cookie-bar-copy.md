# fix-cookie-bar-copy — a short, direct cookie bar on the public pages

## Built
- `copy.consent` in `lib/copy.ts`, EN:
  - body: "We use cookies to see how the site is used. You can say no; we'll still count visits without them."
  - accept "Accept", decline "Decline", label "Cookies", footer link `choices` "Cookie settings".
- PT-BR and FR as the owner wrote them (FR keeps a no-break space before ":", as `lib/i18n/fr.ts` does).
- The other 14 public languages (`lib/i18n/<tag>.ts`) say the same thing, and all 17 are stamped (`tsx scripts/i18n-check.ts --stamp`, run after the plain check listed only these 5 keys as stale).
- Comments that quoted the old labels: `app/_ui/AnalyticsConsent.tsx`, `app/_ui/AnalyticsChoices.tsx`, `app/_ui/SiteFooter.tsx`.
- D115: a dated amendment quoting the new EN copy.

## Decisions
- No layout change. The bar already puts the text above the two buttons on phones (one row, each half the width), and the text and buttons on one row from 640 px. Both buttons already use `buttonClass("secondary")`, which is `min-h-11` (44 px). The shorter text is what makes the bar smaller.
- Translations written by hand, not with the translate-copy skill's 14 translator agents: 5 short keys per language. I followed each file's existing word for cookie (sv "kakor", tr "çerez", pl "pliki cookie") and its form of address (du/tu forms where the file uses them). The glossaries have no cookie or consent terms, so no glossary row was added.

## Deviations
- None.

## Verified
- `pnpm check`: exit 0, 216 test files passed, 2 skipped; 1,174 tests passed, 4 skipped.
- `tsx scripts/i18n-check.ts` before stamping: only `consent.label/body/accept/decline/choices` stale in all 17 languages; after: "17 languages up to date with English".
- Local production build (`next build`, then `next start` on :3461) with `VERCEL_ENV=production` and a fake PostHog key, so the bar renders. Own local Postgres on :55461 (49 migrations, no roster), the DB bridge, random fake secrets, upstream pointed at an unused localhost port. The browser aborted every request that was not to localhost and every `/ingest` request (12 aborted), so nothing reached PostHog or upstream.
- Measured in Chrome on `/` (EN, PT-BR, FR; light and dark):
  - 360 px: bar 118 px in EN and PT (158 px with the old text), 138 px in FR (178 px with the old text). Text above, both buttons on one row, 160 × 44 px each.
  - 1280 px: bar 69 px in every language (unchanged: the 44 px buttons set the height). Text and buttons on one row. EN and PT text on one line, FR on two.
  - Both buttons have the same classes in every case. No sideways scroll.
- Screenshots `cookie-bar-{360,1280}-{light,dark}-{en,pt-BR}.png` in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/cookie-shots/final/`, checked by eye. The first run's 360 light EN shot had no button frames because it was taken before the page finished loading. The final run waits for the network to go idle, and every frame shows.

## Open issues
- Comments in `lib/analytics/posthog.ts`, `lib/analytics/events.ts` and the test names in `lib/analytics/posthog.test.ts` still say "Allow" and "No thanks" for the two answers. They describe what each answer does, not UI copy, so I left them.
- At 1280 px the two buttons differ in width by a few pixels (for example Accept 77 px, Decline 82 px), because each fits its label. They have the same style. Giving them a shared minimum width would make them identical.

## Next
- Model/effort: keep. No session is queued by this fix.
- Owner first: nothing.
- Plan change: none.

PR: (added by the orchestrator)
