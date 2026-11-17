// D105: a member's session opens the members' board only. Every officer handler under /api/w/[slug] (all but
// login and logout, which every session uses) answers a member's session exactly as it answers no session,
// found by walking this folder, so a route added later is covered without a change here.
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ORIGIN = "https://laptracker.test";
const HERE = import.meta.dirname;
const ROUTES = readdirSync(HERE, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith("route.ts") && !/^(login|logout)\//.test(f))
  .sort();
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>;

let db: Db;
const tokens = { officer: "", member: "" };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  for (const tier of ["officer", "member"] as const) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ws?.id ?? 0, discordUserId: `ogs-${tier}`, displayName: tier })
      .returning({ id: workspaceUsers.id });
    tokens[tier] = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null, tier)).token;
  }
});

function call(handler: Handler, method: string, token: string | null, body = "{}") {
  const headers = new Headers({ origin: ORIGIN, "content-type": "application/json" });
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  const request = new Request(`${ORIGIN}/api/w/ogs/x`, {
    method,
    headers,
    ...(method === "GET" ? {} : { body }),
  });
  return handler(request, { params: Promise.resolve({ slug: "ogs", uid: "101", id: "1" }) });
}

describe("a member's session on the officers' API (D105)", () => {
  it("finds the officer routes to check", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(14);
    expect(ROUTES).toContain(join("start-here", "route.ts"));
  });

  it.each(ROUTES)("%s answers a member's session as it answers no session", async (file) => {
    const mod = (await import(/* @vite-ignore */ `./${file}`)) as Partial<Record<string, Handler>>;
    for (const method of METHODS) {
      const handler = mod[method];
      if (!handler) continue;
      const none = await call(handler, method, null);
      const member = await call(handler, method, tokens.member);
      expect([method, member.status], file).toEqual([method, none.status]);
      expect(await member.json(), file).toEqual(await none.json());
      // Where the session check is reached, an officer's session passes it: the refusal is the tier's.
      if (none.status === 401) {
        expect((await call(handler, method, tokens.officer)).status, file).not.toBe(401);
      }
    }
  });

  it("refuses a member's Start here save that an officer's session saves", async () => {
    const { POST } = (await import("./start-here/route")) as { POST: Handler };
    const body = JSON.stringify({
      changes: [
        { language: "en", version: 0, text: { glossary: "EB: Elite Boss", rules: "", ask: "" } },
      ],
    });
    const member = await call(POST, "POST", tokens.member, body);
    expect([member.status, await member.json()]).toEqual([401, { code: "signed_out" }]);
    const officer = await call(POST, "POST", tokens.officer, body);
    expect([officer.status, await officer.json()]).toEqual([200, { version: 1 }]);
  });
});
