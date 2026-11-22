// GET /api/w/[slug]/members/[uid], the Members list's sheet (issue 337): an officer reads one member of their
// own alliance's card. The roster's raw_json carries every private field upstream sends (x, y, online, last
// online, the photo's URL); the card shows the map position as words (D71, D136) and never the photo's URL
// (D22). Invented names and values.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyRosters } from "@/lib/schema";
import { SEED_AT, seedRoster, seedWorkspace } from "@/lib/workspace-data.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const LANTERN = 900_001;
const MARSH = 900_002;

let db: Db;
let token = "";
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const test = testContext(db);
  test.clock.now = SEED_AT;
  holder.ctx = test.ctx;
  const lantern = await seedWorkspace(db, "lnk", LANTERN);
  await seedWorkspace(db, "msh", MARSH);
  // Lantern Keep's member 101, with x 98765, y 54321, online, last online and the photo's URL in raw_json.
  await seedRoster(db, LANTERN);
  // Another alliance's member, 202, on the same day's read.
  await db.insert(dailyRosters).values({
    readDay: "2026-11-18",
    unionId: MARSH,
    memberCount: 1,
    sourceUpdatedAt: SEED_AT,
    isFresh: true,
    memberUids: [202],
    memberNames: ["Bea Invented"],
    memberPower: [2000],
    memberKills: [20],
  });
  token = (await createSession(db, lantern.workspaceId, lantern.officer, SEED_AT, null, "officer"))
    .token;
});

const card = (uid: string) =>
  GET(
    new Request(`https://laptracker.test/api/w/lnk/members/${uid}`, {
      headers: { cookie: `${SESSION_COOKIE}=${token}`, "accept-language": "en" },
    }),
    { params: Promise.resolve({ slug: "lnk", uid }) },
  );

/** Every key anywhere in a JSON value. */
const keysOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(keysOf)
    : value !== null && typeof value === "object"
      ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)])
      : [];

describe("GET /api/w/[slug]/members/[uid]", () => {
  it("gives an officer their own alliance's member card, map position as words (D71)", async () => {
    const res = await card("101");
    expect(res.status).toBe(200);
    const { card: got } = (await res.json()) as {
      card: { uid: number; name: string; map: { value: string } };
    };
    expect([got.uid, got.name]).toEqual([101, "Ana Example"]);
    expect(got.map.value).toBe("X 98765 · Y 54321");
  });

  it("carries no photo URL and none of the roster's raw private keys (D71, D22)", async () => {
    const res = await card("101");
    expect(res.status).toBe(200);
    const text = await res.text();
    const raw = ["avatar_url", "avatarUrl", "x", "y", "online", "last_online_at", "lastOnlineAt"];
    expect(keysOf(JSON.parse(text)).filter((k) => raw.includes(k))).toEqual([]);
    expect(text).not.toContain("avatar.example.test");
  });

  it("answers 404 for another alliance's member (D71)", async () => {
    const res = await card("202");
    expect([res.status, await res.json()]).toEqual([404, { code: "not_member" }]);
  });

  it("answers private, no-store at the route itself (D71)", async () => {
    const res = await card("101");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
