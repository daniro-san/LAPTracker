## D162 — Plans per alliance: a free core and a premium plan for the features that cost processing, one code mapping in the owner's layer, existing alliances grandfathered, no payment yet (2026-11-27, owner, issue 788; amends D126, D134)

Why: the owner (issue 788, refining issue 780) wants the core of the desk to stay free and the complementary features that cost processing to be premium. The owner's examples: the garrison suggestion, insights, the shield read, the squads read and the AI features. No payment method yet: everything is ready so a payment page and a callout can be added later.

**The plan.** Each workspace has `plan` (`free` or `premium`, default `free`) and `plan_grandfathered_until` (null: not grandfathered) on `workspaces` (migration `0093_plans`). The migration sets the end 3 months ahead on every workspace that exists, so each keeps what it has today until then (owner, 2026-11-28). The owner sets both on /admin (the workspace card's "Plan" row; `POST /api/admin/workspaces/features` `{action: "plan", workspace_id, plan, grandfathered?}`, PIN only, counted as `ws_action` `features` / `plan`).

**One mapping.** `PLAN_FEATURES` in `lib/workspace-features.ts` lists each plan's features: premium is every feature; free is every feature not in the premium set. Premium today:

- `garrison`, `insights` (the owner's examples);
- `notice_translate`, `notice_improve`, `notice_fit`, `thanks_draft`, `discord_translate_me`, `discord_translate_everyone` (the model);
- `squads`, `shield_check`, `recruit_check` (tracker calls on the alliance's key).

**Owner's tiers (2026-11-28).**

- **Raid Shield.** Free: Raid prep with the officers' own marks (Shield and Squads off the wall), "Copy n names" and "Copy one message", and the Shield-up reminder post (`post_shield_up`). These belong to `roll_call` and `post_shield_up`. Premium (`shield_check`): the automated reads (night, after-reset, morning), "Accept the tracker's", the auto-filled "To check by hand", the counts post, the per-workspace read times (issue 859), and the raid opponent reads behind the same switch (issue 861, D165). No new feature key was needed: the code already gated exactly these parts on `shield_check`.
- **Screenshot reader (`ocr`): a cap, not a lock.** On the free plan our server reads up to `FREE_SHOTS_A_WEEK` (20) screenshots per UTC week, Monday 00:00 to Monday 00:00. Every way in counts: "Send screenshots" and "Read from a screenshot" (`/api/w/[slug]/shots/read`, one per picture), the phone's share (`/w/[slug]/share`, all its pictures at once) and the Discord command (all of a message's pictures at once). A request that would pass the cap reads nothing and says so (429 `cap_reached`, Home's `shared=cap`, the command's reply). Typing stays unlimited. The count is a `workspace_usage` row with `allowance` `ocr` on the week's Monday, written in the cap's one statement (`spend`). Premium, grandfathered and OGs have no cap and count nothing.
- **Grandfathering: 3 months.** `plan_grandfathered_until` (timestamptz, null: not grandfathered) replaces a flag. Migration `0093_plans` sets it to the migration's `now()` plus 3 months on every workspace that exists. The window is read on the database's clock with the settings. While it runs, Home tells the officers until when, with a "See plans" link, and the Plans page says the same. /admin's "Grandfathered: On" sets it to 3 months from the tap (`GRANDFATHER_MONTHS`); Off clears it.
- **OGs forever.** The own alliance (`OWN_ALLIANCE_ID`) has every feature, no screenshot cap and no grandfathering end, whatever its row says.
- **Officers pay; members never see plan words.** Unchanged.

Never premium: privacy, safety, export and workspace deletion, the members' board, Discord sending of what officers write (notices, Send to LAPTracker, the alliance's line on our posts), the Shield-up reminder post, and anything members need. The panel's split per feature is in `docs/handoff/feat-788-plans.md`.

**In the owner's layer.** `planLocked` gives the features a workspace's plan leaves out: none for the own alliance (OGs, `OWN_ALLIANCE_ID`), none for a workspace inside its grandfathering window, else what its plan does not cover. `storedSettings` adds them as `locked`, and `allowed(settings, f)` (the owner allows it and the plan covers it) is what `resolveFeatures`, the desk's Features list and its switch read. So a premium feature on the free plan behaves exactly as one the owner did not allow (D126, D134): it is off, its tab, button and Discord command go away, its address goes to Home, and its routes refuse it (`403 not_allowed` for the alliance's switch).

- **Nothing is deleted.** A plan change touches only the two plan columns. The owner's and the alliance's own switches stay stored, so a later premium plan or grandfathering shows everything as it was.
- A plan change re-registers the Discord commands of a server that had them (D129), as a switch does.
- /admin's switches keep showing the owner's own value; one the plan leaves out says "not in its plan".

**On the desk (officers only).** In Alliance settings → Features, a feature the plan leaves out is listed in its group with its name, a "Premium" tag and one line ("Part of the Premium plan. Nothing your alliance saved is lost."), with a link to the Plans page. Nothing is on hover; links are 44 px. Alliance settings → Plans (`/w/[slug]/settings/plans`) says the alliance's plan, what each plan covers (read from `PLAN_FEATURES`, so it cannot differ from what is enforced) and why, and that changing plans deletes nothing. English, Português and Français.

- **No price and no payment.** `PlanPaymentSlot` is the place for a payment link (copy key `plans.payment`); it renders nothing while the page's link is null.
- **Members never see plan words.** The Plans page sends a member's session to the board (D105). The board shows no plan text, and a premium feature is hidden from members as an owner-off one is (D126 amendment, issue 483).
