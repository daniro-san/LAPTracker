# fix — a member card that closes stays closed (Officers' Desk, phone)

Owner's report, 2026-11-21, on a phone: "when I open the member cards, sometimes it doesn't close; it flickers, shows loading and goes back to full size, open."

## Built

One file: `app/(private)/_ui/open-member.ts` (`useOpenMember`, used by Members, Former members and Follow-up).

**Root cause.** Below 1024 px a member opens in the bottom sheet, and the history went wrong in this order:

1. A tap on a row wrote `?m=<uid>` with `replaceState` onto the page's own history entry.
2. The sheet then pushed its own entry (`sheet-close.ts`), which copied that address.
3. Close, the backdrop and Escape removed `?m=` from the sheet's entry only. The sheet then took its entry off with `history.back()`.
4. That back landed on the page's entry, which still had `?m=<uid>`. The `popstate` listener in `useOpenMember` read the member from that address and opened the card again, with "Loading…" while the card was fetched.

What happened next depended on what earlier opens had left in the history:

- **First close after a page load:** the reopened sheet registered its entry before the sheet frame's own `popstate` listener ran. That listener saw one sheet too many and closed it again. On screen: a flicker and "Loading…".
- **Later closes:** the landing entry carried a `lapSheet` mark from earlier, so nothing closed it. The card stayed open, full size.
- **During a `router.refresh()`:** the read status bar (D135) refreshes when a read ends, and the facts editor refreshes when it saves. Next's router read the stale `?m=` on that `popstate`. Six times in Chrome and six in WebKit, it then did a full page load of that address, which opened the card again.

The history trace below is the evidence (Chrome, 390 px, before the fix):

```
tap row:  replaceState ?m=920014 · pushState {lap:1} · dialog OPEN
tap X:    replaceState {lap:1} (no m) · back() · dialog closed
          popstate {NA} ?m=920014 · pushState {lap:1} · dialog OPEN      ← reopened from the old address
          replaceState (no m) · dialog closed                            ← round 1: flicker
round 2:  … popstate {NA, lap:1} ?m=920017 · pushState {lap:1} · dialog OPEN   ← stays open
```

**Fix.** Below 1024 the address follows the open member, never the other way round.

- `show()` and `close()` write the address themselves only from 1024 (the pane, unchanged). Below 1024, a layout effect writes `?m=` after the sheet's own layout effect has pushed its entry, so only the sheet's entry carries `?m=` and the entry under it keeps the list's address.
- On a shared link (`?m=` in the address on load) below 1024, the page's entry loses `?m=` while the page hydrates, before the sheet opens. The sheet's entry gets `?m=` again, so a reload still opens the card.
- Below 1024, `popstate` never opens a member. When nothing is open it removes a stale `?m=`. Back and forward on a sheet stay with the sheet frame (`sheet-close.ts`), as before.
- A window that widens past 1024 with the sheet open keeps the member open in the pane (D122, DESIGN.md "A resize across 1024 moves the open member between the sheet and the pane"). The sheet's step off its entry then writes the member onto the address instead of reading it. `sheetDepth(history.state) > 0` tells that a sheet was open.
- Fewer history calls (the QA MUST):
  - Safari allows 100 `pushState`/`replaceState` calls in 10 s and throws a `SecurityError` after that.
  - `write()` skips a replace that changes nothing.
  - On a close by X, the backdrop or Escape, it no longer writes onto the sheet's entry that `history.back()` is about to drop.
  - It catches the browser's refusal, so its own call never takes the page down from the layout effect.
  - Result: one open/close is 4 history calls (5 in the first version of this fix; 7 before it, counted in the trace below).

Closing is now local and immediate. The sheet closes, `history.back()` lands on the list's address, and nothing reads a member from it. A list close or a shared-link close sends no request to the server (0 RSC requests, measured), and nothing scrolls. The facts editor, the "Discard your changes?" question and the other sheets are not touched.

## Decisions

- **Root cause:** the brief's hypothesis 1 (a refresh re-rendering with the old URL) was not the cause on its own. Closing reopened the card in every condition, refresh or not. A refresh made it worse (the full page load).
  - Hypothesis 2 was close: it was not an effect reading search params, but the `popstate` listener reading `?m=` from the wrong entry.
  - Hypothesis 3 was not observed: every reopen in the trace came from the `popstate` path, none from a click falling through to a row.
  - Hypothesis 4 was the trigger: `history.back()` from the sheet landed on an entry that still had `?m=`.
- **`write()` still passes Next's own history state, so Next's patched `replaceState` passes it through unseen.** Letting Next see the address would dispatch a router `restore` on every open and close. In Next 16.4.5 a `restore` discards a `router.refresh()` that is still running (`app-router-instance.js`, `dispatchAction`). Closing a card right after a facts save could then drop the refresh.
- **`try/catch` around the history call in `write()`.** This is the browser's limit at a system boundary, not a case that cannot happen. Without it, a refused call in the layout effect replaces the whole page with Next's error screen.
- **Test:** no unit test. Vitest runs in the `node` environment with no DOM in this repo. The fix is in a hook whose behaviour depends on React's layout-effect order and the browser's history, so a test would need jsdom, which is a new dependency. The proof is the before-and-after reproduction on a production build (Verified).

## Deviations

- The fix also covers Former members and Follow-up, because they use the same hook (`useOpenMember`).

## Verified

All on a local production build (`next build` + `next start`) with the local database:

- **Data:** an invented 25-member OGs roster (`gen.mjs` from the squad-formation e2e) and an officer session written straight into the database.
- **Browsers:** playwright-core with system Chrome and WebKit, at 390 px with touch on.
- **Calls:** no upstream, Discord or `/api/quota` call.
- **Scripts:** all in the session scratchpad `mcc-e2e/` folder.

**Close matrix (`repro.mjs`):**

- **Setup:** 5 trials per cell. A card opened from the list or from a shared link, closed by X, the backdrop, Escape and back.
- **Conditions:** plain; right after `window.next.router.refresh()`; and during a refresh whose RSC answer is held 1.5 s.
- **Rapid run:** 10 open/close rounds.
- **Failure:** a dialog open 2.5 s after the close, "Loading…" after the close, a full page load, or `?m=` left in the address.

| | Chrome before | Chrome after | WebKit before | WebKit after |
|---|---|---|---|---|
| Trials with a failure | 110 / 121 | 0 / 121 | 116 / 127 (7 trials blocked by a stuck card) | 0 / 121 |
| Card stuck open | 25 | 0 | 25 | 0 |
| Flicker: reopened with "Loading…", then closed | 70 | 0 | 69 | 0 |
| Full page load that reopened the card | 6 | 0 | 6 | 0 |
| `?m=` left in the address after close | 74 | 0 | 80 | 0 |

Before, every X, backdrop and Escape close failed in every condition. The back gesture failed during a refresh and in 1 of 5 plain list trials. "After" is the final build, with the QA MUST fixed. The first version of the fix also scored 0 / 121 in both engines.

**Other checks (`extra.mjs`), Chrome and WebKit after: 14 of 14 passed**

- **Phone, 390 px:**
  - an open card puts `?m=<uid>` in the address;
  - reloading that address opens the same card;
  - X after the reload closes it;
  - back closes the card, and forward after it keeps it closed;
  - with the facts editor over the card, back closes only the editor (the address keeps `?m=`), then X closes the card;
  - `?q=a` survives open and close.
- **Pane, 1280 px:**
  - open b, back to a, back to none, forward to a;
  - Close empties the pane and the address;
  - a shared link opens the pane.
- **Tablet turn, 820 ↔ 1180 px:** the sheet's member moves to the pane and back, then Close closes it.

Before the fix, Chrome stopped at "X after a reload" (the card stayed open), and its pane and turn checks passed.

**Requests (`rsc-count.mjs`).** A close made 0 RSC requests:

- for 3 list closes;
- for 2 shared-link closes;
- for 2 list closes after a shared link.

**Gates:** `pnpm check` passes:

- prettier, eslint and tsc;
- vitest: 286 test files passed (2 skipped), 1,479 tests passed (4 skipped);
- the schema drift check (no schema change);
- i18n: 17 languages up to date.

**QA subagent.** One adversarial QA subagent ran from this session, and its result came back to this session, not to the orchestrator.

- **Scope:** about 630 scripted checks in Chrome and WebKit, at 360 and 390 px, light and dark, EN and PT-BR. It covered:
  - rapid open and close;
  - closing during a refresh;
  - deep links, including bad ones;
  - back and forward, and the nested and dirty facts editor;
  - tablet turns and the 1280 pane;
  - Former members and Follow-up.
- **Result:** the card never reopened after a close and never showed "Loading…" after a close.
- **1 MUST, fixed:** in WebKit, about 16 fast open/close cycles at 0.3 s pauses replaced the page with "This page couldn't load". The cause was Safari's history limit, reached through the layout effect.
- **After the fix, with QA's own `ratelimit.mjs` in WebKit:**
  - 40 cycles at 0.3 s pauses pass for each of X, the backdrop, Escape and back (4 history calls per cycle).
  - At 0.1 s pauses the limit is reached after 25 cycles in 10.7 s, in Next's own `HistoryUpdater` (Open issues).
  - QA's `cycles.mjs` and `rapid.mjs` pass in WebKit at 360 px, and the history length no longer grows.
- **Its SHOULD and NICE findings** come from code this change does not touch. They are listed under Open issues.

## Open issues

- **Next's router does not see the `?m=` writes.** This was true before this change and still is. A `router.refresh()` writes Next's last known address back onto the current entry:
  - **Phone, after a list open:** the address loses `?m=` while the card stays open.
  - **Pane (from 1024):** an entry can be rewritten. Back may then land on a different member than expected.

  Not changed, because telling Next would discard a running refresh (Decisions).
  The refresh also drops the sheet entry's `lapSheet` mark, so a reload after it does not reopen the card. Closing still works (QA SHOULD 2).
- **A reloaded sheet entry keeps its `lapSheet` mark** (`sheet-close.ts`, every sheet). If the page is reloaded while a card is open, the first close steps back one extra entry and makes one background RSC request. It is invisible and the card stays closed.
- **Turning a tablet with the facts editor open over a card** (820 → 1180 px) leaves the Members page (QA SHOULD 3).
  - Both sheets unmount at once, and `sheet-close.ts` steps back once for each and once more for the forward correction.
  - The old code does the same.
  - Even with that fixed, this hook handles only the first `popstate` after widening, so the member would close instead of moving to the pane.
- **Open A, close it, and open B within about 10 ms:** B opens and closes again. A's pending `history.back()` lands after B pushed its entry (`sheet-close.ts`). It failed only with no gap; gaps of 16, 50 and 100 ms passed (QA NICE 4).
- **Safari's history limit at extreme speed.** Next's `HistoryUpdater` writes the history on every router commit, from an insertion effect. Past about 25 open/close cycles in 10 s, that write is refused and the page shows Next's error screen. The old code reached the limit sooner (7 calls per cycle).
  - `useAddress` in `members-list-state.ts` also rewrites the address on every `popstate`, even when nothing changes. Skipping that would make one cycle 3 calls.
- **Shared links to someone not on the list** (`?m=999999`, `?m=-5`) leave `?m=` in the address with no card, until the next open and close. Same as before (QA NICE 5).
- **WebKit: after a close, focus goes to `<body>`, not the row.** Safari does not focus a tapped button, so `Sheet.tsx` has no opener to return focus to. Same as before (QA NICE 6).

## Next

- Model/effort: keep.
- What the owner must do first: nothing. After the merge, on a phone, open and close a few member cards with X, the backdrop and back, including right after saving "Edit info".
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- Anything that keeps an open item in the address below 1024 must write it onto the sheet's own history entry (after the sheet has pushed it), never onto the entry under the sheet. A sheet's close takes its entry off with `history.back()`, and whatever the entry under it says is read again.
</adjustments>

PR: (added by the orchestrator)
