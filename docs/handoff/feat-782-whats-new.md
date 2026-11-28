# feat/782-whats-new — What's new for officers

Issue #782. Officers get a What's new page on the desk, made from officer notes in `lib/patch-notes.ts`. Home shows one line until the officer opens the page.

## Built

- `lib/patch-notes.ts`: `PatchNote.officer?: OfficerNote[]`. An `OfficerNote` is `{ title, text, needs? }`: `title` and `text` are `DeskWords` (`en`, `pt-BR`, `fr`), and `needs` lists the features (`Feature` from `lib/workspace-features.ts`) the workspace must have on. An entry without `officer` stays on /admin/changes only. The header comment says this.
- Officer notes for v5.66.0 to v5.71.0 in EN, PT-BR and FR (18 notes). Gates used: `notices` (KvK plan, withdraw a review request), `insights` (the officers' KvK map), `post_welcome`, `post_summary`, `post_kvk`, `post_shield_up`, `post_week`, `follow_up`, `insights`. Left admin-only: v5.71.0's event windows, daily read targets, the desktop feedback badge and the error/funnel tracking; v5.69.1's test read; v5.67.0's feedback sheet fix; v5.66.0's chart fixes.
- `workspace_users.whats_new_seen` (text, nullable): the newest release whose notes this officer opened. Migration `drizzle/0085_damp_prima.sql`, made by `pnpm db:generate` after rebasing onto dev's 0084.
- `lib/repo/workspaces.ts`: `whatsNewSeen`, `setWhatsNewSeen`. Both are scoped to the workspace id and the user id.
- `lib/private/whats-new.ts`: `whatsNew(ws, language)` returns the allowed notes, newest release first. `whatsNewLine(db, access)` returns the newest note's title (all three languages) while the officer's seen version is null or older, else null. `openWhatsNew(db, access, language)` returns the notes and stores the newest version as seen.
- Home: `cards()` in `app/(private)/_ui/home-cards.ts` reads `whatsNewLine` in its `Promise.all`. `WhatsNewLine` in `app/(private)/w/[slug]/page.tsx` renders "New: <title>" as one 44 px link above the spread. There is no modal and no nav badge.
- Page `/w/[slug]/whats-new`: back link to Home, heading, lead, one card per note (title, release date, text), or "Nothing new yet." Officers only (`requireWorkspace`). A member goes to the board, and a session from another workspace goes to the sign-in (`refuse`). `current={null}`, so no tab is marked.
- Dictionary keys `home.whatsNew`, `whatsnew.title`, `whatsnew.lead`, `whatsnew.none`, `whatsnew.back` in `dictionary.ts`, `dictionary.pt-BR.ts` and `dictionary.fr.ts`.
- Tests: `lib/private/whats-new.test.ts` has 4 tests: admin-only entries are hidden, the feature filter works, the Home line shows until seen and then hides, and seen is per officer. `app/(private)/w/[slug]/whats-new/page.test.ts` has 3 tests: the own officer gets the page, a member is refused, and another workspace's officer is refused. Neither refused visit writes a seen value.

## Decisions

- Each entry holds a list of notes, and each note has its own feature gate. One line per entry could not be filtered by feature: v5.71.0 mixes posts, KvK plans and thanks.
- "Seen" is a version, not a timestamp. The Home line shows when the newest note the workspace's features allow comes from a release newer than the stored version, compared by number (v5.10 after v5.9). A new officer (null) sees the line once.
- Opening the page stores the newest allowed version, even when it is older than the stored one (after a feature was turned off). The line then comes back once the feature is on again. This is intended.
- The feature filter uses the served features (`access.features.on`, the owner and alliance layers resolved, D126/D134). A catalog post counts as "had" when its `post_*` feature is allowed, even before officers turn the post on in Settings → Posts. Those notes say "Off until you turn it on".
- The language of the Home line is picked at render time, because Home resolves the language after the DB read.
- No new decision record. The new column holds only the officer's own seen version. It is left out of the data download's `people.csv` (`omit` in `lib/repo/workspace-data.ts`): it is per-officer screen state, not alliance data. The export route test checks the header.

## Deviations

- The issue says "an optional officer-facing line" per entry. I built a list of notes per entry so the feature filter works (see Decisions).

## Verified

- `pnpm vitest related --run <changed files>`: 389 files passed, 2 skipped; 2115 tests passed. The 7 new tests also ran alone and passed (verbose run).
- `pnpm check`: exit 0, after one fix round. Prettier needed fixes, then `WorkspacePage` went over max-lines-per-function and complexity, so the read moved into `cards()` and the render into `WhatsNewLine`.
- Not run: e2e and a browser check at 360/640/1280. Seeing the page in a browser needs a signed-in local desk. The page uses the same classes as its neighbours (`drawn-card`, `min-h-11` links, `max-w-2xl`). No e2e selector matches the new link: they are scoped to their regions.

## Open issues

- Analytics: no change. The page view is already a desk page view; no new event.
- A designer-persona review at 360/640/1280 and dark mode is still owed before merge (owner's rule for desk UI).

## Next

- Before each release: add `officer` notes to the new entry in `lib/patch-notes.ts` when the release has something officers see. CONTRIBUTING.md § release steps could name this. That needs an owner-approved doc change, so it is not done here.

What was missing from the task prompt? Whether "the workspace's switched-on features" means the owner layer only, or the alliance's own post switches as well. I used the served features (`access.features`).

PR: (added by the orchestrator)
