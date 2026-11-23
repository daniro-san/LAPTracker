// "Send feedback" (D157, issue 713): the door and the same-origin rule come first; then a send is stored
// redacted and without its sender, a filled honeypot stores and counts nothing, and the day's limits hold at
// their edges (5 per IP hash, 20 per workspace). Invented workspaces, people and text only.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { FEEDBACK_BODY_MAX } from "@/lib/private/feedback";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { authAttempts, workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import { feedback, feedbackPictures } from "@/lib/schema-feedback";

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
  {
    ip = "203.0.113.7",
    origin = ORIGIN,
    length,
  }: { ip?: string; origin?: string; length?: string | null } = {},
) {
  const json = JSON.stringify(body);
  // As a browser's fetch states it; `null` leaves it out, as a chunked body would.
  const stated = length === undefined ? String(Buffer.byteLength(json)) : length;
  const request = new Request(`${ORIGIN}/api/w/alpha/feedback`, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": origin === ORIGIN ? "same-origin" : "cross-site",
      "content-type": "application/json",
      "x-real-ip": ip,
      ...(stated !== null && { "content-length": stated }),
      ...(who && { cookie: `${SESSION_COOKIE}=${tokens[who] ?? ""}` }),
    },
    body: json,
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

  it("refuses a board send with 403 turned_off while the owner has the board off, and still takes the desk's", async () => {
    const [alpha] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, "alpha"));
    await db
      .insert(workspaceFeatures)
      .values({ workspaceId: alpha?.id ?? 0, switches: { board: false } });
    const board = { ...IDEA, area: "board", path: "/w/alpha/board" };
    expect(await send("alpha:member", board)).toEqual({
      status: 403,
      body: { code: "turned_off" },
    });
    expect(await rows()).toEqual([]);
    expect((await send("alpha:officer", IDEA)).status).toBe(200);
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

/** An invented PNG header that says `side` × `side` px, padded to `size` bytes (the server reads the header only). */
function png(side: number, size = 64): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, side);
  new DataView(b.buffer).setUint32(20, side);
  return b;
}
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

describe("Send feedback: one picture (D157 amended 2026-11-22, D119's checks)", () => {
  it("stores the picture with its row, typed by its bytes, and nothing about it in the row itself", async () => {
    const bytes = png(800);
    expect((await send("alpha:officer", { ...IDEA, picture: b64(bytes) })).status).toBe(200);
    const [row] = await rows();
    const pictures = await db.select().from(feedbackPictures);
    expect(pictures).toEqual([
      {
        feedbackId: row?.id,
        workspaceId: row?.workspaceId,
        data: bytes,
        type: "image/png",
        width: 800,
        height: 800,
        bytes: 64,
        hash: expect.stringMatching(/^[0-9a-f]{16}$/) as string,
      },
    ]);
  });

  it("takes a picture of exactly 400 KB and 1600 px, and refuses one byte or one pixel more, storing and counting nothing", async () => {
    expect((await send("alpha:officer", { ...IDEA, picture: b64(png(1601)) })).status).toBe(422);
    const over = await send("alpha:officer", { ...IDEA, picture: b64(png(10, 409_601)) });
    expect(over).toEqual({ status: 413, body: { code: "too_large" } });
    expect(await rows()).toEqual([]);
    expect(await db.select().from(authAttempts)).toEqual([]);
    const fits = await send("alpha:officer", { ...IDEA, picture: b64(png(1600, 409_600)) });
    expect(fits.status).toBe(200);
    expect(await db.select({ bytes: feedbackPictures.bytes }).from(feedbackPictures)).toEqual([
      { bytes: 409_600 },
    ]);
  });

  it("refuses a wrong type by its bytes (a GIF, an SVG), whatever it claims, and stores nothing", async () => {
    const gif = new TextEncoder().encode("GIF89a\x01\x00\x01\x00");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    for (const bytes of [gif, svg])
      expect(await send("alpha:officer", { ...IDEA, picture: b64(bytes) })).toEqual({
        status: 415,
        body: { code: "wrong_type" },
      });
    expect((await send("alpha:officer", { ...IDEA, picture: "not base64!" })).status).toBe(400);
    expect(await rows()).toEqual([]);
    expect(await db.select().from(feedbackPictures)).toEqual([]);
  });
});

describe("Send feedback: the body's size is known before it is read (D157, as D119)", () => {
  it("refuses a body without a Content-Length (411) and one that states more than the cap (413), storing nothing", async () => {
    expect(await send("alpha:officer", IDEA, { length: null })).toEqual({
      status: 411,
      body: { code: "length_required" },
    });
    expect(await send("alpha:officer", IDEA, { length: String(FEEDBACK_BODY_MAX + 1) })).toEqual({
      status: 413,
      body: { code: "too_large" },
    });
    expect(await rows()).toEqual([]);
    expect(await db.select().from(authAttempts)).toEqual([]);
  });
});
