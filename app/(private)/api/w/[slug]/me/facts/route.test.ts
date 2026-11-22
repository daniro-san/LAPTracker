// What a member tells their officers about themselves (D154, issue 301), the member's side: only an approved
// link sends, only for its own uid; a repeat, a stale tab and a 21st send store nothing; a member who left
// or whose link waits again sends nothing and shows nothing. Officers' answers and the card are tested in
// members/[uid]/self-report/route.test.ts. Invented workspaces, members and values only.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { reportReviews, SENDS_PER_DAY } from "@/lib/private/self-report";
import { workspaceUsers } from "@/lib/schema";

import { ID, selfReportWorld } from "./self-report.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

let db: Db;
const world = selfReportWorld();
const { send, answer, rook, card, officerFact, roster, users, removeLink, ALPHA } = world;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await world.setUp(db);
  holder.ctx = testContext(db).ctx;
});

describe("a member tells their officers (D154)", () => {
  it("stores an approved member's send under their own link's uid only, and refuses a body that names a uid", async () => {
    const zone = { field: "timeZone", version: 0, value: "Europe/Lisbon" };
    expect((await send("alpha:Ana Invented", [zone], ID(1), { uid: 102 })).status).toBe(400);
    const sent = await send("alpha:Ana Invented", [zone]);
    expect(sent.status).toBe(200);
    expect(sent.body.reports).toMatchObject({
      timeZone: { version: 1, value: "Europe/Lisbon", seen: false },
    });
    // On Ana's card, and on nobody else's.
    expect((await card(101))?.selfReport?.unseen).toMatchObject([
      { field: "timeZone", version: 1 },
    ]);
    expect((await card(102))?.selfReport ?? null).toBeNull();
  });

  it("stores nothing from a pending link, no link, or a link an officer removed", async () => {
    const zone = [{ field: "timeZone", version: 0, value: "Europe/Lisbon" }];
    expect(await send("alpha:Bobby", zone)).toEqual({ status: 403, body: { code: "not_linked" } });
    expect(await send("alpha:Nobody", zone, ID(2))).toEqual({
      status: 403,
      body: { code: "not_linked" },
    });
    // An officer's Remove link (D142), through its own route.
    expect((await removeLink("alpha:Ana Invented", 101)).status).toBe(200);
    expect((await send("alpha:Ana Invented", zone, ID(3))).status).toBe(403);
    expect((await card(101))?.selfReport ?? null).toBeNull();
  });

  it("hides a member's report from the card and Home once their link is removed, and refuses its answer", async () => {
    await send("alpha:Ana Invented", [{ field: "adTech", version: 0, value: 72 }]);
    const members = new Map([[101, "Ana Invented"]]);
    expect(await reportReviews(db, await rook(), members)).toEqual([
      { uid: 101, player: "Ana Invented", fields: ["adTech"] },
    ]);
    // Dropped and claimed again: the link waits for an officer, so nothing of theirs shows.
    const ana = eq(workspaceUsers.id, users["alpha:Ana Invented"] ?? 0);
    await db.update(workspaceUsers).set({ playerLink: "pending" }).where(ana);
    expect((await card(101))?.selfReport ?? null).toBeNull();
    expect(await reportReviews(db, await rook(), members)).toEqual([]);
    await db
      .update(workspaceUsers)
      .set({ playerUid: null, playerLink: null, playerLinkedAt: null })
      .where(ana);
    expect((await card(101))?.selfReport ?? null).toBeNull();
    const seen = { action: "seen", user: users["alpha:Ana Invented"], field: "adTech", version: 1 };
    expect(await answer("alpha:Rook", 101, seen)).toEqual({
      status: 404,
      body: { code: "changed" },
    });
  });

  it("stores nothing for a member the newest roster no longer lists", async () => {
    await roster(ALPHA, "2026-11-07", [[102, "Bo Invented"]]);
    const zone = [{ field: "timeZone", version: 0, value: "Europe/Lisbon" }];
    expect(await send("alpha:Ana Invented", zone)).toEqual({ status: 409, body: { code: "left" } });
    expect((await card(102))?.selfReport ?? null).toBeNull();
  });

  it("answers a repeated request id as the first time and stores nothing new (D100)", async () => {
    const first = await send("alpha:Ana Invented", [{ field: "adTech", version: 0, value: 72 }]);
    const again = await send("alpha:Ana Invented", [{ field: "adTech", version: 1, value: 99 }]);
    expect(again).toEqual(first);
    expect((await card(101))?.selfReport?.unseen[0]?.says).toBe("Member says: 72%");
  });

  it("refuses the send after the 20th of a day, and does not count a repeat", async () => {
    for (let n = 1; n <= SENDS_PER_DAY; n++)
      expect(
        (await send("alpha:Ana Invented", [{ field: "adTech", version: n - 1, value: n }], ID(n)))
          .status,
      ).toBe(200);
    const over = await send(
      "alpha:Ana Invented",
      [{ field: "adTech", version: 20, value: 50 }],
      ID(99),
    );
    expect(over).toEqual({ status: 429, body: { code: "too_many" } });
    // The 20th send's id again: answered as stored, not refused.
    expect(
      (await send("alpha:Ana Invented", [{ field: "adTech", version: 19, value: 20 }], ID(20)))
        .status,
    ).toBe(200);
  });

  it("refuses a field another tab sent since and saves the others", async () => {
    await send("alpha:Ana Invented", [{ field: "adTech", version: 0, value: 55 }]);
    // The phone sent 60 over 55; the laptop's tab still shows version 1 and sends 65.
    await send("alpha:Ana Invented", [{ field: "adTech", version: 1, value: 60 }], ID(2));
    const stale = await send(
      "alpha:Ana Invented",
      [
        { field: "adTech", version: 1, value: 65 },
        { field: "languages", version: 0, value: ["pt", "en"] },
      ],
      ID(3),
    );
    expect(stale.status).toBe(409);
    expect(stale.body.reports).toMatchObject({
      adTech: { version: 2, value: 60 },
      languages: { version: 1, value: ["en", "pt"] },
    });
  });

  it("keeps a report seen when the member sends the same value again", async () => {
    await send("alpha:Ana Invented", [{ field: "adTech", version: 0, value: 72 }]);
    const seen = { action: "seen", user: users["alpha:Ana Invented"], field: "adTech", version: 1 };
    await answer("alpha:Rook", 101, seen);
    const again = await send(
      "alpha:Ana Invented",
      [{ field: "adTech", version: 1, value: 72 }],
      ID(2),
    );
    expect(again.body.reports).toMatchObject({ adTech: { version: 1, seen: true } });
  });

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
