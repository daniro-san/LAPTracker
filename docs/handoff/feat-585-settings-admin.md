# feat-585-settings-admin: Alliance settings says what is set, what saves and what needs a look (#585 batch 2b, slice 1)

Size L, planned with `/tlc-spec-lean`: `.specs/features/585-settings-admin/plan.md` (four slices) and `checks.md` (slice 1). This PR builds slice 1 only.

## Built

- **"On this page" index** on Alliance settings (`/w/[slug]/settings`): one 44 px jump link per card shown (Tracker key, Features, Raid Shield check while it is on, Notifications while the site has push keys, Discord, Your alliance's data), each with its state in words ("Working", "19 of 20 on", "Summary to Discord: on", "3 of 3 channels set", "Deletion asked: …"). Yarn with a dot only for what stops something working: a key refused, out of quota or to enter again; a webhook to paste again; the summary on with no Raid Shield channel; a deletion asked. Rules in `app/(private)/_ui/settings-index.ts`; drawing in the new layout component `lib/brand/components/layout/PageIndex.tsx`. Above the cards on a phone (inside the first 360 × 780 screen in EN, PT and FR), in the sticky margin column from 1024 (`Spread marginFirst stickyMargin`, the page now passes `wide`).
- **One save model.** The page head says "Each card saves with its own button. Notifications are for this device only." Features no longer saves on each tick: ticks are a draft, "Not saved yet: n changes" in yarn, Save sends one `POST /api/w/[slug]/features` per changed switch, one after another, and stops at the first refusal with the rest kept as the draft (`settings-save.ts`). The Raid Shield check card uses the same `SaveRow` (Save off with no change). Both warn before a reload or close while changes wait (`useLeaveWarning`).
- **Discord says one thing about the bot** (`discord-step.ts` `botLines`). With no Discord app on the site, one block "Bot and commands" replaces steps 1 and 2 and the channels' heading loses its "3."; the stored "LAPTracker is in your server" / "Commands on" never shows beside "not set up". With the app id but no bot token, step 2 says only that Check is off.
- **The Raid Shield channel's privacy line** (D147 text, unchanged) is at body size and full ink, with a "Leaders only" tag (yarn) beside the channel's title.
- **Labels** of the Raid Shield check's two selects are 8 px from their select (were 4).
- **In-place help** (`HowTo.tsx`): "How to get a webhook URL" (open while a channel is not set) and "Posting in a private channel?" are 44 px summaries.
- Strings in EN, PT-BR and FR. `prep.settings.save` / `prep.settings.saved` removed (the save row's `save.*` keys replace them).
- Docs: DESIGN.md gains `PageIndex`, "Save row" and "In-place help"; D134 amendment (the switch saves on Save); tracking plan "Changed" line.

## Decisions

- Explicit save model: every card that changes something for the whole alliance saves with its own button; per-device Notifications keep saving on tap (D148) and the page head says so.
- Yarn in the index only for what stops working. No key is a choice (D134), so "Not set" is plain.
- The index is a reusable layout component so slice 2 can use it on /admin ("Needs you").
- Discord with the site's bot off reads "commands off on this site" in the index, not "bot off": in the after-build first-glance test "bot off" beside "3 of 3 channels set" read as "nothing posts", while webhooks post without the bot.
- Standing approval applies: no one-way door (no data deleted, no schema, no change to who sees which field, no quota, no dependency); product-strategy and adversarial verdicts are in the plan.

## Deviations

- Plan AC 2 and check C2 wording changed from "bot off on this site" to "commands off on this site", with a dated note in both files (the first-glance MUST above).
- Page height barely moves: 360 px 4,916 → 4,904; 768 3,849 → 4,014 (the index sits above the cards in one column below 1024); 1280 3,825 → 3,691. The finding's goal was an index and a clear first screen, which this meets; shorter cards are a follow-up.

## Verified

- `pnpm check`: see the PR (run on the final tree).
- Unit tests (one per behaviour): `settings-index.test.ts` (2), `settings-save.test.ts` (3), `discord-step.test.ts` (2). Each was seen failing on purpose: 10 mutations, all killed (refused key not flagged; no key flagged; summary without channel not flagged; Raid Shield row while off; site channel not counted; a box ticked back counted; requests sent in parallel; sending on after a refusal; off state showing the stored "in your server"; cannot-check showing it).
- Walked on a local production build with the invented 585 seed (Chrome, 360 px): two ticks and an untick sent nothing and showed "Not saved yet: 1 change"; reload raised the `beforeunload` dialog; Save sent exactly one POST, showed "Saved.", and the value and the index ("19 of 20 on") survived a reload; Raid Shield check's Save is off at rest and its status clears when the select goes back; label gaps 8 px and 8 px.
- Screenshots (scratchpad, not committed): `585-2b/shots/before/` and `585-2b/shots/after/` at 360, 768 and 1280, light and dark, EN, plus FR and PT at 360; a refused key in `585-2b/shots/after-attention/`.
- First-glance test (360 × 780, ~5 s), before → after:
  - R5, 40s, EN, "Is our Discord set up so the Raid Shield summary posts?": "this page is the tracker key" (wrong) → "summary on, 3 of 3 channels set" (right).
  - War lead, 30s, "Is the Raid Shield check on?": a guess (wrong) → "yes, it has a row, summary on" (right; the morning time is one tap away).
  - Diplomat, early 20s, FR, "Où je règle le salon pour les annonces ?": "here is the key, not Discord" (wrong) → "Discord, 3 salons sur 3 configurés" (right).
  - Discord upkeep officer, 50s, US, "Is the bot in, are all channels set?": no answer → "all channels set; commands are off on the site's side" (right).
  - Officer, early 20s, Ukraine, EN as L2, "If I untick a feature, is it saved at once?": "no features here" (wrong) → "no, each card has its own Save" (right).
  - Architect, 30s, Switzerland, "What can I change here?": "only the key" (wrong) → the five cards (right).
  - Owner on /admin, "What do I need to do today?": "nothing" (wrong, a request and two setups wait) → unchanged; slice 2.

## Open issues

- The leave warning covers reload and close only, not in-app links (same as the notices editor). Follow-up if officers lose drafts.
- The Raid Shield row could carry the morning time ("From 10:00 ST · summary on"); the war lead needed one tap for it.
- The Discord channels' Remove still looks like Send a test message and Replace (finding B-7); it already asks first.
- The new-alliance guide's Alliance settings screenshots need a refresh after release (CONTRIBUTING, "The new-alliance guide").
- Analytics plan: no new event; a dated "Changed" line for `ws_action` `features`. PostHog side: nothing reads `features` by action, so no insight changes.

## Next

- Model/effort: keep. Slice 1 fit one session with room for the persona and mutation passes.
- What the owner must do first: nothing for slice 1. Slice 4 (who can open the desk, F38) waits on the owner's decision: it would show Discord role names on Alliance settings, which the desk does not show today.
- Plan change: none to `docs/IMPLEMENTATION_PLAN.md`; the slices are in `.specs/features/585-settings-admin/plan.md`.

<adjustments>
- Slice 2, /admin first screen (F11, F12, F13, F34): add "Needs you" first, with counts (access requests, workspaces with a setup gap, page errors in 24 h, quota above the cap or low, a tick late by 20 minutes or more), built on `PageIndex` with its attention rule; `attentionOf` counts a closed board, no read, no Discord and no member role; nav counts for App errors and workspaces; `WorkspaceForm`'s select keeps a workspace's own alliance with no read; quota above the cap is not "OK"; "of 1,000" from one constant; `/admin/errors` shows `workspace_slug`. Measured before: /admin 9,184 px at 360, 6,578 at 1280; the owner concluded "nothing to do" with a request and two setups waiting.
- Slice 3, /admin structure (F33): `/admin/workspaces` and `/admin/workspaces/[slug]` (setup checklist, the features' two layers in plain words, role ids with where to find them, a danger zone whose actions keep their confirmations). New routes: M triggers, its own plan review.
- Slice 4 (F38): `decision` label; do not build before the owner answers.
- PostHog (orchestrator numbers, 30 days): /admin 42 views / 34 sessions / 14 under 640 px; settings 14 / 14 / 7; `ws_action` features 8, discord save 2, discord check 1, tracker_key save 1.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/620
