// An officer answers what a member sent about themselves (D154, issue 301): the officers' value is never
// overwritten, only "Put on the card" writes a fact (source "member"), named by the fact version the card
// showed; "Seen, keep the card" changes nothing on the card; an answer reaches only the report it saw; and
// the card labels the member's value apart from the card's own. Invented workspaces, members and values.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { factsOf } from "@/lib/private/member-facts";

import { ID, selfReportWorld } from "../../../me/facts/self-report.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// The real read of a fact's version, with a hook that runs right after it: another officer's save landing
// between "Put on the card"'s read and its write (review of PR 684).
const race = vi.hoisted(() => ({ after: null as null | (() => Promise<unknown>) }));
vi.mock("@/lib/repo/member-facts", async (original) => {
  const real = await original<typeof import("@/lib/repo/member-facts")>();
  return {
    ...real,
    factVersion: async (...args: Parameters<typeof real.factVersion>) => {
      const row = await real.factVersion(...args);
      const after = race.after;
      race.after = null;
      if (after) await after();
      return row;
    },
  };
});

let db: Db;
const world = selfReportWorld();
const { send, answer, rook, card, officerFact, users } = world;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await world.setUp(db);
  holder.ctx = testContext(db).ctx;
});

describe("an officer answers a member's report (D154)", () => {
  it("never overwrites the officers' value: only Put on the card writes it, from the member", async () => {
    await officerFact(101, "timeZone", "Europe/London");
    await send("alpha:Ana Invented", [{ field: "timeZone", version: 0, value: "Europe/Lisbon" }]);
    // Nothing reads the report as a fact (D75): Members, Follow-up, roll calls … still see London.
    expect((await factsOf(db, await rook())).get(101)?.timeZone).toMatchObject({
      value: "Europe/London",
      source: "officer",
    });
    const line = (await card(101))?.selfReport?.unseen[0];
    expect(line).toMatchObject({
      onCard: "On the card: Europe/London · UTC+0",
      same: false,
      factVersion: 1,
    });
    const use = {
      action: "use",
      user: users["alpha:Ana Invented"],
      field: "timeZone",
      version: 1,
      factVersion: 1,
    };
    expect(await answer("alpha:Rook", 101, use)).toEqual({ status: 200, body: { ok: true } });
    expect((await factsOf(db, await rook())).get(101)?.timeZone).toMatchObject({
      value: "Europe/Lisbon",
      source: "member",
      version: 2,
    });
    expect((await card(101))?.selfReport ?? null).toBeNull();
  });

  it("refuses Put on the card when another officer saved that fact since, languages too", async () => {
    await send("alpha:Ana Invented", [{ field: "languages", version: 0, value: ["fr"] }]);
    await officerFact(101, "languages", ["en"]);
    const use = {
      action: "use",
      user: users["alpha:Ana Invented"],
      field: "languages",
      version: 1,
      factVersion: 0,
    };
    const refused = await answer("alpha:Rook", 101, use);
    expect(refused).toMatchObject({
      status: 409,
      body: { field: "languages", version: 1, value: ["en"] },
    });
    expect((await factsOf(db, await rook())).get(101)?.languages?.value).toEqual(["en"]);
    expect((await card(101))?.selfReport?.unseen).toHaveLength(1);
  });

  it("refuses Put on the card when another officer's save lands between its read and its write, and stores nothing", async () => {
    await send("alpha:Ana Invented", [{ field: "languages", version: 0, value: ["fr"] }]);
    const use = {
      action: "use",
      user: users["alpha:Ana Invented"],
      field: "languages",
      version: 1,
      factVersion: 0,
    };
    // The card showed no languages; an officer saves English just after the route reads the version.
    race.after = () => officerFact(101, "languages", ["en"]);
    const refused = await answer("alpha:Rook", 101, use);
    expect(refused).toMatchObject({
      status: 409,
      body: { field: "languages", version: 1, value: ["en"] },
    });
    // No combined list, no "from the member" version, and the report still waits.
    expect((await factsOf(db, await rook())).get(101)?.languages).toMatchObject({
      value: ["en"],
      source: "officer",
      version: 1,
    });
    expect((await card(101))?.selfReport?.unseen).toMatchObject([
      { field: "languages", version: 1 },
    ]);
  });

  it("refuses Put on the card for what the member took back, and lets an officer mark it seen", async () => {
    await officerFact(101, "adTech", 70);
    await send("alpha:Ana Invented", [{ field: "adTech", version: 0, value: 72 }]);
    const took = await send(
      "alpha:Ana Invented",
      [{ field: "adTech", version: 1, value: null }],
      ID(2),
    );
    expect(took.body.reports).toMatchObject({ adTech: { version: 2, value: null, seen: false } });
    expect((await card(101))?.selfReport?.unseen).toMatchObject([
      { field: "adTech", says: "Member took back what they sent", removed: true },
    ]);
    const report = { user: users["alpha:Ana Invented"], field: "adTech", version: 2 };
    expect(await answer("alpha:Rook", 101, { action: "use", ...report, factVersion: 1 })).toEqual({
      status: 409,
      body: { code: "removed" },
    });
    expect((await factsOf(db, await rook())).get(101)?.adTech?.value).toBe(70);
    expect((await answer("alpha:Rook", 101, { action: "seen", ...report })).status).toBe(200);
    expect((await card(101))?.selfReport ?? null).toBeNull();
  });

  it("marks a report seen without changing the card, and finds nothing once the member sent again", async () => {
    await officerFact(101, "adTech", 70);
    await send("alpha:Ana Invented", [{ field: "adTech", version: 0, value: 72 }]);
    await send("alpha:Ana Invented", [{ field: "adTech", version: 1, value: 74 }], ID(2));
    const old = { action: "seen", user: users["alpha:Ana Invented"], field: "adTech", version: 1 };
    expect(await answer("alpha:Rook", 101, old)).toEqual({
      status: 404,
      body: { code: "changed" },
    });
    expect(await answer("alpha:Rook", 101, { ...old, version: 2 })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await factsOf(db, await rook())).get(101)?.adTech?.value).toBe(70);
    // Seen: out of the header, said once under the fact on the Info tab.
    expect((await card(101))?.selfReport).toMatchObject({
      unseen: [],
      info: { adTech: "Member says: 74% · Sat, Nov 7 · not on the card" },
    });
  });

  it("lets no member and no officer of another workspace answer a report", async () => {
    await send("alpha:Ana Invented", [{ field: "adTech", version: 0, value: 72 }]);
    const seen = { action: "seen", user: users["alpha:Ana Invented"], field: "adTech", version: 1 };
    expect((await answer("alpha:Ana Invented", 101, seen)).status).toBe(401);
    expect((await answer("bravo:Vale Officer", 101, seen)).status).toBe(401);
    expect((await answer("bravo:Vale Officer", 101, seen, "bravo")).status).toBe(404);
    expect((await card(101))?.selfReport?.unseen).toHaveLength(1);
  });
});

describe("the member card's self-report block (D154)", () => {
  it("labels what the member says apart from what the card holds, with the day and the answers' words", async () => {
    await send("alpha:Ana Invented", [
      { field: "timeZone", version: 0, value: "Europe/Lisbon" },
      { field: "languages", version: 0, value: ["pt"] },
    ]);
    await officerFact(101, "languages", ["pt"]);
    const report = (await card(101))?.selfReport;
    expect(report?.unseen).toEqual([
      expect.objectContaining({
        label: "Time zone",
        says: "Member says: Europe/Lisbon · UTC+0",
        sent: "Self-reported · Sat, Nov 7",
        onCard: "On the card: nothing yet",
        same: false,
      }),
      expect.objectContaining({ label: "Languages", says: "Member says: Portuguese", same: true }),
    ]);
    expect(report?.words["self.card.use"]).toBe("Put on the card");
    expect(report?.words["self.card.seen"]).toBe("Seen, keep the card");
  });
});
