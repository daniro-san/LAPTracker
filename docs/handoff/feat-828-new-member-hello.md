# feat: a member who joined this week is worth a hello, and an optional buddy (#828)

## Built

- New reason `joined` in the shared reasons list (`lib/private/members.ts`, `joinedReason`): a member whose `joined_at` on the newest end-of-day read is less than 7 days before that read gets `{ kind: "joined", at }`. It sits inside the same `onBreak` guard as the other reasons, so a member on a break or with their own away days (issue 829) is never listed.
- The reason is worded in Members and the card (`reason.joined`: "joined on Wed, Nov 11") and in Follow-up (`followup.reason.joined`: "Worth a hello: joined on Mon, Nov 16"), EN, PT-BR, FR (`dictionary.card.ts`, `dictionary.followup.ts`). No colour and no count were added.
- `lib/private/ready-message.ts`: a `joined` reason adds no message line of its own and makes the member count as new, so the message opens with the welcome.
- Buddy, stored as the member fact `buddy` (D80): value is the buddy's uid, a clear is a version with value null. It lives outside `FACT_FIELDS`, like `leftReason`, so the facts editor, history, exports and the Info tab are untouched. No migration.
  - `lib/private/buddy.ts`: `BUDDY_CHANGE`, `saveBuddy` (officer's own alliance; the buddy must be another current member; 409 on a stale version), `buddyOf` (name while still a member), `cardBuddy` (name, version, other members with R4 and R5 first).
  - `POST /api/w/[slug]/members/[uid]/buddy` (`app/(private)/api/w/[slug]/members/[uid]/buddy/route.ts`), counted as `member_facts` / `save`.
  - `app/(private)/_ui/CardBuddy.tsx`: on the card's Overview, "Buddy: Bram", a "Name a buddy" / "Change buddy" chip that opens a select (officers, members) with "Save buddy", and "Undo", which clears. Controls are 44 px (`chip`, `FIELD`).
  - `MemberRow.buddy` (optional) and `CardData.buddy`; Follow-up shows "Buddy: {name}" under the reasons of a row that is under Worth a hello.
- `docs/decisions/D140-...md`: amendment 2026-11-28.
- Tests: `lib/private/members-joined.test.ts` (listed within 7 days with date; not after 7 days; never on a break), `app/(private)/api/w/[slug]/members/[uid]/buddy/route.test.ts` (set and clear by an officer; 409; member session 401 and other workspace 404; buddy outside the alliance 400), `lib/private/buddy.test.ts` (shown by name, card list order), one case in `follow-up-groups.test.ts` (join date and buddy line). `member-session.test.ts` has a fixture for the new route (D105).

## Decisions

- "An officer or a current member" is read as: any current member of the own alliance, with R4 and R5 listed first. The tracker has no other list of officers in the roster, and a Discord-only officer is not a game member.
- The join reason shows even while a member is `settling` (first seen under 7 days ago): settling only suppresses the offline signals, and new members are the point of this reason.
- "Undo" is the clear: it shows next to the buddy once one is set and writes a null version.
- Buddy stored as a fact outside `FACT_FIELDS` (the `leftReason` pattern) instead of inside it, to keep it out of the facts editor and its `Record<FactField>` code.
- The analytics event reuses `member_facts` / `save` (closed lists in `lib/analytics/server.ts`).

## Deviations

- None from the task. The issue says "no count"; a joined member is a check-in reason like the not-seen one, so Home's and Follow-up's existing check-in counts include them. See Open issues.

## Verified

- `pnpm vitest related --run` on the changed files: 119 files, 674 tests passed.
- `pnpm check`: prettier, eslint, tsc, vitest, drift and i18n checks passed (after fixing a lint size error and the D105 route fixture).
- Not run in a browser: the card's buddy block was not seen at 360 px.

## Open issues

- A joined member reads as "Check in" in the Members status and in the existing check-in counts, because the reason list drives both. If the owner wants joined members out of those counts, the reason needs its own flag.
- The card's buddy select lists every other member; with a large alliance a search box may be wanted.
- The ready message does not name the buddy.

## Next

- Look at the card's buddy block at 360 px and in dark mode.
- Decide whether a joined member counts in "n to look at".
- Patch note for the next release (`lib/patch-notes.ts`).

What was missing from the task prompt? Nothing blocking; "an officer or a current member" needed the reading in Decisions.

PR: (added by the orchestrator)
