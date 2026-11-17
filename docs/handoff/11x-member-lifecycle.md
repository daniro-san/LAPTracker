# 11x — New members added by hand, former members keep their facts

Part of #293. No open issue asks for this; it comes from an officer's test of `/w/ogs` and the owner's promise. Branch `session/11x-member-lifecycle`, on `origin/dev` at 2ec35da. Rules applied: D71, D75, D80, D96, D98, D99, D100. New decisions: **D106**, **D107** (they amend D80 and D96).

## Built
- **Pending members (D106).**
  - Table `pending_members` (migration `drizzle/0030_pending_members.sql`). Facts of a pending member are `member_facts` rows under the uid `-id`, so `saveFacts`, versions, 409s and merges are unchanged.
  - `POST /api/w/[slug]/pending`: `add` (request id, D100; a repeat answers the first member and stores nothing), `link`, `delete`. Answers `401 signed_out`, `403` for a form from elsewhere, `400 bad_name` for a name with no name key.
  - Members tab: "Add a new member" opens the facts editor with a name field first (`FactsEditor` with `uid: null`). Pending members are listed above the list under "New members", tagged "New · waiting for tonight’s roster". Their sheet has the facts (Edit, Paste), "Link to a member" (`PendingLink.tsx`: the five closest names, then everyone by name, a name-key search) and Delete (asks first).
  - Reconcile (`reconcilePending`) runs when the Members tab is read. It uses the newest roster of any kind and only looks at pending members added at or before that roster's read time. One member with the same name key, or with the uid that key is remembered for, and no facts yet: the facts move (versions and times kept), Alliance Duel points move, the alias is saved, and the row is marked matched. None or several: it stays, and its sheet says "The daily update of <date> had no single match…". A link by hand appends the pending member's versions after the member's own versions.
- **Screenshot import.** A row not found offers "New member: <read name>". Choosing it shows an editable name field and "Pick a member instead". On Save, the pending member is made or reused by name key inside the save's transaction (`withNewMembers`). Each row's picker also lists pending members under "New, waiting for the roster".
- **C — closest names.** Doubtful rows already put the matcher's suggestions first under "Closest names". Not-found rows had none. They now get the three closest names (`closestNames` in `lib/screenshot/match-name.ts`, edit distance between name keys).
- **Former members (D107).** "Members · Former members" chips at the top of the tab (`?view=former`). The list puts the newest leavers first, has a search and shows 25 rows at a time. Each row has the name, "Last seen <day>", "Might · Kills" and the recorded facts. A row opens a sheet whose facts can be edited. `saveFacts` now accepts a uid that any roster of this alliance ever listed, or an open pending member. Roll calls keep `isMember`. The read (`lib/repo/workspace-past-roster.ts`) takes only uid, name, might and kills from the roster arrays; it never reads `raw_json`.
- **Words:** `lib/private/dictionary.lifecycle.ts`, 38 keys in en, pt-BR and fr. No existing string changed.
- **Docs:** D106, D107, amendments to D80 and D96, the decisions index, ARCHITECTURE, GLOSSARY (pending member, former member), DESIGN ("View switch").
- **Tests:**
  - `lib/private/pending-members.test.ts` (3): one match moves the facts with their versions and times and records the alias; no match, several matches, a member who already has facts, and a pending member added after the roster each stay pending; a link appends versions.
  - `lib/private/former-members.test.ts` (1): who left, newest first; facts writable; never-seen uid refused; only six keys returned; no private value from `raw_json`.
  - `app/(private)/api/w/[slug]/pending/route.test.ts` (2): an add with its facts, a repeat stores nothing; 401, 403, 400, `bad_name`.
  - `lib/private/import-new-member.test.ts` (1): a not-found row saves to a new pending member; the next save under the same name key reuses it.

## Decisions
- **Storage:** a `pending_members` table plus the uid `-id` in `member_facts`, so all facts go through one pipeline. Moving the facts is one `update` that shifts versions by the member's newest version.
- **Reconcile runs when the Members tab is read, not inside the end-of-day read.** `lib/daily-read.ts` cannot import `lib/private` (D71's fence). Two officers opening the tab at once move a pending member only once: a claim with `matched_uid is null`, inside one transaction.
- **"Any later roster read" means a roster read at or after the time the pending member was added.** A roster read before then never matches them.
- **Delete removes the pending member's facts and points.** They belong to a row that never was a member. Facts of real members are still never deleted.
- **Import:** "New member" is offered only on rows that were not found, as asked. It works for the editable kinds (Alliance Duel, member update). Checks are read-only and have no member pickers.

## Deviations
- The task said "at the nightly end-of-day read". Reconcile runs on the next Members tab read after it (see Decisions). An officer sees the same result; nothing else reads a pending member before then.
- The roll call, caravan and Elixir pages still list only the newest roster. A pending member stays out of them until it is matched. This is as asked for former members, and I applied the same rule to pending members.

## Verified
- `pnpm check` exits 0: prettier, eslint, tsc; vitest **162 files passed, 2 skipped; 845 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". One run timed out on `app/api/tick/route.test.ts` (a 10 s timeout under load). The same file passed alone, 13 of 13, and the full run passed after.
- **Local e2e, 47 of 47 checks.** Production build (`next build` + `next start` on :3937) of this branch rebased on 2ec35da. `db:local` on 54937 with all 31 migrations, its bridge on 54938, the Discord stand-in on 54939. Invented roster: 41 members over three end-of-day reads, four of whom leave, and two players named "Corvin". A fourth read was added during the run to test reconcile. No upstream, Groq or real Discord call; no `/api/quota`. Checks:
  - the switch, the add sheet's missing-name line, the add, a repeated request id, and a 401 without a session;
  - Delete asks first and deletes;
  - Zephyrine matched: her note moved with version 1 and the alias was saved;
  - Corvin matched the one Corvin without facts;
  - Thimble (two in the roster) stayed with the no-single-match line, its link picker led with both Thimbles, and the link closed it;
  - four former members, newest first, notes on the row, search, and a note saved on a former member;
  - the former page's HTML has no avatar URL, `last_online` or map key;
  - an import row not found has "Closest names", and "New member" saved under the fixed name "Wrenna Vale" with main squad 9,800,000 "from a message";
  - the server log holds no member name or note, and `app_errors` is empty;
  - at 360: no sideways scroll, every target ≥ 44 px, and fields at 16 px on Members, the add sheet, a pending sheet, the link picker, Former members and the import row. Checkbox and radio inputs inside 44 px labels are not counted.
- **Privacy grep:** every added line of the diff against the 101 names (3+ letters) of the OGs fixture roster: 0 found.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11x-shots/`:
  - `members-pending`, `add-sheet`, `pending-sheet`, `former`, `former-sheet` and `import-new`, each at `{360,1280}-{light,dark}-{en,pt}`;
  - `link-360-light-en` and `import-new-360-light-en`;
  - `iphone-{members,former,add}-390-light-en.png` (WebKit, iPhone 14), with `measures-iphone.json`: no sideways scroll, no field under 16 px.

## Review round (PR 385)
- **Start/End rosters:** former members and `wasInRoster` now also read `member_snapshots` (uid, name, power, kills only) for event Start/End rosters, which keep no arrays. D107, ARCHITECTURE and the file header say so. New test: a member only in a Start roster is a former member and can get facts.
- **Facts route:** a negative uid below the serial range answers 404 `not_member` (was a 500).
- **Add race:** after a lost insert, the add finds the pending member by request id, then by name key, so two officers adding one name at once share one member (test).
- **Tests added:** link 200 / `not_member` / 404; delete 200 then 404, removing facts and points; `moveDuelPoints` keeps the member's own value for a shared day; another workspace's pending uid refused by link, delete and the facts route.
- **One facts read per Members tab open:** `membersView` returns `facts`; the pending rows and `formerMembers` reuse it.
- **`lastSeen`:** still unbounded; the growth bound is written next to it and in D107.
- **PT copy:** "Corrija o nome se o print foi lido errado." (no "captura" left).
- **Verified:** `pnpm check` exits 0, vitest 163 files passed, 2 skipped; 855 tests passed, 4 skipped. Local e2e 47 of 47 on a fresh build and reseed, with a Start-only former member added (five former members, the Start-only one listed).

## Open issues
1. No warning when the name typed for a new member is already a current member's. The next roster read matches them only if that member has no facts; otherwise the officer links by hand.
2. Reconcile runs only when someone opens the Members tab. A Discord-only officer would not trigger it.
3. Before this change, a member who left lost their Alliance Duel points from view. Those points are still stored but not shown in the former view; the view shows only the facts.
4. `usedZones` (the time-zone picker's "used in the alliance first") now counts former and pending members' zones too.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. Both features and the e2e fit one pass; the only rework was harness state between e2e runs.
Owner must do first: release dev. Then on a phone add a new member, and check the next morning that their info moved to them.
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- A pending member's uid is negative (`-pending_members.id`). Any new per-member table that should follow a pending member must be moved in `merge` (`lib/private/pending-members.ts`), as `moveDuelPoints` is.
- Facts accept former and pending uids (`mayHaveFacts` in `lib/private/member-facts.ts`); other writes should keep `isMember`.
- Closest-names ranking for any picker: `closestFirst` in `lib/private/roster-search.ts` (browser-safe).
- Migration: `0030_pending_members`, on top of dev's `0029_roll_call`.
</adjustments>

PR: (added by the orchestrator)
