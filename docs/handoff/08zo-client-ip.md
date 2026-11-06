# 08zo — Client IP verified on Vercel (issue #119)

Branch `session/08zo-client-ip`, cut from `origin/dev` at `0678e78`. Authority: the owner's decision comment on #119 (2026-11-05), which allowed exactly two no-PIN probe requests to production and one read-only query on the production `auth_attempts` table.

## Built

- `docs/DECISIONS.md` **D42**: Vercel overwrites `x-real-ip` and `x-forwarded-for`; the docs quote, the probe, the query result and the rule. It supersedes the D20 "Client IP" bullet.
- `lib/auth.ts`: the comment above `clientIp` now says the headers are edge-set and verified (D42). No code change: the headers proved not spoofable, so the owner's decision limits the change to the comment and D42.

## Decisions

- Production database identified through the Neon MCP, not `.env.local` (which points at the `preview` branch): project `flat-dew-50243708`, branch `main` (`br-icy-sky-bbipw44y`), the default branch, whose restricted actions read "vercel production branch". The other branch is `preview`.
- D20 was not edited; D42 states that it supersedes the bullet, the same way D21 superseded parts of D20.

## Deviations

None. Exactly the two allowed requests and the one allowed `SELECT` were made. No PIN, no `Authorization`, no upstream call, no `GET /api/quota`, no write.

## Verified

**Vercel documentation** (https://vercel.com/docs/headers/request-headers, page dated 2025-12-13, read 2026-11-06):
- `x-forwarded-for`: "The public IP address of the client that made the request." and "If you are trying to use Vercel behind a proxy, we currently overwrite the X-Forwarded-For header and do not forward external IPs. This restriction is in place to prevent IP spoofing." A custom `X-Forwarded-For` needs a trusted proxy, "available on Enterprise plans".
- `x-vercel-forwarded-for`: "This header is identical to the x-forwarded-for header. However, x-forwarded-for could be overwritten if you're using a proxy on top of Vercel."
- `x-real-ip`: "This header is identical to the x-forwarded-for header."

**Probe** (2026-11-06 02:45:36 UTC = Fri 00:45 server, before the 18:00 cutoff, no rehearsal pending):

| Request | Forged header | HTTP |
|---|---|---|
| `POST https://laptracker-inky.vercel.app/api/snapshot`, no `Authorization`, no `x-edit-pin` | `x-real-ip: 203.0.113.77` | 401 |
| same | `x-forwarded-for: 203.0.113.78` | 401 |

**Query** on the production branch: `select key, count, window_start from auth_attempts where key like 'ip:%'` → one row, key shape `ip:<IPv4>` (the caller's real address, not printed), `count` 2, `window_start` 2026-11-06 02:45:36.503 UTC. No `ip:203.0.113.77`, no `ip:203.0.113.78`. Both forged values were replaced by the real address and both requests counted against that one row. **Not spoofable.** The row expires after 15 minutes.

**Gates:** `pnpm check` (prettier, eslint, tsc, vitest, drift, i18n) → exit 0; `prettier --check` on the three changed files after the handoff was written → clean.

## Open issues

- Follow-up, report only (from the owner's comment): when neither header is present, every caller shares the key `ip:unknown` (`lib/auth.ts`, `clientIp`). On Vercel the headers are always set (D42), so this matters only off Vercel (local `next start`, tests).
- Preview deployments were not probed (Vercel Authentication in front); D42 holds for production.
- If a proxy is ever put in front of Vercel (Cloudflare, an Enterprise trusted proxy), the per-IP key must be checked again.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. Nothing in the cron path, collector or quota code changed; this PR is a comment and a decision entry.
Owner must do first: merge this PR into `dev`. No migration, no environment variable, no release needed (no runtime change).
Plan changes needed: §10b "§12.2 client IP (05, N10)" still says "unverified … Session 8 checks"; it is now settled by D42 (headers edge-set, per-IP limit holds). Owner's call whether to update that line.

<adjustments>
- The per-IP PIN limit is verified on production (D42): a forged `x-real-ip` or `x-forwarded-for` does not change the `auth_attempts` key. Nothing to check about client IPs in the dry run.
- The production database is Neon project `flat-dew-50243708`, branch `main` (`br-icy-sky-bbipw44y`); `.env.local` points at the `preview` branch. Read production numbers for step 2 through the Neon MCP on that branch.
</adjustments>
