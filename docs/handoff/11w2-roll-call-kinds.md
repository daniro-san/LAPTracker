# 11w2 — Roll call kinds: plunders out, Cheese Trap in (issue 293, D103 amended)

## Built
- **Plunders are no longer added.** The "New roll call" sheet offers KvK shield, Undead Siege and Cheese Trap (`ADDED_KINDS`). The hint "Plunders: when we plunder caravans or Black Ops." and its key `roll.add.plunderHint` are gone in EN, PT-BR and FR. The route's zod enum is `ADDED_KINDS`, so `kind: "plunder"` on add answers 400 `bad_request`.
- **Old plunder roll calls stay.** `plunder` stays in `ROLL_KINDS`, in `REST` (null, no "the rest"), in the words (`roll.kind.plunder`, "Took part" / "Not this time") and in `roll_calls_kind_check`. Nothing deleted or migrated.
- **Cheese Trap.** New roll call kind `cheese`:
  - `FROM_CALENDAR.cheese = "cheese"`, so a Cheese Trap entry's week gets a roll call, a card on the week list and the agenda's "Roll call ›" link (the agenda reads `FROM_CALENDAR`).
  - ✓ / ✗ use the "did" word set: "Took part" / "Not this time".
  - `REST.cheese = "yes"`: "Mark the other n as took part".
  - The label is "Cheese Trap" in EN, PT-BR and FR (`roll.kind.cheese`).
  - A Calendar roll call takes the entry's title ("Cheese Trap II · Lv.7"); a hand-added one reads "Cheese Trap".
- **Variant.** `openOccasion` now keeps the entry's variant only for an Elixir Scramble. Without this, a Cheese Trap's "I"/"II" would hit `roll_calls_variant_check` (`in ('A','B')`) on the first mark.
- **Empty week line** now names Cheese Trap: "No KvK, Undead Siege, Cheese Trap or Elixir Scramble in the Calendar this week." (EN/PT/FR).
- **Migration** `0035_roll_call_cheese` (from `pnpm db:generate`): drops and re-adds `roll_calls_kind_check` with `('shield', 'raid', 'plunder', 'elixir', 'cheese')`.
- **Docs.**
  - D103 has a dated amendment (2026-11-17) and an inline amendment note at each place it quoted plunders or Cheese Trap.
  - The glossary's "roll call" row now names Cheese Trap.

## Decisions
- **Cheese Trap's "the rest" is "took part"**, the same as the Undead Siege. D103 records this as an assumption the owner can change; it is one line, `REST.cheese` in `lib/private/roll-call-rules.ts`.
- **Cheese Trap I and II are separate roll calls.** Each Calendar entry gets its own roll call, as each Elixir team does.
- **No new decision number.** This is a D103 amendment.

## Deviations
- **One added string change the task did not list:** the empty week line (`roll.none`). With Cheese Trap entries getting roll calls, the old line was wrong. No decision quotes it.
- **The variant change in `openOccasion`** was not in the task. Calendar Cheese Trap roll calls cannot be saved without it.

## Verified
- **`pnpm check` exits 0:** prettier, eslint, tsc; vitest 172 files passed, 2 skipped; 921 tests passed, 4 skipped; drift gate "Everything's fine"; i18n "17 languages up to date".
- **New and changed tests:**
  - `roll-call-rules.test.ts`: the sheet's kinds are exactly shield / raid / cheese; `REST.cheese` is `yes`.
  - `roll-call.test.ts`:
    - A Cheese Trap II Lv.7 Calendar entry is on the week as kind `cheese`, titled "Cheese Trap II · Lv.7", and its rest writes `yes` while keeping a ✗.
    - A plunder roll call inserted as an old row is listed with its mark, titled "Plunders", and its rest is refused.
    - Cheese Trap I and II on the same day are two week items, each with its own counts.
    - A started Cheese Trap whose entry is deleted stays on the week with its mark, titled "Cheese Trap".
    - The hand-added test now uses `cheese`.
  - `roll-call/route.test.ts`: add `cheese` answers 200 with an id; add `plunder` answers 400 `bad_request` (two tests).
  - `addCall` takes `(typeof ADDED_KINDS)[number]`, so `tsc` refuses `plunder` there too (checked with a throwaway `@ts-expect-error` probe, not committed).
  - `member-session.test.ts`: its add body now uses `cheese`.
- **Local e2e, 32 of 32 checks.**
  - Setup: production build (`next build` + `next start` on :3947) and local Postgres on 57147 with all 36 migrations. Also the bridge on 57148, a Discord stand-in on 57149, and 11w's invented 60-member roster. The seed adds a Cheese Trap II Lv.7 entry (Thu Nov 19, 14:00 ST) and one plunder roll call with 2 marks.
  - No upstream, Groq or real Discord call, and no `/api/quota`.
  - Checks in PT and EN:
    - The week lists "Cheese Trap II · Lv.7"; EN also lists the old "Plunders".
    - The sheet offers exactly "KvK shield / Undead Siege / Cheese Trap" ("Escudo na KvK / Undead Siege / Cheese Trap"), with no plunder word or hint.
    - The Calendar links the Cheese Trap with "Roll call ›" / "Chamada ›".
    - The roll call's title is "Cheese Trap II · Lv.7", and its rest button says took part.
    - No sideways scroll and every target ≥ 44 px on the week, the sheet and the roll call.
  - Checks in EN only:
    - The buttons read "Took part" / "Not this time".
    - One ✓ plus the rest stored `yes` for 58 members (60 minus 2 away). The row is kind `cheese` with no variant.
    - A raw add of `plunder` answers 400 `bad_request`. A raw add of `cheese` answers 200 and opens as "Cheese Trap".
    - The old plunder roll call opens with "2 of 58 marked".
  - The server log has no error and no member name.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11w2-shots/`:
  - `week`, `add-sheet` and `mark-cheese`, each at `360-light-{en,pt}`;
  - `add-sheet-360-dark-en`, `mark-cheese-after-rest-360-light-en` and `mark-plunder-old-360-light-en`.
  - Reviewed: the three choices wrap to two rows at 360 in PT, and the labels are not cramped.
- **Privacy:** the diff adds no member names. Test and e2e names are the invented ones from the existing fixtures.

## Open issues
- **A Cheese Trap roll call whose Calendar entry is deleted** shows as "Cheese Trap", without I/II or the level, because the variant is not stored. Storing it would mean adding 'I','II' to `roll_calls_variant_check`. Not done.
- **Damage-event screenshots for Cheese Trap (D96) stay "coming soon".** The roll call only records who took part.
- **e2e harness note:** a local `.env.local` now needs `SNAPSHOT_WINDOW_MIN` and `QUOTA_CHECK_AT` (e.g. `fri 20:00`). `next start` needs `NODE_OPTIONS=--import ./scripts/db-local-preload.mjs` to reach the bridge.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — six code files, one migration and the tests fit one pass.
Owner must do first: release dev (it carries migration 0035). Then confirm or change "the rest" for Cheese Trap ("took part").
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Roll call kinds: `ROLL_KINDS` = shield, raid, plunder (read-only, old rows), elixir, cheese. `ADDED_KINDS` = shield, raid, cheese. `FROM_CALENDAR` maps kvk, undead, elixir and cheese.
- `Opened.variant` is set only for Elixir Scramble. Any code that needs a Cheese Trap's I/II reads it from `placed.entry.variant`.
- A Follow-up or report over roll call marks must accept `cheese` (✓ = took part) and the old `plunder` rows.
- Migration: `0035_roll_call_cheese`, on top of dev's `0034_workspace_member_roles`.
</adjustments>

PR: (added by the orchestrator)
