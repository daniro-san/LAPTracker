// POST /api/w/[slug]/desk-language (issue 438): an officer saves the desk's default language, "" clears it,
// and a member's session or another workspace's officer changes nothing. Invented names.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { workspaceDefaultLanguage } from "@/lib/private/desk-language";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
let db: Db;
let officer = "";
let member = "";
let elsewhere = "";

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db, TEST_ENV).ctx;
  const made = await db
    .insert(workspaces)
    .values([
      { unionId: 67109944, slug: "nse", discordGuildId: "11111", leaderRoleIds: ["2"] },
      { unionId: 67109945, slug: "other", discordGuildId: "22222", leaderRoleIds: ["3"] },
    ])
    .returning({ id: workspaces.id });
  const [mine, theirs] = [made[0]?.id ?? 0, made[1]?.id ?? 0];
  const users = await db
    .insert(workspaceUsers)
    .values([
      { workspaceId: mine, discordUserId: "u-1", displayName: "Ana" },
      { workspaceId: mine, discordUserId: "u-2", displayName: "Bram" },
      { workspaceId: theirs, discordUserId: "u-3", displayName: "Caro" },
    ])
    .returning({ id: workspaceUsers.id });
  const session = async (ws: number, i: number, tier: "officer" | "member") =>
    (await createSession(db, ws, users[i]?.id ?? 0, T0, null, tier)).token;
  officer = await session(mine, 0, "officer");
  member = await session(mine, 1, "member");
  elsewhere = await session(theirs, 2, "officer");
});

const save = (body: unknown, token = officer) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/desk-language`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );

describe("POST /api/w/[slug]/desk-language", () => {
  it("saves the language for the officer's workspace, and an empty one clears it", async () => {
    expect((await save({ language: "pt-BR" })).status).toBe(200);
    expect(await workspaceDefaultLanguage(db, "nse")).toBe("pt-BR");
    expect(await workspaceDefaultLanguage(db, "other")).toBeNull();
    expect((await save({ language: "" })).status).toBe(200);
    expect(await workspaceDefaultLanguage(db, "nse")).toBeNull();
  });

  it("refuses a language the desk is not written in", async () => {
    expect((await save({ language: "de" })).status).toBe(400);
    expect(await workspaceDefaultLanguage(db, "nse")).toBeNull();
  });

  it("changes nothing for a member or another workspace's officer", async () => {
    expect((await save({ language: "fr" }, member)).status).toBe(401);
    expect((await save({ language: "fr" }, elsewhere)).status).toBe(401);
    expect(await workspaceDefaultLanguage(db, "nse")).toBeNull();
  });
});
