// The thefts route's writes (issue 321): the add's type is required and one of the four the sheet offers
// (D97 amended 2026-11-17); an attacker's server is a live attacker's, 1 to 99999 or null (amended 2026-11-19).
// D126: with the thefts log turned off for the workspace, it leaves the navigation and the route refuses.
import { randomUUID } from "node:crypto";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { featuresBySlug } from "@/lib/private/features";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import { theftAttackers, thefts } from "@/lib/schema-thefts";

import { CalendarNav } from "../../../../_ui/CalendarNav";
import { SideNav } from "../../../../_ui/DeskNav";

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

async function post(body: object) {
  const response = await POST(
    new Request("https://laptracker.test/api/w/ogs/thefts", {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
  return response.status;
}

describe("POST /api/w/[slug]/thefts, action server (D97, amended 2026-11-19)", () => {
  it("refuses 0, finds no unknown or deleted attacker, and stores null as not known", async () => {
    expect(await add("ops")).toBe(200);
    const server = (attacker: string, value: number | null) =>
      post({ action: "server", attacker, server: value });
    expect(await server("name:stene", 0)).toBe(400);
    expect(await server("name:nobody", 325)).toBe(404);
    expect(await server("name:stene", 412)).toBe(200);
    expect(await server("name:stene", null)).toBe(200);
    expect(await db.select({ server: theftAttackers.server }).from(theftAttackers)).toEqual([
      { server: null },
    ]);
    await db.update(thefts).set({ deletedAt: T0 });
    expect(await server("name:stene", 325)).toBe(404);
  });
});

describe("the thefts log turned off for the workspace (D126)", () => {
  it("leaves the navigation, and its route answers 403 turned_off and stores nothing", async () => {
    const t = WORKSPACE_DICTIONARIES.en;
    const nav = async () => {
      const on = (await featuresBySlug(db, "ogs"))?.on ?? new Set();
      const props = { t, slug: "ogs", waiting: 0, on };
      return renderToStaticMarkup(
        createElement("div", null, [
          createElement(CalendarNav, { key: "c", ...props, current: "week" }),
          createElement(SideNav, { key: "s", ...props, current: "days", wide: true }),
        ]),
      );
    };
    expect(await nav()).toContain("/w/ogs/thefts");
    await db.insert(workspaceFeatures).values({ workspaceId: 1, off: ["thefts"] });
    expect(await nav()).not.toContain("/w/ogs/thefts");
    expect(await add("ops")).toBe(403);
    expect(await db.select().from(thefts)).toEqual([]);
    await db.delete(workspaceFeatures);
    expect(await add("ops")).toBe(200);
  });
});
