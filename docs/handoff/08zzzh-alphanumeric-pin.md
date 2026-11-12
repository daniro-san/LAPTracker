# 08zzzh — Alphanumeric PIN (production outage fix)

## Incident, 2026-11-12
- The owner set a new production `EDIT_PIN` on purpose: 8 characters with letters and digits, from `openssl`. Vercel applies an env change on the next deployment.
- The v4.2.1 release (PR 243, 14:50 UTC) was that next deployment. Every request on it failed at start-up with `Invalid environment: EDIT_PIN: expected 6-8 digits` (`lib/env.ts`), so `/`, `/admin` and `/players` answered 500.
- Found in the Vercel runtime logs (`vercel logs -e production --since 30m`). The code diff v4.2.0..v4.2.1 does not touch `lib/env.ts`.
- With the owner's approval: `vercel rollback` to `laptracker-f4lbjd9bb` (v4.2.0, its env snapshot has the old PIN) at about 14:55 UTC. `/`, `/admin` and `/players` answered 200 right after.

## Built
- `lib/env.ts`: `EDIT_PIN` is 6–64 visible ASCII characters, no spaces (`/^[\x21-\x7E]{6,64}$/`).
  - The minimum stays 6, the limiter math's assumption (plan §12.2).
  - ASCII keeps it valid in the `x-edit-pin` header.
  - Symbols are allowed because `openssl rand -base64` output can hold `+`, `/` and `=`; a letters-and-digits rule could fail the same way again.
  - A PIN of 6–8 digits stays valid.
- `app/_ui/admin/PinSheet.tsx`: the PIN field has no `inputMode="numeric"` and no `pattern="[0-9]*"`, which would have blocked letters. It has `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` and `maxLength={64}`. It is still `type="password"`.
- Docs: D3 amendment (the incident and the new rule); `docs/PREREQUISITES.md` `EDIT_PIN` row.

## Decisions
- Server-side, the PIN is only compared through SHA-256 (`secretEquals`) and HMAC'd into the admin cookie (`adminToken`). So the character set matters only in the env check and the field.
- `docs/IMPLEMENTATION_PLAN.md` still says "6–8 digits" in §3.3 / §12.2. Not edited (CLAUDE.md); see Next.

## Deviations
- No committed test (CLAUDE.md: not asked). The existing `env.test.ts` still passes.

## Verified
- Temporary `envSchema.shape.EDIT_PIN` test (passed, deleted):
  - accepts `123456`, `12345678`, `aB3x9Kq2`, `Ab+/9=xY` and 64 × `x`;
  - rejects `12`, `abc12`, `abc def1`, `pässwörd`, 65 × `x` and a value with a tab.
- `next dev` with `EDIT_PIN='Tq7+xZ/9'` set on the process only (`.env.local` unchanged): `GET /` returned 200, and the log had no `Invalid environment` line.
- Chrome 360 px on that server (playwright-core + system Chrome): the field has no `inputmode` and no `pattern`, `maxlength` 64, `autocapitalize` none. Typing `Tq7+xZ/9` and pressing Unlock unlocked `/admin`, with the nav and the "Idle" candle visible after reload.
- `pnpm check`: prettier, eslint, typecheck, 254 tests passed (1 skipped), drift check "No schema changes", i18n "17 languages up to date".
- Production after the rollback: `/`, `/admin` and `/players` returned 200.

## Open issues
- The "✗ App error on /admin: render Error · digest 1436170108" admin message of 14:36 UTC has no line in the production or preview runtime logs searched at 14:50–14:52 UTC. Its cause is unknown. Vercel Hobby keeps runtime logs only for a short window (a query from 07:00 UTC was refused: "does not retain runtime logs for the requested time range").
- Production now serves v4.2.0. It does not have PR 242 (live candle) until the next release is live.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. The fix passed every check on the first run.
Owner must do first:
1. Merge this PR into `dev`.
2. Release a patch (Actions → Prepare release, patch → v4.2.2; it carries PR 242 and this one) and merge the release PR. Keep the new alphanumeric `EDIT_PIN` in Vercel.
3. After the rollback, Vercel may not move the production domain to new deployments by itself. If the site still serves v4.2.0 after the release (Vercel dashboard → Deployments: the production badge stays on `laptracker-f4lbjd9bb`), promote the v4.2.2 deployment: dashboard → Promote, or `vercel promote <url>`.
4. Then unlock `/admin` with the new PIN.
Plan changes needed: `docs/IMPLEMENTATION_PLAN.md` §3.3 and §12.2 say the PIN is "6–8 digits"; they should say 6–64 visible ASCII characters (D3 amendment).

<adjustments>
- `EDIT_PIN` is 6–64 visible ASCII characters (D3 amendment), not 6–8 digits. Tests and fixtures that build an env can keep digit PINs.
- A production env change only takes effect on the next deployment, and a value `lib/env.ts` rejects takes the whole site down on that deployment. Before changing a production env value, check it against `envSchema`.
</adjustments>
