# feat: a member who joined this week is worth a hello, and an optional buddy (#828)

## Built

- `MemberRow.joinedHello` (`lib/private/members.ts`): the `joined_at` of a member who joined less than 7 days before the newest end-of-day read, null on a break or with their own away days (issue 829). It is not in `reasons`: the member stays New on the Members tab and card and adds to no check-in count.
- Follow-up (`follow-up-rules.ts`): `WorkItem.hello` puts the member under "Worth a hello" with "Worth a hello: joined on Mon, Nov 16" (`followup.reason.joined`, EN, PT-BR, FR). `helloOnly` marks an item listed for the hello alone; `followUpCounts` (Home, Members) and Follow-up's head leave those out of "to look at". A new member's facts still to ask count as before (D104).
- `lib/private/ready-message.ts`: `hello` makes the message open with the welcome and adds no line of its own.
- Buddy, stored as the member fact `buddy` (D80): value is the buddy's uid, a clear is a version with value null. It lives outside `FACT_FIELDS`, like `leftReason`, so the facts editor, history, exports and the Info tab are untouched. No migration.
  - `lib/private/buddy.ts`: `BUDDY_CHANGE`, `saveBuddy` (officer's own alliance; the buddy must be another current member; 409 on a stale version), `buddyOf` (name while still a member), `cardBuddy` (name, version, other members with R4 and R5 first).
  - `POST /api/w/[slug]/members/[uid]/buddy` (`app/(private)/api/w/[slug]/members/[uid]/buddy/route.ts`), counted as `member_facts` / `save`.
  - `app/(private)/_ui/CardBuddy.tsx`: on the card's Overview, "Buddy: Bram", a "Name a buddy" / "Change buddy" chip that opens a select (officers, members) with "Save buddy", and "Undo", which clears. Controls are 44 px (`chip`, `FIELD`).
  - `MemberRow.buddy` (optional) and `CardData.buddy`; Follow-up shows "Buddy: {name}" under the reasons of a row that is under Worth a hello.
- `docs/decisions/D140-...md`: amendment 2026-11-28.
- Tests: `lib/private/members-joined.test.ts` (hello with date within 7 days; stays New with no reason; on Follow-up's list but not counted; not after 7 days; never on a break), `app/(private)/api/w/[slug]/members/[uid]/buddy/route.test.ts` (set and clear by an officer; 409; member session 401 and other workspace 404; buddy outside the alliance 400), `lib/private/buddy.test.ts` (shown by name, card list order), one case in `follow-up-groups.test.ts` (join date and buddy line). `member-session.test.ts` has a fixture for the new route (D105).

## Decisions

- "An officer or a current member" is read as: any current member of the own alliance, with R4 and R5 listed first. The tracker has no other list of officers in the roster, and a Discord-only officer is not a game member.
- The hello shows even while a member is `settling` (first seen under 7 days ago): settling only suppresses the offline signals, and new members are the point of it.
- A new member with facts still to ask is counted in "to look at" anyway (existing D104 rule); only a hello with nothing else is left out.
- "Undo" is the clear: it shows next to the buddy once one is set and writes a null version.
- Buddy stored as a fact outside `FACT_FIELDS` (the `leftReason` pattern) instead of inside it, to keep it out of the facts editor and its `Record<FactField>` code.
- The analytics event reuses `member_facts` / `save` (closed lists in `lib/analytics/server.ts`).

## Deviations

- None from the task.

## Verified

- `pnpm vitest related --run` on the changed files: 119 files, 674 tests passed.
- `pnpm check`: prettier, eslint, tsc, vitest, drift and i18n checks passed (after fixing a lint size error and the D105 route fixture).
- Not run in a browser: the card's buddy block was not seen at 360 px.

## Open issues

- The card's buddy select lists every other member; with a large alliance a search box may be wanted.
- The ready message does not name the buddy.

## Next

- Look at the card's buddy block at 360 px and in dark mode.
- - Patch note for the next release (`lib/patch-notes.ts`).

What was missing from the task prompt? Nothing blocking; "an officer or a current member" needed the reading in Decisions.

PR: (added by the orchestrator)
