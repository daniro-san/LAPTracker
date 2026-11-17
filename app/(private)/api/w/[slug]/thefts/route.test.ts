// The add-a-theft write (issue 321, D97 amended 2026-11-17): the type is required and one of the four the
// sheet offers.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { thefts } from "@/lib/schema-thefts";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

let db: Db;
let token: string;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  holder.ctx = testContext(db).ctx;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: 1, discordUserId: "id-ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, 1, user?.id ?? 0, T0, null, "officer")).token;
});

async function add(kind: unknown) {
  const response = await POST(
    new Request("https://laptracker.test/api/w/ogs/thefts", {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify({
        action: "add",
        attacker: { name: "Stene", tag: "1b8R" },
        victimUid: null,
        day: "2026-11-06",
        time: "20:00",
        kind,
        note: "",
        requestId: randomUUID(),
      }),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
  return response.status;
}

describe("POST /api/w/[slug]/thefts, action add", () => {
  it("takes each of the four types and refuses any other or none", async () => {
    for (const kind of ["tile_hit", "ops", "caravan", "sanctuary"])
      expect(await add(kind)).toBe(200);
    for (const kind of ["quest_rewards", "", null, undefined]) expect(await add(kind)).toBe(400);
    const kinds = (await db.select({ kind: thefts.kind }).from(thefts)).map((r) => r.kind).sort();
    expect(kinds).toEqual(["caravan", "ops", "sanctuary", "tile_hit"]);
  });
});
