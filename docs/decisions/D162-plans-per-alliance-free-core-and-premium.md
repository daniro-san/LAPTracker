## D162 — Plans per alliance: a free core and a premium plan for the features that cost processing, one code mapping in the owner's layer, existing alliances grandfathered, no payment yet (2026-11-27, owner, issue 788; amends D126, D134)

Why: the owner (issue 788, refining issue 780) wants the core of the desk to stay free and the complementary features that cost processing to be premium. The owner's examples: the garrison suggestion, insights, the shield read, the squads read and the AI features. No payment method yet: everything is ready so a payment page and a callout can be added later.

**The plan.** Each workspace has `plan` (`free` or `premium`, default `free`) and `plan_grandfathered` (default false) on `workspaces` (migration `0086_fluffy_joystick`). The migration sets `plan_grandfathered = true` on every workspace that exists, so each keeps what it has today. How long the grandfathering lasts is an open owner decision. The owner sets both on /admin (the workspace card's "Plan" row; `POST /api/admin/workspaces/features` `{action: "plan", workspace_id, plan, grandfathered}`, PIN only, counted as `ws_action` `features` / `plan`).

**One mapping.** `PLAN_FEATURES` in `lib/workspace-features.ts` lists each plan's features: premium is every feature; free is every feature not in the premium set. Premium today:

- `garrison`, `insights` (the owner's examples);
- `notice_translate`, `notice_improve`, `notice_fit`, `thanks_draft`, `discord_translate_me`, `discord_translate_everyone` (the model);
- `ocr` (our server reads each screenshot);
- `squads`, `shield_check` (tracker calls on the alliance's key).

Never premium: privacy, safety, export and workspace deletion, the members' board, Discord sending of what officers write (notices, Send to LAPTracker, the alliance's line on our posts), the Shield-up reminder post, and anything members need. The panel's split per feature is in `docs/handoff/feat-788-plans.md`.

**In the owner's layer.** `planLocked` gives the features a workspace's plan leaves out: none for the own alliance (OGs, `OWN_ALLIANCE_ID`), none for a grandfathered workspace, else what its plan does not cover. `storedSettings` adds them as `locked`, and `allowed(settings, f)` (the owner allows it and the plan covers it) is what `resolveFeatures`, the desk's Features list and its switch read. So a premium feature on the free plan behaves exactly as one the owner did not allow (D126, D134): it is off, its tab, button and Discord command go away, its address goes to Home, and its routes refuse it (`403 not_allowed` for the alliance's switch).

- **Nothing is deleted.** A plan change touches only the two columns. The owner's and the alliance's own switches stay stored, so a later premium plan or grandfathering shows everything as it was.
- A plan change re-registers the Discord commands of a server that had them (D129), as a switch does.
- /admin's switches keep showing the owner's own value; one the plan leaves out says "not in its plan".

**On the desk (officers only).** In Alliance settings → Features, a feature the plan leaves out is listed in its group with its name, a "Premium" tag and one line ("Part of the Premium plan. Nothing your alliance saved is lost."), with a link to the Plans page. Nothing is on hover; links are 44 px. Alliance settings → Plans (`/w/[slug]/settings/plans`) says the alliance's plan, what each plan covers (read from `PLAN_FEATURES`, so it cannot differ from what is enforced) and why, and that changing plans deletes nothing. English, Português and Français.

- **No price and no payment.** `PlanPaymentSlot` is the place for a payment link (copy key `plans.payment`); it renders nothing while the page's link is null.
- **Members never see plan words.** The Plans page sends a member's session to the board (D105). The board shows no plan text, and a premium feature is hidden from members as an owner-off one is (D126 amendment, issue 483).
