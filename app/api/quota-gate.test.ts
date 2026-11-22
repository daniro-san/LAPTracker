// Plan §3.4, D3: every app/api route.ts is sorted, by reading it and what it calls, into one of three lists:
// QUOTA (it can spend upstream /v1 quota, or arms the ticks to), PUBLIC_OR_OTHER_GATE and NOT_QUOTA, the last two
// with their reasons. A route file in none of them fails here, so a new route needs that decision. The lists do
// not find quota use by themselves: a route that starts spending quota is moved to QUOTA by the change that does
// it. Each QUOTA route, sent no secret and no PIN, answers 401 or 403 and makes no /v1 call, also from the work
// it leaves for after the answer.
import { readdirSync } from "node:fs";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// Work after the answer (`after`) needs a Next request; here it is kept and run by the test.
const later = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void later.push(task),
}));

/** Routes that spend /v1 quota, or make the ticks spend it, each behind the scheduler's secret or the PIN. */
const QUOTA: Record<string, "GET" | "POST"> = {
  // The KvK opponent's tags, which the Start and End then read, one call each (D152).
  "admin/kvk-opponent/route.ts": "POST",
  "admin/squads-read/route.ts": "POST",
  "daily-read/retry/route.ts": "POST",
  "quota/check/route.ts": "GET",
  "quota/route.ts": "GET",
  // An is_test event that the ticks then read, with no secret of their own (plan §3.1).
  "rehearsal/route.ts": "POST",
  "snapshot/route.ts": "POST",
  "squads-read/route.ts": "POST",
  "tick/route.ts": "POST",
};
/** Spends quota without a secret, on purpose. */
const PUBLIC_OR_OTHER_GATE: Record<string, string> = {
  "alliances/[unionId]/details/route.ts":
    "D133 'Get today's details': a public press from our own page, behind its same-origin check, an IP limit and a daily cap; its own route test",
};
/** Calls no /v1 method, directly or through what it calls. */
const NOT_QUOTA: Record<string, string> = {
  "admin/discord-command/route.ts": "registers Discord commands (D96); Discord only",
  "admin/feedback/route.ts": "the owner's status on a feedback item (D155); database only",
  "admin/invites/route.ts": "invite links (D130); database only",
  "admin/session/route.ts": "the /admin PIN cookie",
  "admin/workspaces/allowlist/route.ts": "a sign-in allowlist row; database only",
  "admin/workspaces/deletion/route.ts":
    "asks or cancels a workspace deletion (D125); database only",
  "admin/workspaces/features/route.ts":
    "feature switches and caps (D126); database and Discord commands",
  "admin/workspaces/route.ts":
    "saves a workspace row; the alliance is checked against stored data (D133)",
  "admin/workspaces/sign-out/route.ts": "ends a workspace's sessions; database only",
  "alliances/[unionId]/history/route.ts": "a public read through lib/queries",
  "events/[id]/route.ts": "a public read through lib/queries",
  "events/route.ts": "a public read through lib/queries",
  "manual-event/rename/route.ts": "renames an event row (D39)",
  "manual-event/route.ts": "creates a manual round's row; only /api/snapshot reads it (D28)",
  "manual-event/settings/route.ts": "a manual round's visibility and Discord options (D28)",
  "tick/watch/route.ts": "reads the newest tick time and posts an admin alert (D45); no snapshot",
};

const ROUTES = readdirSync(import.meta.dirname, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith("route.ts"))
  .sort();
const LISTED = [
  ...Object.keys(QUOTA),
  ...Object.keys(PUBLIC_OR_OTHER_GATE),
  ...Object.keys(NOT_QUOTA),
];

type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>;

let db: Db;
const handlers = new Map<string, Handler>();
beforeAll(async () => {
  db = await openTestDb();
  for (const [file, method] of Object.entries(QUOTA)) {
    const mod = (await import(/* @vite-ignore */ `./${file}`)) as Record<string, Handler>;
    handlers.set(file, mod[method] as Handler);
  }
});
beforeEach(async () => {
  // A fresh failure count, so each route answers its first refusal, not the IP limit's 429.
  await truncateAll(db);
  later.length = 0;
});

describe("the quota routes without a secret (plan §3.4, D3)", () => {
  it("puts every app/api route in exactly one list, and lists no file that is gone", () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    expect(
      ROUTES.filter((f) => !LISTED.includes(f)),
      "Plan §3.4, D3: a new app/api route is in no list. Add it to QUOTA (it can spend /v1 quota, so it sits behind the secret or the PIN), PUBLIC_OR_OTHER_GATE or NOT_QUOTA, with its reason.",
    ).toEqual([]);
    expect(
      LISTED.filter((f, i) => LISTED.indexOf(f) !== i),
      "Plan §3.4: a route is in two lists. Keep it in one.",
    ).toEqual([]);
    expect(
      LISTED.filter((f) => !ROUTES.includes(f)),
      "Plan §3.4: a listed route file is gone. Remove it from its list.",
    ).toEqual([]);
  });

  it.each(Object.entries(QUOTA))(
    "%s refuses with 401 or 403 and calls /v1 nothing",
    async (file, method) => {
      const { ctx } = testContext(db);
      // Every /v1 method, counted: a quota call, a roster or a player (squads, D117).
      const upstream: string[] = [];
      ctx.v1 = new Proxy(ctx.v1, {
        get(target, key, receiver) {
          const value: unknown = Reflect.get(target, key, receiver);
          if (typeof value !== "function") return value;
          return (...args: unknown[]) => {
            upstream.push(String(key));
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        },
      });
      holder.ctx = ctx;
      const handler = handlers.get(file) as Handler;

      const path = `/api/${file.replace(/\/?route\.ts$/, "")}`;
      const res = await handler(request(path, { method }), {
        params: Promise.resolve({}),
      });
      for (const task of later) await task();

      expect(
        [401, 403],
        `${file}: a quota route answered a request with no secret and no PIN (plan §3.4, D3). Check the secret or the PIN before any other work.`,
      ).toContain(res.status);
      expect(
        upstream,
        `${file}: a quota route called /v1 for a request with no secret and no PIN (plan §3.4, D3). Check the secret or the PIN before any /v1 call, also in work left for after().`,
      ).toEqual([]);
    },
  );
});
