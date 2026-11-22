// "Send feedback" (D157, issue 713): the door and the same-origin rule come first; then a send is stored
// redacted and without its sender, a filled honeypot stores and counts nothing, and the day's limits hold at
// their edges (5 per IP hash, 20 per workspace). Invented workspaces, people and text only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { authAttempts, workspaces, workspaceUsers } from "@/lib/schema";
import { feedback } from "@/lib/schema-feedback";

import { POST } from "./route";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ORIGIN = "https://laptracker.test";
const tokens: Record<string, string> = {};
let db: Db;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  const [alpha, bravo] = await db
    .insert(workspaces)
    .values(
      [
        { unionId: 900_001, slug: "alpha", discordGuildId: "1", leaderRoleIds: ["2"] },
        { unionId: 900_002, slug: "bravo", discordGuildId: "3", leaderRoleIds: ["4"] },
      ].map((w, i) => ({ ...w, memberRoleIds: [String(5 + i)] })),
    )
    .returning({ id: workspaces.id });
  const people = [
    ["alpha:officer", alpha?.id, "officer"],
    ["alpha:member", alpha?.id, "member"],
    ["bravo:officer", bravo?.id, "officer"],
  ] as const;
  for (const [who, ws, tier] of people) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ws ?? 0, discordUserId: `d-${who}`, displayName: `Invented ${who}` })
      .returning({ id: workspaceUsers.id });
    tokens[who] = (await createSession(db, ws ?? 0, user?.id ?? 0, T0, null, tier)).token;
  }
});

const IDEA = {
  area: "desk",
  kind: "idea",
  text: "Show the shield count on Home",
  path: "/w/alpha/roll-call",
  language: "en",
  website: "",
};

async function send(
  who: string | null,
  body: object,
  { ip = "203.0.113.7", origin = ORIGIN }: { ip?: string; origin?: string } = {},
) {
  const request = new Request(`${ORIGIN}/api/w/alpha/feedback`, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": origin === ORIGIN ? "same-origin" : "cross-site",
      "content-type": "application/json",
      "x-real-ip": ip,
      ...(who && { cookie: `${SESSION_COOKIE}=${tokens[who] ?? ""}` }),
    },
    body: JSON.stringify(body),
  });
  const res = await POST(request, { params: Promise.resolve({ slug: "alpha" }) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}
const rows = () => db.select().from(feedback);

describe("Send feedback: who may send (D157, D105)", () => {
  it("refuses a cross-site request and every session that is not this workspace's own, and stores nothing", async () => {
    expect(await send("alpha:officer", IDEA, { origin: "https://evil.example" })).toEqual({
      status: 403,
      body: { code: "forbidden" },
    });
    expect((await send(null, IDEA)).status).toBe(401);
    // A member's session opens the board only, never the desk's door.
    expect(await send("alpha:member", IDEA)).toEqual({ status: 401, body: { code: "signed_out" } });
    // Another workspace's officer, on Alpha's address.
    expect((await send("bravo:officer", { ...IDEA, area: "board" })).status).toBe(401);
    expect(await rows()).toEqual([]);
  });

  it("takes a member's send from the board as a member's, and an officer's from the desk as an officer's", async () => {
    expect(
      (await send("alpha:member", { ...IDEA, area: "board", path: "/w/alpha/board" })).status,
    ).toBe(200);
    expect((await send("alpha:officer", IDEA)).status).toBe(200);
    expect((await rows()).map((r) => [r.area, r.tier])).toEqual([
      ["board", "member"],
      ["desk", "officer"],
    ]);
  });
});

describe("Send feedback: what is stored (D157)", () => {
  it("stores the text redacted, with no sender, and answers only that it was received", async () => {
    const text =
      "Problem: my base x: 512, y: 733 shows wrong, photo https://phs-image.globallap.com/a/9.png";
    const sent = await send("alpha:officer", { ...IDEA, kind: "problem", text });
    expect(sent).toEqual({ status: 200, body: { ok: true } });
    const [row] = await rows();
    expect(row?.text).toBe("Problem: my base x: …, y: … shows wrong, photo …");
    // INVARIANT feedback.no-sender: these columns and no other; no user, uid, Discord id, name or IP.
    expect(row).toEqual({
      id: 1,
      area: "desk",
      kind: "problem",
      text: row?.text,
      path: "/w/alpha/roll-call",
      language: "en",
      workspaceId: expect.any(Number) as number,
      tier: "officer",
      createdAt: T0,
      status: "new",
    });
    expect(JSON.stringify(await db.select().from(authAttempts))).not.toContain("203.0.113.7");
  });

  it("drops a send whose hidden honeypot is filled: 200, nothing stored, nothing counted", async () => {
    const bot = await send("alpha:officer", { ...IDEA, website: "https://spam.example" });
    expect(bot).toEqual({ status: 200, body: { ok: true } });
    expect(await rows()).toEqual([]);
    expect(await db.select().from(authAttempts)).toEqual([]);
  });

  it("refuses an empty text, a 1,001-character text, another workspace's path and an unknown key", async () => {
    for (const body of [
      { ...IDEA, text: "   " },
      { ...IDEA, text: "a".repeat(1001) },
      { ...IDEA, path: "/w/bravo/members" },
      { ...IDEA, uid: 101 },
    ])
      expect((await send("alpha:officer", body)).status).toBe(400);
    expect((await send("alpha:officer", { ...IDEA, text: "a".repeat(1000) })).status).toBe(200);
    expect(await rows()).toHaveLength(1);
  });
});

describe("Send feedback: the day's limits (D157)", () => {
  it("takes 5 a day from one IP and refuses the 6th, while another IP still sends", async () => {
    for (let n = 1; n <= 5; n++) expect((await send("alpha:officer", IDEA)).status).toBe(200);
    expect(await send("alpha:officer", IDEA)).toEqual({ status: 429, body: { code: "too_many" } });
    expect((await send("alpha:officer", IDEA, { ip: "198.51.100.4" })).status).toBe(200);
    expect(await rows()).toHaveLength(6);
  });

  it("takes 20 a day from one workspace and refuses the 21st, from any IP", async () => {
    for (let n = 1; n <= 20; n++)
      expect((await send("alpha:officer", IDEA, { ip: `192.0.2.${n}` })).status).toBe(200);
    expect((await send("alpha:officer", IDEA, { ip: "192.0.2.99" })).status).toBe(429);
    expect(await rows()).toHaveLength(20);
  });
});
