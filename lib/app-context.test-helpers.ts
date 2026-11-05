// Test-only: an AppContext over a PGlite Db, fake sources whose rosters are fresh relative to a
// settable clock, and a fetch that records Discord posts instead of sending them.
import type { AppContext } from "./app-context";
import { ago, fakeInternal, fakeV1, minutes, roster, T0 } from "./collector.test-helpers";
import type { Db } from "./db";
import { parseEnv } from "./env";

export const TEST_PIN = "482913";
export const TEST_CRON_SECRET = "test".repeat(10); // 40 chars, low entropy: not key-shaped
export const ADMIN_WEBHOOK = "https://discord.com/api/webhooks/1/admin-test";
export const PUBLIC_WEBHOOK = "https://discord.com/api/webhooks/2/public-test";

export const TEST_ENV = parseEnv({
  LAP_API_KEY: "lap_test-placeholder",
  LAP_API_BASE_URL: "https://v1.test/v1",
  LAP_SITE_BASE_URL: "https://site.test/api",
  DATABASE_URL: "postgres://unused.test/db",
  CRON_SECRET: TEST_CRON_SECRET,
  EDIT_PIN: TEST_PIN,
  SERVER_TZ: "Etc/GMT+2",
  EVENT_WEEKDAY: "6",
  EVENT_TIME: "12:00",
  SNAPSHOT_BEFORE: "10:00",
  SNAPSHOT_AFTER: "14:00",
  SNAPSHOT_WINDOW_MIN: "45",
  QUOTA_CHECK_AT: "fri 20:00",
  NOTIFY_WEBHOOK_ADMIN: ADMIN_WEBHOOK,
  NOTIFY_WEBHOOK_PUBLIC: PUBLIC_WEBHOOK,
});

export function testContext(db: Db, env = TEST_ENV) {
  const clock = { now: T0 };
  type Sent = { url: string; content: string; body: Record<string, unknown> };
  // A stand-in for Discord: POST ?wait=true creates a message and returns its id; PATCH edits one.
  const posts: Sent[] = [];
  const edits: (Sent & { messageId: string })[] = [];
  const messages = new Set<string>();
  const v1 = fakeV1((id) => roster(id, ago(clock.now, minutes(1))));
  const ctx: AppContext = {
    env,
    now: () => clock.now,
    v1,
    internal: fakeInternal(),
    fetch: async (input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const [url = "", query] = String(input).split("?");
      const sent = { url, content: String(body.content ?? ""), body };
      if (init?.method === "PATCH") {
        const [hook = "", messageId = ""] = url.split("/messages/");
        if (!messages.has(`${hook}/${messageId}`)) return new Response(null, { status: 404 });
        edits.push({ ...sent, url: hook, messageId });
        return Response.json({ id: messageId });
      }
      posts.push(sent);
      const id = String(1000 + messages.size);
      messages.add(`${url}/${id}`);
      return query === "wait=true" ? Response.json({ id }) : new Response(null, { status: 204 });
    },
    openDb: () => ({ db, close: async () => {} }),
  };
  return { ctx, clock, posts, edits, v1 };
}

/** A request to a route with the given headers; x-real-ip defaults to one address. */
export function request(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new Request(`https://laptracker.test${path}`, {
    method: init.method ?? "POST",
    headers: { "x-real-ip": "198.51.100.1", ...init.headers },
  });
}
