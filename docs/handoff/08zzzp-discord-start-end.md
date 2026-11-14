# 08zzzp — Discord says Start and End

## Built
- The public Discord message and its event picture name the Before and the After the way the event pages have since issue 180 (08zzm): `Start` and `End`, not `Before` and `After`.
  - Message line (on the After's edit): `Before snapshot done at Sat, Nov 14, 10:47 server time` → `Start Sat, Nov 14, 10:47 server time`.
  - Picture subtitle after the After: `Sat, Nov 14 · Before 10:47 · After 15:11` → `Sat, Nov 14 · Start 10:47 · End 15:11`.
  - Picture subtitle after the Before: `… · Before 10:47 · After due 15:00` → `… · Start 10:47 · End due 15:00`.
- `lib/copy-discord.ts`: `public.beforeDone` → `public.start`; `image.before` / `after` / `afterDue` → `image.start` / `end` / `endDue`. Call sites in `lib/notify.ts` and `lib/event-image.tsx`.
- `lib/notify-event-message.test.ts`: the pinned line now reads `Start …`.
- D58: the quoted line updated, plus one dated bullet recording the change.

## Decisions
- Admin messages keep `Before snapshot` / `After snapshot`: they use /admin's words (`copy.admin.phase`), and /admin still says Before and After.
- The text line is `Start {time}` with no "done at", the same label-then-value shape as the page's `START 10:47 → END 15:11` line. The title above it (`✓ Last updated at …`) already gives the After's time, so no `End` line was added to the text.
- The keys were renamed with the words so a key named `before` does not hold "Start".

## Deviations
- None.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (261 passed, 1 skipped), drift, i18n (17 languages up to date; Discord copy is English only, D48).
- Rendered both pictures with `renderEventImage` from a throwaway script (not committed, no network, no database): the After's reads `Sat, Nov 14 · Start 10:47 · End 15:11`, the Before's `Sat, Nov 14 · Start 10:47 · End due 15:00`. Both fit on one line.
- No Discord message was sent.

## Open issues
- Today's (2026-11-14) KvK message stays as posted, with Before/After (owner: no need to edit it). The next event's message is the first with Start/End.
- `lib/copy.ts` `compare.lead` (public) still says "from Before to After". Not changed here; the owner can say whether it should read "from Start to End".

## Next
Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` and release (patch).
Plan changes needed: none.

<adjustments>
- Discord copy keys for the capture window are `copy.discord.public.start` and `copy.discord.image.start` / `end` / `endDue`; `beforeDone`, `image.before`, `image.after` and `image.afterDue` no longer exist.
</adjustments>
