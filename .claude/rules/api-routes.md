---
paths:
  - "app/api/**"
---

# API route handlers

Shape: auth → parse (zod) → call lib → respond. No domain logic in a handler (docs/ARCHITECTURE.md).

- Auth: `Authorization: Bearer <CRON_SECRET>` or `x-edit-pin`, compared with `crypto.timingSafeEqual` (equal-length buffers), never `===`. Failed attempts go through the Postgres rate limiter (`auth_attempts`, plan §12.2). The global lockout disables PIN auth only, never the cron secret.
- Parse every body and query string with zod; reject unknown fields.
- Responses never carry stack traces, `err.message` from third parties, secrets or the §12.1 blocked roster keys. Read routes return only lib/queries read models.
- Long runs: `export const maxDuration = 120`. Anything the run must record (snapshot status, run lock release) happens in `finally`.
- Never log secrets: everything the logger receives goes through lib/redact.ts; don't `console.log` request headers.
- Write routes take the run lock: 409 when a snapshot for the same (event, phase) is `running` and started < 10 min ago. The lock is a conditional update or unique constraint, never read-then-write.
