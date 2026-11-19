# 11ar — Thefts log: steps, the attacker's server, whom to contact, the warning

Issue #321. Decisions: dated amendments to D97 and D108 (no new number). Base: `origin/dev` at 90698b5. Rules applied: D71, D75, D97, D100, D108, D110, D115.

## Audit against issue #321 (before this session)

| Issue scope | On dev before 11ar | After 11ar |
| --- | --- | --- |
| Victim (uid), thief name and tag, time, source | Built (D97) | Unchanged |
| Thief's server | Missing | Built: set per attacker; 325 for a tracked player |
| Stolen items as text | Only a typed entry's note | Built: typed in the screenshot review, stored and shown (the OCR cannot read them) |
| Status with who and when: reported → warned → talked → retaliated → resolved | Per attacker, 3 states (open, talked, resolved) | Per attacker, 5 states, each change kept with who and when |
| Same-server flag (325) | Missing | Built: "Our server · #325" on the card |
| Public alliance page + leader for a tracked alliance | Missing | Built on the alliance section |
| Repeat counts per thief and per alliance | Built (this week, total, last) | Unchanged |
| OCR draft rows from the report screen | Built (D96, D110, `saveSecretOpsDraft`) | Unchanged; checked end to end |
| Discord "Apps → Send to LAPTracker" | Built (D96, D110) | Unchanged; not run here (no real Discord) |
| Warning to paste, en/pt/fr | Missing | Built |

## Built
- **Schema** (`lib/schema-thefts.ts`, migration `drizzle/0047_theft_steps_server.sql` from `pnpm db:generate`, after dev's `0046_record_delete`): `thefts.attacker_server` (integer, nullable); `theft_follow_ups.state` accepts `open, warned, talked, retaliated, resolved` (check constraint replaced).
- **Steps** (`lib/private/theft-groups.ts`): `FOLLOW_UP_STATES` has five steps. Reopening after a later theft works as before.
- **The attacker's server** (`groupThefts`): the newest server set, else 325 for a `uid:` attacker (a player of a tracked alliance), else null. `setServer` in `lib/private/thefts.ts` and `setAttackerServer` in `lib/repo/thefts.ts` set it on all of that attacker's entries in the workspace.
- **Whom to contact** (`theftsView`): each alliance group gets `contact` when its tag is a tracked alliance other than ours and one of its attackers is on our server. The leader comes from the new public query `leaderNames` (`lib/queries/leadership.ts`): the R5 of the newest public Before or After read with ranks (`publicEvent`, `phaseSnapshot`). `theftsView` also returns `ownTag`.
- **Warning** (`lib/private/theft-warning.ts`, pure): `theftWarnings` builds the text in en, pt-BR and fr at once: greeting, number of thefts reported, the last server day, "same server #325", and a request to take from the KvK enemy instead.
- **Route** `POST /api/w/[slug]/thefts` `{action: "server", attacker, server: 1..99999 | null}`, counted as `ws_action` `theft` / `edit` (tracking plan updated). `follow` takes the five steps.
- **UI**:
  - `TheftCards.tsx`: the alliance section shows "On our server. Their leader: Ravenmoor" and a link "Open the page of Natural Selection" (`/alliances/<id>/history`, 44 px). The card summary shows "Our server · #325" (yarn tag), "Server #412" or "Server not known". The steps radios have five options. The heading is "What we did".
  - New `TheftAttackerTools.tsx`: `ServerForm` (input with a numeric keyboard and Save, which stays off until the value changes) and `Warning` (three language chips with the officer's language first, the text, and `CopyButton`). The warning shows only for an attacker on our server.
  - `theft-data.ts`: `server`, `warnings` per card; `contact` per alliance.
- **Activity** (D108): a new small source "theftStep", read with the page cursor and never grouped: "Ana marked an attacker in the thefts log “Warned the player”". It never shows the attacker or the note. New `lib/repo/desk-activity-thefts.ts` holds this part and the existing thefts-added read, moved out of `lib/repo/desk-activity.ts` because that file was at the 300-line limit. Follow-up and theft rows now carry their `kind` from the repo, so `merge` spreads them in one line. In `activityLine`, one `"entry" in item` check replaces the four entry `case` labels, which keeps the function under the complexity limit.
- **Words**: 18 keys in `dictionary.thefts.ts` and 1 in `dictionary.activity.ts`, each in EN, PT-BR and FR.
- **Docs**: amendments to D97 and D108, `docs/ARCHITECTURE.md`, `docs/analytics/tracking-plan.md`.
- **Tests** (one per behaviour):
  - `theft-groups.test.ts`: the attacker's server (set, tracked, unknown);
  - `theft-data.test.ts`: the contact line, the link and the "Our server" label;
  - `theft-warning.test.ts`: the three texts, then the singular with no day;
  - `thefts.test.ts`: an invented OCR report gives three thefts; servers set; contact only for tracked NSE; `setServer` refused from another workspace. A second test walks the five steps to Resolved, each with who and when;
  - `leadership.test.ts`: `leaderNames` picks the newest read's R5, and nothing for an alliance without ranks;
  - `desk-activity.test.ts`: the step line, with no attacker and no note.
- **Second round (coordinator's answers for the owner, 2026-11-19):**
  - EN step "Hit back" is now "Retaliated"; PT "Revidamos" and FR "Riposte menée" stay.
  - **Follow-up tab** (`lib/private/follow-up.ts`, `app/(private)/w/[slug]/follow-up/page.tsx`): lists every attacker whose step is not Resolved, and each line names the current step (yarn only while Open or Open again). D104 amendment. Test in `lib/private/follow-up.test.ts`: Open and Warned are listed, Resolved is not.
  - **Stolen items:** the recorded OCR of real reports (fixtures 53 and 54) reads the item pictures as noise ("AZ)", "rari", "RHee"), so a parser would only fit a text format I made up. Instead `thefts.items` (plain text, nullable, in the same migration) holds what the officer types under each theft in the screenshot review ("What was taken (optional, from the report’s pictures)", max 200). It travels through `import-input.ts` (zod), `import.ts` (`ReportEntry`), `import-kinds.ts` (`ReviewedEntry`) and `saveSecretOpsDraft`. The card's entry shows "Taken: …" ("Levado: …", "Pris : …"). The report test in `thefts.test.ts` checks the trimmed text is stored, and stays null when left empty. D97 amendment.

- **Review round (PR #440 at 73e489f5):**
  - Server inference: only `thefts.roster_exact` entries infer 325. These are an officer's pick, or a screenshot entry with the player's current name and the same tag exactly. Fuzzy, tagless or other-case matches keep the uid but leave the server not known (`thefts-import.ts` `trackedPlayer`/`attackerFields`).
  - Officer's server per attacker in the new `theft_attackers` table, apart from the entries, so a delete and its Undo cannot change it. "Mark as not known" stores null and hides an inferred 325. The field is pre-filled only with an officer's number.
  - Contact: a tracked alliance only when an attacker on our server carries its tag exactly.
  - Leader: R5 of the newest read among the last 4 public events, shown "as of {day}".
  - Steps: `requestId` (D100, `newRequestId`) and `expected` (the newest change id the card saw). A retry adds nothing; a stale step answers 409 `conflict`, and the card reloads with "Another officer changed the step first…".
  - The warning is decided in `theft-data.ts` (only on our server), so it is tested there.
  - Migration `0047_theft_steps_server` regenerated: it adds `theft_attackers`, `thefts.roster_exact` and `theft_follow_ups.request_id`, and drops nothing on dev. Its last statement, written by hand under the generated SQL, marks typed entries with a uid as exact.
  - Tests:
    - `theft-groups.test.ts`: officer's server vs inferred vs not known; reopening after Warned and after Retaliated;
    - `theft-data.test.ts`: the warning only on our server;
    - `thefts-follow.test.ts` (new; the done_when tests moved here, with shared setup in `thefts.test-helpers.ts`): retry and conflict; exact vs tagless vs other-case screenshot matches; the contact not shown for a tag that differs in case;
    - `leadership.test.ts`: the read's date and the 4-event lookback;
    - `route.test.ts`: `action: "server"` gives 400 for 0, 404 for an unknown or deleted attacker, and stores null as not known.

  - `app/(private)/api/w/[slug]/record-delete.test.ts` (D123) sends a step with `requestId` and `expected` now.
  - Verified: `pnpm check` exits 0: vitest 214 files passed, 2 skipped; 1158 tests passed, 4 skipped; drift gate "Everything's fine"; i18n "17 languages up to date". The browser e2e was not re-run for this round.

## Decisions
- **Steps stay per attacker**, not per incident. D97 (owner, 2026-11-16) made the follow-up per attacker, and officers act on a player or an alliance, not on one row. "Reported" is the existing Open state. Any step can be picked at any time; nothing advances on its own (D75).
- **A name is never put on our server from its tag alone.** Tags are not unique across servers, so only a uid match (tracked roster) or an officer's entry sets 325.
- **The contact needs a tracked alliance and an attacker on our server.** An untracked alliance on our server gets the warning but no link, because it has no page.
- **The warning text lives in code**, not in the dictionaries, because all three languages are needed whatever the officer's language. Its UI labels are in the dictionaries.
- **The server change is counted as `edit`**, so no new word was added to `DESK_ACTIONS`.
- **Dated amendments to D97 and D108**, not a new D number.

## Deviations
- "Talks with their alliance" became "What we did" ("O que fizemos", "Ce que nous avons fait"), because warning a player and hitting back are not talks. The D97 amendment records this.
- D108's "Not done" listed theft follow-up states (owner: "not this round"). The brief asked for D108 activity lines, so a step line was added; the D108 amendment records it.
- I moved `theftsAdded` (now `added` in `lib/repo/desk-activity-thefts.ts`) and replaced the entry `case` labels in `activityLine` only to stay under the line and complexity limits. Neither changes behaviour.

## Verified
- `pnpm check` exits 0: prettier, eslint, tsc; vitest 211 files passed, 2 skipped; 1132 tests passed, 4 skipped; drift gate "Everything's fine"; i18n "17 languages up to date". The first run failed `lib/brand/tokens.test.ts`: "#325" in a comment and a test read as a hex colour. Both were reworded.
- **After the rebase on #427 (D123):** `pnpm check` exits 0: vitest 213 files passed, 2 skipped; 1153 tests passed, 4 skipped; drift gate "Everything's fine"; i18n "17 languages up to date". The local DB was reset and migrated through `0046_record_delete` and `0047_theft_steps_server`.
  - Local e2e, 24 of 24 checks, at 360 px on a production build. Three invented report pictures went through "Send a Secret Ops report", the server OCR, review and Save. On the first, the officer typed "1.2M food, 300K wood", and the card shows "Taken: 1.2M food, 300K wood" (PT "Levado: …").
  - NSE: "On our server. Their leader: Ravenmoor" and its 44 px page link. Thornquill shows "Our server · #325". Servers were set: Pebblewick 325, Fernby 412. The warning is offered for our server.
  - The Follow-up tab listed "Thornquill · Warned the player", "Pebblewick · Retaliated" and "Fernby · Open". Once all three were Resolved, the section was gone. Home shows the step line and no attacker name.
  - No sideways scroll at 360 and 1280, light and dark, EN and PT.
  - Screenshots in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ar-shots/`, including `review-items-360-light-en.png` and `follow-up-360-light-en.png`.
  - Tests for deleted thefts: `follow-up.test.ts` (a deleted attacker at Warned is not listed) and `desk-activity.test.ts` (no step line for an attacker whose only theft is deleted).
- Targeted vitest before the refactor for line limits: 6 files, 30 tests passed.
- Second round: `pnpm check` passed prettier, eslint and tsc. Vitest: 1128 passed. Five tests in files this branch does not touch timed out at 10 s under machine load: `upstream-status`, `manual-event`, `snapshot`, `tick` and `member-session`. Run alone with `follow-up.test.ts` and `thefts.test.ts`, the 7 files pass (87 tests). Drift gate "Everything's fine"; i18n "17 languages up to date".
- **Local e2e, 40 of 40 checks** on a production build (`next start` on :3993), db:local on 55487 (bridge 55488), Discord stub on 55489, playwright-core with system Chrome, 360 px. Seed: an invented 12-member OGs roster, NSE's roster with three invented players, and one public event read naming NSE's R5. No upstream, Discord, Groq or `/api/quota` call.
  - Three invented French report pictures, rendered locally and never committed, were each sent with "Send a Secret Ops report", read by the server OCR, reviewed (member picked) and saved: "Saved 1 theft." ×3. The first said "Left out: 1 help" (our own member's help line).
  - Log: sections [NSE], [QRX], [ZZT]. NSE reads "On our server. Their leader: Ravenmoor" with a 44 px link to `/alliances/67109944/history`. Thornquill (tracked) shows "Our server · #325"; the other two show "Server not known". After the officer set the servers, Pebblewick shows "Our server · #325" and Fernby "Server #412". Only NSE has a link.
  - Warning: three chips ≥ 44 px. The Portuguese text starts "Olá, Thornquill. Aqui é a liderança da [OGs]." and has #325. Copy puts exactly that text on the clipboard. Fernby (server 412) has no warning. The server field and its Save are ≥ 44 px.
  - Steps: Thornquill went Warned → Talked → Hit back (the first-round label, now "Retaliated") → Resolved; Pebblewick Warned → Resolved; Fernby Resolved. All three read Resolved, with "… · Set by Ana" history. Step radios are ≥ 44 px.
  - Home reads "Ana marked an attacker in the thefts log “Resolved”" and no attacker name appears.
  - Route: server 0 → 400; unknown attacker → 404; unknown step → 400.
  - No sideways scroll at 360 and 1280, light and dark, EN and PT. PT shows "Nosso servidor · #325", "No nosso servidor. Líder deles: Ravenmoor", "Avisamos o jogador", "Revidamos", "O que fizemos", "Aviso para o correio do jogo".
- Screenshots (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ar-shots/`: `thefts-{360,1280}-{light,dark}-{en,pt-BR}.png` (Thornquill's card open), plus `review-360-light-en.png`, `log-360-light-en.png`, `card-warning-360-light-en.png` and `resolved-360-light-en.png`.
- Not run: the Discord "Send to LAPTracker" path (no real Discord), FR screenshots (FR strings are covered by the i18n check), a Vercel deployment.

## Open issues
1. **Stolen items** are typed, not read. If the owner shares a report whose item counts the OCR reads as text, a parser can fill the field. Typed entries still use their note; the add sheet has no items field.
2. **Rebase on #427** (soft delete through `lib/repo/trash.ts`, `live(table)`): `setAttackerServer` needs `live(thefts)`; `added` (moved into `lib/repo/desk-activity-thefts.ts`) needs the live condition if #427 adds it to `theftsAdded`; and `hasAttacker`/`listThefts` belong to #427.
3. The browser e2e ran before the second round. The second round (Follow-up list, items field and line, "Retaliated") is covered by `pnpm check` and its tests, not by a new e2e run.
4. The leader comes from the newest public event read with ranks, not from the daily roster, which has no ranks outside our own alliance. It can be days old.
5. The warning wording and the step names were confirmed by the coordinator for the owner (2026-11-19).
6. Rebased on #427 (D123, `0046_record_delete`): my migration is `0047_theft_steps_server`. `setAttackerServer` and the activity read `added` use `live(thefts)`; the step lines need a live theft of that attacker; `listThefts` and `hasAttacker` already use `live`, so the log, the Follow-up list and `setFollowUp` ignore deleted thefts.
7. Portuguese still keeps "Secret Operations" and "Quest rewards" in English (D52, unchanged).

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. No signal either way. The only rework was fitting the 300-line and complexity limits on the activity files.
Owner must do first:
1. Nothing to unblock. Optional: a report screenshot where the item counts are readable, if items should be read rather than typed.
Plan changes needed: none. The workspace track lives in issues, not in `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- `theft_follow_ups.state` has five values (open, warned, talked, retaliated, resolved). "Still to follow up" means `state !== "resolved"` (`lib/private/follow-up.ts`). `thefts.items` holds what was taken, typed in the screenshot review.
- `thefts.attacker_server` exists. An attacker's server is `AttackerGroup.server`. Same server means `=== SERVER` from `config/alliances.ts`.
- `leaderNames(db, unionIds)` in `lib/queries/leadership.ts` gives a tracked alliance's R5 by union id.
- Theft activity reads are in `lib/repo/desk-activity-thefts.ts` (`added`, the steps part), not in `lib/repo/desk-activity.ts`.
- Migration `0047_theft_steps_server`, after `0046_record_delete`.
</adjustments>

PR: (added by the orchestrator)
