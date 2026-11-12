// The /admin page gate (plan Phase 4): a session cookie set by POST /api/admin/session after
// `authorize` accepted the PIN. Its value is `<issued at, ms>.<HMAC of the PIN and that time>`, so the
// server tells a valid session from one whose PIN changed (EDIT_PIN or CRON_SECRET) and from one older
// than SESSION_MS (D3 amendment, owner 2026-11-12: 7 days). "Log out" deletes it (DELETE on the same
// route). The gate hides data; the PIN and the rate limit remain the control.
import { createHmac } from "node:crypto";

import { cookies } from "next/headers";

import { secretEquals } from "./auth";
import type { Env } from "./env";
import { getEnv } from "./env";

export const ADMIN_COOKIE = "lap_admin";
/** How long a session lasts after the PIN was entered. */
export const SESSION_MS = 7 * 24 * 60 * 60_000;
/** Server instances' clocks may differ a little: a cookie issued this far "ahead" still counts. */
const CLOCK_SKEW_MS = 60_000;

type Secrets = Pick<Env, "EDIT_PIN" | "CRON_SECRET">;

const sign = (env: Secrets, issued: string) =>
  createHmac("sha256", env.CRON_SECRET).update(`admin:${env.EDIT_PIN}:${issued}`).digest("hex");

export function adminToken(env: Secrets, issuedAt: Date): string {
  const issued = String(issuedAt.getTime());
  return `${issued}.${sign(env, issued)}`;
}

/**
 * none: no cookie. valid: it opens the pages. changed: signed for another PIN (or CRON_SECRET).
 * expired: older than SESSION_MS, or in the format before sessions expired.
 */
export type AdminSession = "none" | "valid" | "changed" | "expired";

export function sessionState(given: string | undefined, env: Secrets, now: Date): AdminSession {
  if (given === undefined) return "none";
  const [issued = "", mac = ""] = given.split(".");
  if (!/^\d{1,15}$/.test(issued)) return "expired";
  if (!secretEquals(mac, sign(env, issued))) return "changed";
  const age = now.getTime() - Number(issued);
  return age > -CLOCK_SKEW_MS && age < SESSION_MS ? "valid" : "expired";
}

export async function adminSession(): Promise<AdminSession> {
  return sessionState((await cookies()).get(ADMIN_COOKIE)?.value, getEnv(), new Date());
}

export async function isAdmin(): Promise<boolean> {
  return (await adminSession()) === "valid";
}
