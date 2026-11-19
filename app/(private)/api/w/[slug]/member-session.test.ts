// D105: a member's session opens the members' board only. Every officer handler under /api/w/[slug] gets a
// minimal valid request (FIXTURES), so it passes its own checks (origin, body, query) and reaches the session
// check. Then no session and a member's session must both get 401 signed_out, and an officer's must not.
// Routes are found by walking this folder: a new route without a fixture, or one that answers before its
// session check, fails here.
import { readdirSync } from "node:fs";

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
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = (typeof METHODS)[number];
type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>;
/** A JSON body, a query string, or a picture body; `officer: false` skips the officer's call (below). */
type Fixture = { body?: unknown; query?: string; picture?: true; officer?: false };

/**
 * Not officer routes, so not here. login: where every sign-in starts, with no session yet. logout: ends a
 * session of either tier (D105). The board and how-to are pages, not API routes: the board has its own
 * door (requireBoard) and how-to reads nothing.
 */
const EXCLUDED = new Set(["login/route.ts", "logout/route.ts"]);

const ID = "00000000-0000-4000-8000-000000000001";
const FIXTURES: Record<string, Partial<Record<Method, Fixture>>> = {
  "activity/route.ts": { GET: { query: "?before=1763640000000" } },
  "calendar/route.ts": {
    POST: { body: { action: "delete", entry: 1, scope: "all", week: "2026-11-16" } },
  },
  "follow-up/route.ts": {
    POST: { body: { uid: 1, action: "talked", note: "", until: null, version: 0, requestId: ID } },
  },
  "garrison/route.ts": {
    POST: { body: { action: "save", entry: 1, week: "2026-11-16", rev: 0, pairs: [] } },
  },
  "import/route.ts": { POST: { body: { csv: "name", apply: false, decisions: [] } } },
  "members/[uid]/facts/route.ts": {
    POST: { body: { changes: [{ field: "notes", version: 0, value: "x", source: "officer" }] } },
  },
  "members/[uid]/route.ts": { GET: {} },
  "notices/draft/route.ts": {
    POST: { body: { kind: "translate", from: "en", to: ["fr"], text: "Hello" } },
  },
  "notices/delete/route.ts": { POST: { body: { id: 1, requestId: ID } } },
  "notices/picture/keep/route.ts": { POST: { body: { id: 1, keep: true } } },
  "notices/picture/remove/route.ts": { POST: { body: { id: 1 } } },
  "notices/picture/reuse/route.ts": { POST: { body: { from: 1, to: 2 } } },
  "notices/picture/route.ts": { POST: { picture: true, query: "?id=1" } },
  "notices/publish/route.ts": { POST: { body: { id: 1, languages: ["en"], requestId: ID } } },
  "notices/reviews/route.ts": {
    POST: { body: { action: "ask", notice: 1, language: null, reviewer: null, requestId: ID } },
  },
  "notices/route.ts": {
    POST: { body: { changes: [{ field: "title", value: "x", version: 0 }], requestId: ID } },
  },
  "pending/route.ts": { POST: { body: { action: "delete", uid: -1 } } },
  "profile/route.ts": { GET: {}, POST: { body: { action: "unlink" } } },
  "roll-call/route.ts": {
    POST: { body: { action: "add", kind: "cheese", day: "2026-11-16", requestId: ID } },
  },
  "shots/[id]/route.ts": { POST: { body: { action: "discard", version: 1 } } },
  // The officer's call would run the OCR on the stand-in bytes: the refusals are what is checked here.
  "shots/read/route.ts": { POST: { picture: true, officer: false } },
  "shots/route.ts": { POST: { body: { pictures: [{ lines: [] }] } } },
  "start-here/route.ts": {
    POST: {
      body: {
        changes: [{ language: "en", version: 0, text: { glossary: "x", rules: "", ask: "" } }],
      },
    },
  },
  "thanks/draft/route.ts": {
    POST: { body: { people: [{ name: "Ana", did: ["squad"] }], lastWeek: false } },
  },
  "thanks/route.ts": { POST: { body: { action: "take_down", id: 1 } } },
  "thefts/route.ts": { GET: { query: "?q=ab" }, POST: { body: { action: "remove", id: 1 } } },
};

const ROUTES = readdirSync(import.meta.dirname, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith("route.ts") && !EXCLUDED.has(f))
  .sort();

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

function call(handler: Handler, method: Method, fixture: Fixture, token: string | null) {
  const headers = new Headers({ origin: ORIGIN, "sec-fetch-site": "same-origin" });
  headers.set("content-type", fixture.picture ? "image/png" : "application/json");
  // A picture is sent with its size, as a browser does (the notice picture route needs it, D119).
  if (fixture.picture) headers.set("content-length", "4");
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  const body = fixture.picture ? new Uint8Array([137, 80, 78, 71]) : JSON.stringify(fixture.body);
  const request = new Request(`${ORIGIN}/api/w/ogs/x${fixture.query ?? ""}`, {
    method,
    headers,
    ...(method === "GET" ? {} : { body }),
  });
  return handler(request, { params: Promise.resolve({ slug: "ogs", uid: "101", id: "1" }) });
}

describe("a member's session on the officers' API (D105)", () => {
  it("finds the officer routes, and every one has a fixture", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(15);
    expect(ROUTES.filter((f) => !(f in FIXTURES))).toEqual([]);
  });

  it.each(ROUTES)("%s refuses no session and a member's session alike", async (file) => {
    const mod = (await import(/* @vite-ignore */ `./${file}`)) as Partial<Record<Method, Handler>>;
    const exported = METHODS.filter((m) => mod[m]);
    expect(exported.length, file).toBeGreaterThan(0);
    // Every handler the route exports has a fixture, so none is skipped.
    expect(
      exported.filter((m) => !FIXTURES[file]?.[m]),
      file,
    ).toEqual([]);
    for (const method of exported) {
      const handler = mod[method] as Handler;
      const fixture = FIXTURES[file]?.[method] as Fixture;
      for (const token of [null, tokens.member]) {
        const res = await call(handler, method, fixture, token);
        const who = `${file} ${method} ${token ? "member" : "no session"}`;
        expect([res.status, await res.json()], who).toEqual([401, { code: "signed_out" }]);
      }
      // The same request passes the session check for an officer: the refusal above is the tier's.
      if (fixture.officer !== false) {
        const res = await call(handler, method, fixture, tokens.officer);
        expect(res.status, `${file} ${method} officer`).not.toBe(401);
      }
    }
  });

  it("refuses a member's Start here save that an officer's session saves", async () => {
    const { POST } = (await import("./start-here/route")) as { POST: Handler };
    const fixture = FIXTURES["start-here/route.ts"]?.POST as Fixture;
    const member = await call(POST, "POST", fixture, tokens.member);
    expect([member.status, await member.json()]).toEqual([401, { code: "signed_out" }]);
    const officer = await call(POST, "POST", fixture, tokens.officer);
    expect([officer.status, await officer.json()]).toEqual([200, { version: 1 }]);
  });
});
