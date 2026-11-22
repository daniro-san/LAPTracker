// Plan §3.4, D3: the routes that can spend upstream (/v1) quota answer a request without the scheduler's
// secret or the PIN with 401 or 403, before any /v1 call, and leave no work after the answer that makes one.
// The routes are found by reading every app/api route.ts for what reaches the quota: a new one that is not in
// GATED (or EXCLUDED, with the reason) fails here.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

/** What reaches the /v1 quota from a route: the context's v1 source or a function that spends it. */
const SPENDS =
  /\b(ctx\.v1|fetchQuota|fetchAlliance|fetchPlayer|executeSnapshot|runSnapshot|runTick|runDailyRead|retryDailyRead|runSquadsBatch|squadsBatch|scheduleSquadsBatch|quotaReport|lookupAlliance)\b/;

/** The quota routes, each behind the scheduler's secret or the PIN (lib/auth.ts). */
const GATED: Record<string, "GET" | "POST"> = {
  "admin/squads-read/route.ts": "POST",
  "daily-read/retry/route.ts": "POST",
  "quota/check/route.ts": "GET",
  "quota/route.ts": "GET",
  "snapshot/route.ts": "POST",
  "squads-read/route.ts": "POST",
  "tick/route.ts": "POST",
};
/**
 * Spends quota without a secret, on purpose. alliances/[unionId]/details: "Get today's details" (D133), a public
 * press from our own page, behind its same-origin check, an IP limit and a daily cap; its own route test.
 */
const EXCLUDED = new Set(["alliances/[unionId]/details/route.ts"]);

const DIR = import.meta.dirname;
const QUOTA_ROUTES = readdirSync(DIR, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith("route.ts") && SPENDS.test(readFileSync(join(DIR, f), "utf8")))
  .sort();

type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  // A fresh failure count, so each route answers its first refusal, not the IP limit's 429.
  await truncateAll(db);
  later.length = 0;
});

describe("the quota routes without a secret (plan §3.4, D3)", () => {
  it("lists every route that reaches the quota, and nothing else", () => {
    expect(QUOTA_ROUTES.length).toBeGreaterThan(0);
    expect(QUOTA_ROUTES.filter((f) => !(f in GATED) && !EXCLUDED.has(f))).toEqual([]);
    expect(Object.keys(GATED).filter((f) => !QUOTA_ROUTES.includes(f))).toEqual([]);
  });

  it.each(Object.entries(GATED))(
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
      const mod = (await import(/* @vite-ignore */ `./${file}`)) as Record<string, Handler>;
      const handler = mod[method] as Handler;

      const res = await handler(request(`/api/${file.replace(/\/?route\.ts$/, "")}`, { method }), {
        params: Promise.resolve({}),
      });
      for (const task of later) await task();

      expect([401, 403], file).toContain(res.status);
      expect(upstream, file).toEqual([]);
    },
  );
});
