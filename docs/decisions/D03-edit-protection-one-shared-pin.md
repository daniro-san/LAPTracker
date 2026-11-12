## D3 — Edit protection: one shared PIN (2026-11-04, plan §3.3, §12.2)

The only write action exposed to people is "Run snapshot now", gated by `EDIT_PIN` (6–8 digits), compared with `timingSafeEqual` and rate-limited in Postgres (5 per IP per 15 min, 20 global per hour disables PIN auth only). This isn't real auth, and it's proportional to a guild tool whose worst case is a wasted run.

**Amendment (owner, 2026-11-12).** `EDIT_PIN` may hold letters and symbols: 6–64 visible ASCII characters, no spaces (`lib/env.ts`). The owner set an 8-character value from `openssl`, and the digits-only rule made every request of the v4.2.1 deployment fail at start-up (`Invalid environment: EDIT_PIN`); production was rolled back to v4.2.0. The minimum stays 6, the limiter math's assumption (plan §12.2). ASCII keeps the value valid in the `x-edit-pin` header. The PIN field on `/admin` is a plain password field: no numeric keyboard, no `pattern`, no auto-capitalisation or autocorrect, up to 64 characters. A PIN of 6–8 digits stays valid.

**Amendment (owner, 2026-11-12): a changed PIN logs everyone out.** The session cookie is an HMAC of `EDIT_PIN`, so it stops opening the pages on the first deployment with a new PIN. There is no automatic renewal: renewing without the new PIN would let in whoever knows only the old one. On top of that:

- `/admin` pages refresh by themselves (20 s while idle). They then show the PIN card with "The admin PIN has changed. Enter the new PIN to see this page." (`hasStaleAdminCookie`, `lib/admin-session.ts`).
- The card deletes the old cookie (`DELETE /api/admin/session`: `Max-Age=0`, no PIN needed, it only clears this browser's cookie). It also drops the PIN the tab saved for the action buttons.
- An action answered 401 drops the saved PIN too, so a stale PIN is never sent again and does not use up the limiter's attempts.
