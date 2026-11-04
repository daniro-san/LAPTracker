// Route auth (plan §3.3, §12.2): Bearer CRON_SECRET or x-edit-pin, compared in constant time, with
// the rate limiter's state in Postgres (auth_attempts). Nothing is kept in module scope: every
// serverless instance has its own, so an in-memory count would be a limit per instance.
import { createHash, timingSafeEqual } from "node:crypto";

import type { AppContext } from "./app-context";
import type { Db } from "./db";
import { createNotifier } from "./notify";
import { currentCount, recordFailure, resetKey } from "./repo/auth-attempts";

export const IP_LIMIT = 5;
export const IP_WINDOW_MS = 15 * 60_000;
export const GLOBAL_LIMIT = 20;
export const GLOBAL_WINDOW_MS = 60 * 60_000;
const GLOBAL_KEY = "global";

export type AuthResult =
  | { ok: true; via: "cron" | "pin" }
  | { ok: false; status: 401 | 429; code: "unauthorized" | "rate_limited" | "pin_locked" };

/** Hashing first makes both sides 32 bytes, so neither the length nor the content leaks timing. */
export function secretEquals(given: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Vercel sets x-real-ip / x-forwarded-for at its edge. Unverified in Session 4 (vercel.com was not
 * reachable); if a client could set them, only the per-IP limit weakens, not the global lockout.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const unauthorized = { ok: false, status: 401, code: "unauthorized" } as const;
const rateLimited = { ok: false, status: 429, code: "rate_limited" } as const;

async function failIp(db: Db, ipKey: string, now: Date): Promise<AuthResult> {
  const count = await recordFailure(db, ipKey, IP_WINDOW_MS, now);
  return count > IP_LIMIT ? rateLimited : unauthorized;
}

export async function authorize(
  headers: Headers,
  db: Db,
  ctx: AppContext,
  options: { allowPin: boolean },
): Promise<AuthResult> {
  const now = ctx.now();
  const ipKey = `ip:${clientIp(headers)}`;
  const bearer = /^Bearer (.+)$/.exec(headers.get("authorization") ?? "")?.[1];
  if (bearer !== undefined) {
    // INVARIANT auth.cron-never-locked-out: the scheduler's secret is checked before any limit.
    if (secretEquals(bearer, ctx.env.CRON_SECRET)) return { ok: true, via: "cron" };
    return failIp(db, ipKey, now);
  }
  const pin = options.allowPin ? headers.get("x-edit-pin") : null;
  if (pin === null) return failIp(db, ipKey, now);

  // INVARIANT auth.pin-rate-limit: 5 per IP per 15 min; 20 from anyone per hour disables PIN auth.
  if ((await currentCount(db, ipKey, IP_WINDOW_MS, now)) >= IP_LIMIT) return rateLimited;
  if ((await currentCount(db, GLOBAL_KEY, GLOBAL_WINDOW_MS, now)) >= GLOBAL_LIMIT) {
    return { ok: false, status: 429, code: "pin_locked" };
  }
  if (secretEquals(pin, ctx.env.EDIT_PIN)) {
    await resetKey(db, ipKey);
    return { ok: true, via: "pin" };
  }
  await recordFailure(db, ipKey, IP_WINDOW_MS, now);
  const global = await recordFailure(db, GLOBAL_KEY, GLOBAL_WINDOW_MS, now);
  // The upsert returns each count once, so exactly one request sees 20 and sends the alert.
  if (global === GLOBAL_LIMIT) {
    await createNotifier(ctx.env, ctx.fetch).admin(
      `🔒 PIN auth locked: ${GLOBAL_LIMIT} wrong PINs in the last hour. CRON_SECRET and workflow_dispatch still work.`,
    );
  }
  return unauthorized;
}
