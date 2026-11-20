// "Request a Desk" (D130, issue 453): the name is matched against the alliance's newest roster for the owner
// (rank and date kept, nothing else), never blocking; a few a day per address; an alliance with a workspace is
// told so; once approved, the request's own status secret opens the invite. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { createInvite, decideRequest } from "../repo/alliance-invites";
import { dailyReads, dailyRosters, workspaces } from "../schema";
import { accessRequests } from "../schema-invites";
import { continueRequest, PER_IP_DAY, requestView, submitRequest } from "./access-request";
import { inviteFrom } from "./invite";
import { WACK } from "./invite.test-helpers";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** WACK's daily roster: one R4 with a title; x, y and online present, as the tracker sends them. */
async function seedWackRoster() {
  await db.insert(dailyReads).values({ day: "2026-11-19", startedAt: T0, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-19",
    unionId: WACK,
    memberCount: 1,
    sourceUpdatedAt: new Date("2026-11-19T21:30:00Z"),
    isFresh: true,
    memberUids: [501],
    memberNames: ["Vellamo Rook"],
    memberPower: [5_000_000],
    memberKills: [100],
    rawJson: {
      members: [
        {
          uid: 501,
          rank_code: 104,
          rank_label: "R4 · Recruiter",
          x: 98765,
          y: 54321,
          online: true,
        },
      ],
    },
  });
}

const ask = (name: string, ip = "203.0.113.20") =>
  submitRequest(db, { union_id: WACK, name, role: "r4" }, ip, T0);

describe("Request a Desk (D130)", () => {
  it("keeps what the roster says of the name, and only that; an unknown name still goes through", async () => {
    await seedWackRoster();
    const found = await ask("vellamo rook");
    expect(found).toMatchObject({ ok: true, match: "found" });
    const missing = await ask("Nobody Here");
    expect(missing).toMatchObject({ ok: true, match: "not_found" });
    const rows = await db.select().from(accessRequests);
    expect(
      rows.map((r) => [r.rosterMatch, r.rosterRank, r.rosterSeenAt?.toISOString() ?? null]),
    ).toEqual([
      ["found", "R4 · Recruiter", "2026-11-19T21:30:00.000Z"],
      ["not_found", null, null],
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/98765|54321|online/);
  });

  it("takes a few a day from one address, and none for an alliance that has a workspace", async () => {
    for (let i = 0; i < PER_IP_DAY; i++) expect((await ask(`Name ${i}`)).ok).toBe(true);
    expect(await ask("One more")).toEqual({ ok: false, code: "rate_limited" });
    expect((await ask("Other address", "203.0.113.21")).ok).toBe(true);
    await createInvite(db, WACK, T0);
    await db.insert(workspaces).values({
      unionId: WACK,
      slug: "wack",
      discordGuildId: "700000000000000101",
      leaderRoleIds: [],
    });
    expect(await ask("Late", "203.0.113.22")).toEqual({ ok: false, code: "has_desk" });
  });

  it("shows the requester its answer, and once approved its status secret opens the invite", async () => {
    const sent = await ask("Vellamo Rook");
    if (!sent.ok) throw new Error("refused");
    expect(await requestView(db, sent.credential)).toMatchObject({ state: "waiting" });
    expect(await continueRequest(db, sent.credential, T0)).toBeNull();
    const [row] = await db.select().from(accessRequests);
    const invite = await createInvite(db, WACK, T0);
    await decideRequest(db, row?.id ?? 0, { decision: "approved", inviteId: invite.id }, T0);
    expect(await requestView(db, sent.credential)).toMatchObject({ state: "approved" });
    const cookie = await continueRequest(db, sent.credential, T0);
    const value = cookie?.split(";")[0]?.split("=")[1];
    expect((await inviteFrom(db, value))?.id).toBe(invite.id);
  });
});
