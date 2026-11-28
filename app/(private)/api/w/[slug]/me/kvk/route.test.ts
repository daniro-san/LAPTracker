// A member's "I'm in" for a KvK role (issue 831, D161 amended): only an approved link asks or withdraws, for
// its own uid; an officer sees the ask on the KvK plan and confirms it into the role or declines it; the
// member's card shows the KvK's time in server time and in their own. Invented workspaces and names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import type { MeAccess } from "@/lib/private/access";
import { createEntry } from "@/lib/private/calendar";
import { stOf } from "@/lib/private/calendar-words";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { meKvkView } from "@/lib/private/kvk-claims";
import { kvkPlanView, saveKvkPlan } from "@/lib/private/kvk-plan";

import { calendarWords } from "../../../../../_ui/calendar-data";
import { yourTime } from "../../../../../_ui/YourTime";
import { selfReportWorld } from "../facts/self-report.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ZONE = "Etc/GMT+2";
// T0 is Saturday 2026-11-07, 10:00 ST; the KvK is that day at 12:00 ST.
const DAY = "2026-11-07";
const CASTLE = "Castle defence";

let db: Db;
let entry = 0;
const world = selfReportWorld();
const { kvk, rook } = world;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await world.setUp(db);
  holder.ctx = testContext(db).ctx;
  const officer = await rook();
  const fields = { day: DAY, minute: 720, weekly: false, notes: null, link: null, notice: null };
  const made = await createEntry(
    db,
    officer,
    { kind: "kvk", ...fields, forMembers: true },
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  entry = made.id;
  const roles = [
    { name: CASTLE, uids: [103] },
    { name: "Scout", uids: [] },
  ];
  await saveKvkPlan(db, officer, { action: "save", entry, rev: 0, roles, note: "" }, T0);
});

/** Ana's own card, as her page reads it. */
const anaCard = async () =>
  meKvkView(
    db,
    { workspaceId: (await rook()).workspaceId, unionId: world.ALPHA, uid: 101 } as MeAccess,
    T0,
    ZONE,
  );
const desk = async () => kvkPlanView(db, await rook(), entry, "2026-11-02", ZONE);
const ask = (who: string, role: string, action = "ask", extra: object = {}) =>
  kvk(who, { entry, role, action, ...extra });

describe("a member's \"I'm in\" for a KvK role (issue 831)", () => {
  it("asks and withdraws for the member's own link's uid, and refuses a body that names a uid", async () => {
    expect((await ask("alpha:Ana Invented", CASTLE, "ask", { uid: 102 })).status).toBe(400);
    expect((await ask("alpha:Ana Invented", CASTLE)).status).toBe(200);
    expect((await desk())?.asks).toEqual([{ role: CASTLE, uid: 101, name: "Ana Invented" }]);
    expect((await anaCard())?.roles[0]).toMatchObject({ names: ["Cass Invented"], mine: "asked" });
    expect((await ask("alpha:Ana Invented", CASTLE, "withdraw")).status).toBe(200);
    expect((await desk())?.asks).toEqual([]);
  });

  it("refuses a member whose link waits or who has none, and stores no ask for anyone", async () => {
    expect((await ask("alpha:Bobby", CASTLE)).status).toBe(403);
    expect((await ask("alpha:Nobody", CASTLE)).status).toBe(403);
    expect((await ask("alpha:Ana Invented", "Not a role")).status).toBe(404);
    expect((await desk())?.asks).toEqual([]);
  });

  it("lets an officer confirm one ask into the role and decline another; another workspace's cannot", async () => {
    await ask("alpha:Ana Invented", CASTLE);
    await ask("alpha:Ana Invented", "Scout");
    const answer = (who: string, role: string, reply: string) =>
      kvk(who, { action: "answer", entry, role, uid: 101, answer: reply }, "kvk-plan");
    expect((await answer("bravo:Vale Officer", CASTLE, "confirm")).status).toBe(401);
    expect(await answer("alpha:Rook", CASTLE, "confirm")).toMatchObject({
      status: 200,
      body: { rev: 2 },
    });
    expect((await answer("alpha:Rook", "Scout", "decline")).status).toBe(200);
    const view = await desk();
    expect([view?.roles?.[0]?.uids, view?.asks]).toEqual([[103, 101], []]);
    expect((await anaCard())?.roles.map((r) => r.mine)).toEqual(["in", null]);
    // Once confirmed, only an officer takes the member out.
    expect((await ask("alpha:Ana Invented", CASTLE, "withdraw")).body.code).toBe("confirmed");
  });

  it("gives the KvK's start for the card in server time and in the reader's own time", async () => {
    const card = await anaCard();
    const t = WORKSPACE_DICTIONARIES.en;
    expect(stOf("kvk", card?.minute ?? 0, t)).toBe("12:00 ST");
    expect(yourTime(card?.at ?? 0, DAY, "Europe/Paris", calendarWords(t))).toBe("15:00 your time");
  });
});
