# 07h — Player search loading state

Branch `session/07h-search-loading`, cut from `origin/dev` at `2dcd4f0` (#35). Owner request 1 in `07d-ui-fixes.md` Open issues. Mock shown first; owner's answer (2026-11-05): "apply it and hang it for ~300ms".

## Built

- `app/_ui/PlayerSearch.tsx` (new, client): the search form plus the results slot. Submit runs `router.push` inside `useTransition`; if the search is still pending after 300 ms (`HOLD_MS`), the results are replaced by `GrannyLedger` and the line `copy.search.pending` inside a `role="status"` region. Without JavaScript the form is the same plain GET as before. The input is keyed on `q` so Back/Forward show the right term.
- `app/(pages)/players/page.tsx`: the form moved into `PlayerSearch`; the results (no-match line, list, "First 50") are its children.
- `lib/brand/components/Mascot.tsx`: `GrannyLedger` — the Granny Doctor bent over an open ledger with a magnifier; the magnifier path is `data-anim="scan"` with its pivot at the grip (70, 101). 4,032 bytes as rendered.
- `app/globals.css`: keyframe `granny-scan` (rotate 3° → −9°, 1.5 s alternate = one 3 s loop); stopped by the existing `prefers-reduced-motion` rule on `[data-anim]`.
- `lib/copy.ts`: `search.pending` = "Grandma is leafing through the ledger…".
- `docs/brand/drawing/examples/granny.py` `ledger()` + `build.py` entry `granny-ledger`: the drawing's source (3 rounds; same head and placement as `tea()`).
- `lib/brand/components/Mascot.test.ts`: the drawing renders under 4,096 bytes, `aria-hidden`, currentColor only, with the animated part.
- `docs/DESIGN.md`: component `search-pending`; Motion lists the search loop and the 300 ms hold; ornament budget lists the search's pending state.

## Decisions

- `useTransition` + `router.push`, not `loading.tsx` or `useFormStatus`. Reasons: `next/form` calls `router.push` outside a React form action, so `useFormStatus` never reports pending for a GET form; `app/(pages)/players/loading.tsx` would replace the whole page including the header (`SiteHeader` is rendered inside `page.tsx`) and would also wrap `/players/[uid]`.
- The 300 ms hold is a JS timer, not a CSS animation delay: the status text is inserted only when the drawing appears, so a screen reader announces nothing for a quick search. Until the hold ends the old results stay on screen.
- The drawing reuses the Granny Doctor's head from `GrannyTea` at the same scale and position, so the two poses are one character. The full figure would not fit 4 KB; the head alone is 1,845 bytes.

## Deviations

- DESIGN.md Motion said "no shimmer skeletons — a plain 'Loading the ledger…' line". The owner asked for a drawn, animated loading state for search, so Motion now names this one loop; other waits keep the plain line.
- Searches are now client-side navigations (header and field stay) instead of full page loads.

## Verified

All numbers from local production builds (`next start`) against the Neon preview branch via the main checkout's `.env.local`; Chrome 157 through playwright-core.

- Before (`c0794ba`, :3562 in a scratch copy): submit → the old page stays unchanged with no on-screen feedback until the new document arrives; results at 1,656–1,884 ms (Fast 3G + 4× CPU, 3 runs) and 1,527 ms unthrottled. The wait is mostly server time (Neon round trips from this Mac).
- After (:3561): throttled results at 1,540 ms, unthrottled 1,417 ms; screencast shows the drawing from ~340 ms until the results replace it.
- Hold: an instant (replayed) response → results at 58 ms, drawing never shown; a 1.5 s response → drawing appears at 341–419 ms after submit.
- Reduced motion: `animation-name` on `[data-anim="scan"]` = `none`; otherwise `granny-scan 1.5s`.
- axe-core on `/players?q=so` at 360 px, light and dark, both with results and while pending: 0 violations (4 runs).
- `scrollWidth` 360 at 360 px in both modes, results and pending; 1280 at 1280 px.
- Back after two searches restores the field's text; JavaScript disabled: submit → `?q=sol`, 5 results.
- Lighthouse mobile on `/players?q=so`, fresh Chrome per run, 3 runs each (perf / a11y / bp / seo, LCP, weight): before 99–100 / 100 / 100 / 100, 979–1,048 ms, 345–346 KiB; after 99–100 / 100 / 100 / 100, 832–996 ms, 351–352 KiB.
- `pnpm check` on this branch: prettier, eslint, tsc clean; `Test Files 25 passed | 1 skipped (26)`, `Tests 97 passed | 1 skipped (98)`.
- Not verified: the Vercel preview (SSO-only, no share link); Firefox and Safari; a screen reader by ear (only the `role="status"` markup was checked).
- Mock captures (scratchpad, not committed): stills at 360 and 1280 in both modes and the loop as GIFs.

## Open issues

- In production the server may answer in under 300 ms most of the time; then the drawing is rarely seen. That is the intended trade (owner, 2026-11-05).
- The "Players" header link and other links into `/players` are unchanged; only submitting the form shows the pending state.

## Next

Session: 8 — Deploy, GitHub Actions, env, webhooks
Model / effort: keep (sonnet · medium) — no signal from this session about deploy work.
Owner must do first: merge this PR into `dev`; PREREQUISITES.md §6 row "Session 8".
Plan changes needed: none.

<adjustments>
- `/players` search is now a client-side navigation with a 300 ms-delayed pending drawing (`app/_ui/PlayerSearch.tsx`); a smoke check of the deployed search should expect the page header to stay during the search, not a full reload.
</adjustments>
