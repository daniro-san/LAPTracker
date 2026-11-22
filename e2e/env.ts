// The e2e suite's ports, database and server environment (issue 477). Every value is a placeholder: Discord's
// API and PostHog point at 127.0.0.1:9, where nothing answers; the tracker, Groq and the filler workspaces'
// notice webhooks reach the stub (e2e/stub-server.mjs), which answers only a workspace key's test, Translate
// and a webhook post; the notification webhooks and push are left unset. Every key of .env.example the app
// reads is set here, empty when unused, because Next does not let .env.local override a variable already set.
import { FILLERS } from "./fixtures/seed-people";

export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3477);
export const BRIDGE_PORT = Number(process.env.E2E_BRIDGE_PORT ?? 54377);
// localhost, not 127.0.0.1: Chromium keeps the session's Secure __Host- cookie for localhost only, and the
// app checks a write's Origin against its own origin, which `next start` names localhost.
export const BASE_URL = `http://localhost:${APP_PORT}`;
/** The `iphone` project's server (e2e/https-server.mjs): WebKit on Linux sends a Secure cookie over https only. */
export const HTTPS_PORT = Number(process.env.E2E_HTTPS_PORT ?? 3478);
export const HTTPS_BASE_URL = `https://localhost:${HTTPS_PORT}`;

/** A local Postgres; the global setup drops and recreates this database, so its name must contain "e2e". */
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://lap:lap@127.0.0.1:54320/lap_e2e";

/**
 * Where the server's no-network preload writes each host it refused (e2e/no-network.mjs). Outside
 * test-results/, which Playwright empties after the config loads; the config deletes this file before the
 * servers start, and the preload makes it on the first refusal.
 */
export const OUTBOUND_LOG = "e2e-outbound.log";

const NOWHERE = "http://127.0.0.1:9";

/** The stub for the tracker, Groq and Discord's webhooks (e2e/stub-server.mjs). */
export const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 3479);
export const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;

/**
 * Each filler workspace's leadership notice channel (D102), in WORKSPACE_DISCORD_WEBHOOKS: the notice flow
 * posts on the repeat's own filler workspace, and the stub keeps what each webhook got under its own path.
 */
export const NOTICE_CHANNELS = Object.fromEntries(
  FILLERS.map((f, n) => {
    const slug = f.tag.toLowerCase();
    const url = `https://discord.com/api/webhooks/7000000000000090${n}/e2e-stub-webhook-token-${slug}`;
    return [slug, { url, name: `${slug}-leaders` }];
  }),
);

export const SERVER_ENV: Record<string, string> = {
  LAP_API_KEY: "lap_e2e-placeholder",
  LAP_API_BASE_URL: `${STUB_URL}/v1`,
  LAP_SITE_BASE_URL: `${NOWHERE}/api`,
  DISCORD_API_BASE_URL: `${NOWHERE}/discord`,
  POSTHOG_API_BASE_URL: `${NOWHERE}/posthog`,
  DATABASE_URL,
  DATABASE_URL_UNPOOLED: "",
  DB_LOCAL_BRIDGE_PORT: String(BRIDGE_PORT),
  CRON_SECRET: "e2e-placeholder-cron-secret-not-a-real-one",
  EDIT_PIN: "e2e-pin",
  SERVER_TZ: "Etc/GMT+2",
  EVENT_WEEKDAY: "6",
  EVENT_TIME: "12:00",
  SNAPSHOT_BEFORE: "10:00",
  SNAPSHOT_AFTER: "14:00",
  SNAPSHOT_WINDOW_MIN: "45",
  QUOTA_CHECK_AT: "fri 20:00",
  REHEARSAL_AT: "",
  REHEARSAL_KEEP: "",
  SAMPLE_EVERY_MIN: "",
  DAILY_ROSTER_AT: "",
  NOTIFY_WEBHOOK_PUBLIC: "",
  NOTIFY_WEBHOOK_ADMIN: "",
  NOTIFY_ADMIN_MENTION: "",
  DISCORD_CLIENT_ID: "",
  DISCORD_CLIENT_SECRET: "",
  DISCORD_PUBLIC_KEY: "",
  DISCORD_BOT_TOKEN: "",
  VERCEL_ENV: "",
  POSTHOG_KEY: "",
  POSTHOG_PERSONAL_API_KEY: "",
  POSTHOG_QUERY_API_KEY: "",
  // The KvK matchup (D152) is on, so its section is tested; no other flag is.
  LOCAL_FLAGS: "kvk-matchup",
  GROQ_API_KEY: "gsk_e2e-placeholder-not-a-real-key",
  WORKSPACE_DISCORD_WEBHOOKS: JSON.stringify(
    Object.fromEntries(
      Object.entries(NOTICE_CHANNELS).map(([slug, leaders]) => [slug, { leaders }]),
    ),
  ),
  // 32 bytes, base64, as `openssl rand -base64 32` writes one: it seals the workspaces' own tracker keys.
  WORKSPACE_KEYS_SECRET: Buffer.alloc(32, 7).toString("base64"),
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  LAP_LIVE_TEST: "",
  NEXT_PUBLIC_BLANK_COPY: "",
  NEXT_TELEMETRY_DISABLED: "1",
  E2E_OUTBOUND_LOG: OUTBOUND_LOG,
  E2E_STUB_URL: STUB_URL,
};
