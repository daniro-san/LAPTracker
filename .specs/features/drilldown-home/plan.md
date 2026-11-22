# Drilldown batch C: Home and the status bar

**Approved**: 2026-11-22 - user: "look at every insight on the workspace and public pages, and wherever a drilldown layer would help (tap a count, see exactly those people), build it" (owner, 2026-11-22, as the task prompt quotes it); the drilldown spike's persona panel recommended D7, D8 and D9. Plan check: [Validation](#validation).

Size: M (a count on every desk page changes its set and links to Raid prep, a flow across two screens; amendments to D104, D108, D135 and D137). One PR, `feat/drilldown-home`. Part of issue 678.

## Problem

- **D8.** Home's Recent activity says "Rook added 3 new members". Its fold opens one sentence per add, in time order ("Rook added Wren as a new member · 2 hours ago"), so the names are there but buried in repeated words.
- **D9.** The status bar's "Raid Shield check 23:42 ST · 61 of 92 seen with a shield" counts the whole day roster (`dayRosterUids`), away members included. Raid prep leaves away members out of its grid, so the two numbers disagree, and the line does not lead to Raid prep.
- **D7.** Home's Follow-up card is one link to Follow-up. "4 already noted by officers" does not open the card "Noted this week" (`#follow-up-noted`) that lists those 4.

## Shape

No new query, route, table or dependency.

1. **D8.** `activityView` gives a new-members run its names, `names` (the item's own `names`, in the officer's language's name order). The feed's fold shows them as a name list in two columns instead of the run's sentences. Count and list are one array: `item.names`. The names are typed by officers (`pending_members`, D106) and have no uid in the feed's read, so they are plain text, not links.
2. **D9.** `shieldStatus` counts Raid prep's set: the alliance's roster with the members away on the raid's Saturday left out, `membersOfRaid` (`lib/shield-post.ts`), the function the Discord summary and the officers' notification already share. Raid prep's grid leaves out the same members by the same rule (`awayOn` on the roll call's day, which is the raid's Saturday for the week's Raid prep). Running: "Checking Raid Shields · {read} of {members} · started {at} ST"; done: "Raid Shield check {at} ST · {on} of {members} seen with a shield"; each adds " · {n} away" when n > 0. The line carries the Raid prep link that the officers' notification already uses (`raidPrepUrl`, `lib/push-uses.ts`, now exported); the bar shows "Raid prep ›" beside itself.
3. **D7.** Home's Follow-up card: the head ("12 members to look at this week ›") links to Follow-up, and under it "4 already noted by officers ›" links to `/follow-up#follow-up-noted`. Both are 44 px rows.
4. **Analytics.** `ws_drilldown_opened` gains `surface: home` with `kind` `new_members` (a new-members fold opened) and `noted` (the noted link tapped), and `surface: status_bar` with `kind` `shield` ("Raid prep ›" tapped). Once per kind per page view, `count_bucket` only.

## Landing

None hard to reverse: copy, one exported function, client view state. No stored shape changes.

## Criteria

### D8: a new-members run shows its names (P1)

1. WHEN a Recent activity line says "{who} added {n} new members" THEN its fold SHALL list exactly those n names, in the officer's language's name order, with nothing beside a name (D75).
2. The line's n and the listed names SHALL come from one array (`item.names`).
3. WHEN the officer opens such a fold THEN the page SHALL send `ws_drilldown_opened` `{surface: home, kind: new_members, count_bucket}` once per page view.
4. Other runs ("updated 9 members", entries, notices) SHALL keep their sentences.

### D9: the status bar's shield count is Raid prep's set, and leads to Raid prep (P1)

1. The shield line's `members` SHALL be the roster's members not away on the raid's Saturday, and `on` / `read` SHALL count only readings of those members (`membersOfRaid`).
2. WHEN members are away THEN the line SHALL end with " · {n} away" ("· {n} ausente(s)", "· {n} absent(s)").
3. On the same data, the done line's on and members SHALL equal Raid prep's grid: the asked members not away, and of them those whose newest reading saw a shield. A PGlite test checks it.
4. WHILE the shield line is shown THEN the bar SHALL show a bordered "Raid prep ›" ("Preparação do raid ›", "Préparation du raid ›") beside itself, open or closed, at least 44 px, to the week's Raid prep (the KvK Calendar entry's, else the week's own, else the week's Roll call page), and a tap SHALL send `ws_drilldown_opened` `{surface: status_bar, kind: shield, count_bucket}` (the bucket of `on`).
5. Counts and server times only: no uid or name in the line (D71, D135).

### D7: "n already noted" opens Noted this week (P2)

1. WHEN noted > 0 THEN "{n} already noted by officers ›" SHALL be its own 44 px link, on its own row under the head, to `/w/{slug}/follow-up#follow-up-noted`; the head SHALL keep its link to Follow-up.
2. The n SHALL stay `followUpCounts`' `noted`, which comes from `weekLists`, the function the Noted card's list comes from.
3. A tap SHALL send `ws_drilldown_opened` `{surface: home, kind: noted, count_bucket}`.

## Tests

- PGlite (`lib/private/desk-activity-feed.test.ts`): three new members added by one officer give one line whose `names` are the three, in name order, and whose text says 3 (D8.1, D8.2).
- PGlite (`lib/private/shield-status.test.ts`): with one member away on the raid's Saturday, the done line counts the others and says "· 1 away"; on the same data, Raid prep's grid (`callRead` + `prepView`) gives the same on and members (D9.1–D9.3).
- Render (`HomeMembers.test.ts`): the noted part links to `#follow-up-noted` (D7.1).
- E2E (`e2e/`): the Home flow's activity fold shows the seed's new members' names; the existing status-bar and Home assertions are updated where the words change.
- Each test is broken once on purpose to see it fail.

## Out of scope

- D6 (Alliance Help names), waiting for the owner.
- "updated n members": a list needs a new read.
- Links from new members' names to their cards: the feed's read has no uid for them (follow-up).
- Raid prep's own answer line ("86 of 97 seen at the morning check · 3 not read yet") still counts away members (D137, PR 691 D3).

## Validation

Persona check, 2026-11-22, on invented wireframes at 360 px (an R4 in a hurry who reads English as a second language; an officer in her 50s who wants visible labels; an adversarial reviewer for D75 and list = count).

- **D8: adopt.** Both officers wanted the names, not three repeated sentences; the line above keeps who added them. Must-fix adopted: names wrap in full, never cut. Links to the cards stay a follow-up. Adversarial: list = count holds because both are `item.names`; nothing names anyone for not doing something.
- **D9: adopt with change.** "· 3 away" was read as the explanation of 92 vs 89 by both officers and is a count only (D75). Change adopted: the link is not hidden in the open bar (neither officer would have opened the bar to navigate). It is a bordered 44 px chip "Raid prep ›" beside the bar, open or closed (criterion D9.4 reads so). Must-fix adopted: the running line's denominator leaves away members out too.
- **D7: adopt with change.** Two links on one line were a mis-tap risk at 360 px. Change adopted: two stacked 44 px rows, each with "›". The adversarial question (are the 4 inside the 12?) is settled by the existing words: D104 chose "already noted" for members taken off the list, and the Noted card's count is its list's length.

One-way doors: none. No stored shape, route, private field, quota or dependency changes.
