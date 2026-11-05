// The /admin page gate (plan Phase 4): a session cookie (no Max-Age: it ends with the browser
// session) holding an HMAC of the PIN, set by POST /api/admin/session after `authorize` accepted the
// PIN. Changing EDIT_PIN or CRON_SECRET invalidates every cookie. The gate hides data; the PIN and
// the rate limit remain the control (obscurity is hygiene, not security).
import { createHmac } from "node:crypto";

import { cookies } from "next/headers";

import { secretEquals } from "./auth";
import type { Env } from "./env";
import { getEnv } from "./env";

export const ADMIN_COOKIE = "lap_admin";

export function adminToken(env: Pick<Env, "EDIT_PIN" | "CRON_SECRET">): string {
  return createHmac("sha256", env.CRON_SECRET).update(`admin:${env.EDIT_PIN}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const given = (await cookies()).get(ADMIN_COOKIE)?.value;
  return given !== undefined && secretEquals(given, adminToken(getEnv()));
}
