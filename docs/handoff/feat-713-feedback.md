# feat-713-feedback — "Send feedback" from the desk and the board, read by the owner on /admin/feedback

Part of #713 (part H, the feedback form). Size M. Plan: `.specs/features/713-feedback/plan.md` (approved by the owner on 2026-11-22 in the chat, relayed on #713). Decision: D157. Migration: `0071_feedback`. The orchestrator gives it its final number: 0073, after `feat/713-callouts` (0072) is on origin.

## Built

- **The form** (`app/(private)/_ui/FeedbackButton.tsx`, wrapped by `Feedback.tsx`): a "Send feedback" button at the end of every desk page in the signed-in frame (`Frame.tsx`), the members' board and Me. It opens a bottom sheet with:
  - who reads it ("the people who make this site, not your officers"; no name, no reply);
  - the kind (Idea, Problem, Something good);
  - the message (up to 1,000 characters, with a count and a hint to leave out members' map positions and online times);
  - a hidden honeypot field (`website`);
  - Send. After a send the sheet shows "Received, thank you." and Close only.
  - Copy is in EN, PT-BR and FR (`lib/private/dictionary.feedback.ts`). Labels are visible, targets are 44 px, and nothing works on hover only.
- **Route** `POST /api/w/[slug]/feedback`. The checks, in order:
  1. same-origin JSON;
  2. a strict zod body;
  3. the area's door: `desk` uses `requireWorkspace` (officers only); `board` uses `requireBoard` while the board is on (officers and members);
  4. the honeypot: when filled, the answer is `{ok: true}` and nothing is stored or counted;
  5. 5 a day per IP hash, then 20 a day per workspace (`auth_attempts` day keys; the IP only as an HMAC labelled `feedback-ip:`);
  6. `redactPrivate` on the text, then one insert. The work runs through `privately`.
- **Storage**: migration `0071_feedback`, `lib/schema-feedback.ts`, `lib/repo/feedback.ts`. Who sent it is never stored.
- **Retention**: `purgeOldFeedback` runs in the tick's daily cleanup, beside `purgeOldAppErrors`. A failed run shows in /admin's "Needs you" ("The 180-day feedback clean-up failed on …").
- **D125**: `feedback` is in `WORKSPACE_TABLES` with `file: null` (deleted with the workspace, never downloaded). The `day:feedback:ws:<id>` counter is deleted with the other counters.
- **/admin/feedback** (`app/(pages)/admin/feedback/page.tsx`, `lib/queries/admin-feedback.ts`, `app/_ui/admin/FeedbackStatus.tsx`):
  - newest first, up to 200;
  - kind and status filters as links;
  - four status buttons (New, Read, Became an issue, Dropped) through `POST /api/admin/feedback` (PIN);
  - a nav entry "Feedback"; English only (D48).
- **Analytics**: browser `feedback_sent {feedback_area, kind}` after a 200. It is in the tracking plan, with insights, a go/no-go and a dated "Added" line.
- **Docs**:
  - D157;
  - dated amendments to D77, D115 and D125;
  - a glossary entry "feedback";
  - ARCHITECTURE: the `lib/private → lib/redact` edge and a Features row.
- **Tests**:
  - `api/w/[slug]/feedback/route.test.ts` (7): the door and same-origin checks first; stored redacted with no sender column; the honeypot; bad bodies; the IP and workspace limits at their edges; no IP in `auth_attempts`;
  - `lib/repo/feedback.test.ts`: the 180-day edge;
  - `app/api/admin/feedback/route.test.ts`: an officer's workspace session and a wrong PIN change nothing; the PIN sets the status; 404 and 400;
  - `admin/gate.test.ts`: /admin/feedback shows the PIN card with no database read, and lists and filters when unlocked;
  - the D125 purge test now covers `feedback` (seeded in `workspace-seed-parts.test-helpers.ts`; `schema-feedback` added to its module list);
  - `member-session.test.ts` excludes the route, with the reason (members send from the board);
  - `quota-gate.test.ts` lists the admin route as not using quota;
  - `e2e/feedback.spec.ts`: the e2e flow described in Verified.

## Decisions

- One route for both areas, with the door chosen by `area`: a member's session with `area: desk` gets 401.
- IP key: HMAC-SHA-256 under `CRON_SECRET` of `feedback-ip:<ip>`, cut to 32 hex characters. A plain hash of an IPv4 address can be reversed by trying all of them.
- The IP is counted before the workspace, so one address over its limit never uses up the workspace's 20 (the same order as D130's requests).
- Not in the workspace download: a member's feedback is addressed to the owner, not to the officers who download.
- The button sits at the end of each page. The desk has no menu, and the account row is full at 360 px.
- The admin list stops at 200 rows (D149). At most 20 a day per workspace for 180 days can exist.
- Statuses follow the task (new, read, issue, dropped), not the spike's (New, Planned, Done, Declined).

## Deviations

- The PostHog property is `feedback_area`, not `area`. `before_send` (`lib/analytics/sanitise.ts`) overwrites `area` on every browser event with public, workspace or admin, as `board_section` avoids `section`.
- Numbers: the branch carries `0071_feedback`. The decision was first numbered as D155 (the next free on dev), then renamed to D157 on the coordinator's message. `feat/713-callouts` (0072) was not on origin when this was finished, so the migration is not regenerated as 0073 yet.
- The tlc-spec-lean `checks.md` and Verifier phases were not run. The task named the plan, the persona check and the tests, which were done.

## Verified

- `pnpm vitest related --run` on the changed files: 217 files, 1190 passed.
- `pnpm check`: exit 0. Vitest: 356 files passed and 2 skipped; 1891 tests passed and 4 skipped. Drift check clean; i18n check clean.
- Deliberate breaks, each failing its test, then reverted:
  - the text stored without `redactPrivate`;
  - the honeypot ignored;
  - the IP limit one higher;
  - the workspace limit one lower;
  - the purge using `<=` plus 1 ms.
- E2E (local production build, worktree Postgres on 54391, app on 3491):
  - The new flow: an officer sends a problem from Home and sees "Received, thank you."; the owner unlocks /admin/feedback with the PIN, finds the item with `/w/lnk · desk · officer · en`, marks it Read, and the status holds after a reload.
  - The flow passed with `--repeat-each=3`.
  - The first full run: the 74 other tests passed. My spec failed because the guard could not read an answer that the client never read. Both clients now read their answer.
  - Final full run, after both clients read their answer: 75 passed, 7 skipped, 0 failed.
- Persona check at 360 px (screenshots of the local build, invented data). The panel: three officers (UK 50s, PH 30s, FR 40s), a member (UA 20s), an adversarial reviewer and a product strategist.
  - Every persona answered every first-glance question correctly: "How do I report a bug?", "Will anyone see my name or answer?", "Did it go through?".
  - Every persona approved with changes. No MUST.
  - Adopted:
    - only Close after a send ("Cancel" under "Received" read as undo);
    - the count on its own line;
    - a hint when text is written without a kind;
    - French "Envoyer un retour" (was "Donner votre avis", read as rating);
    - the lead says "the people who make this site, not your officers" (on the board, "the site owner" read as the R5);
    - the HMAC input labelled for this use;
    - D157 says what the redactor misses and that the remaining columns can narrow a sender down in a small alliance.

## Open issues

- `redactPrivate` catches only key-value shapes (`x: 512`). A position or online time written as prose is stored as typed. The sheet asks to leave them out. A narrow coordinate pattern for feedback text would be a follow-up.
- One member switching IPs (mobile data, VPN) can use up the workspace's 20 a day for everyone (adversarial reviewer). A follow-up could count per session or keep part of the 20 for officers.
- In a small alliance, the workspace, tier and language shown to the owner can point to one person. Only the owner reads them.

## Next

- Follow-ups for #713 H:
  - `feedback_opened` (the same two properties), to measure opened versus sent (product strategist);
  - a count of new items in the admin nav;
  - public visitors (17 languages);
  - the two open issues above.
- Go/no-go eight weeks after release: at least one send a week across alliances, and at least one "Became an issue" a month. Otherwise move the button to where it is seen.
- Before release: a patch-notes entry (`lib/patch-notes.ts`). The new-alliance guide needs no new screenshots: this is not an onboarding or settings flow.

What was missing from the task prompt? That `area` is a reserved PostHog property in this app (`before_send` overwrites it), and the final migration and D-numbers (given during the work: 0073 and D157).

PR: (added by the orchestrator)
