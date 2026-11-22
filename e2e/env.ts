// The e2e suite's ports, database and server environment (issue 477). Every value is a placeholder: the
// upstream API, Discord and PostHog point at 127.0.0.1:9, where nothing answers, and Groq, webhooks, the
// tracker keys and push are left unset, so the server has nothing to call. Every key of .env.example the app
// reads is set here, empty when unused, because Next does not let .env.local override a variable already set.

export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3477);
export const BRIDGE_PORT = Number(process.env.E2E_BRIDGE_PORT ?? 54377);
// localhost, not 127.0.0.1: browsers keep the session's Secure __Host- cookie for localhost only, and the
// app checks a write's Origin against its own origin, which `next start` names localhost.
export const BASE_URL = `http://localhost:${APP_PORT}`;

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

export const SERVER_ENV: Record<string, string> = {
  LAP_API_KEY: "lap_e2e-placeholder",
  LAP_API_BASE_URL: `${NOWHERE}/v1`,
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
  LOCAL_FLAGS: "",
  GROQ_API_KEY: "",
  WORKSPACE_DISCORD_WEBHOOKS: "",
  WORKSPACE_KEYS_SECRET: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  LAP_LIVE_TEST: "",
  NEXT_PUBLIC_BLANK_COPY: "",
  NEXT_TELEMETRY_DISABLED: "1",
  E2E_OUTBOUND_LOG: OUTBOUND_LOG,
};
