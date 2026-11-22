// The public drilldowns on PGlite: a ledger count and the alliance page's member list it opens read the same
// event, so the people the list shows are the people the count counts. The ledger's joined / left come from
// SQL (`rosterChanges`), the list's marks from `rosterDiff`; War turnout's gainers from `killsTurnout`, the
// list's order from the URL's `sort=`.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { killsTurnout } from "@/lib/compute";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { getAllianceDetail, memberTurnout, rosterChanges } from "@/lib/queries";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "@/lib/schema";

import { filterFromUrl, filterMembers, memberViews, mightSteps } from "./member-views";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

// KvK Saturday: Before 10:00 ST, After 14:00 ST (server time UTC−2).
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00Z`);
const UNION = 67111040;

type Member = { uid: number; name: string; kills: number | null };

/** One phase of the event for the alliance, fresh, with its members. */
async function phase(eventId: number, which: "before" | "after", time: string, list: Member[]) {
  const [snap] = await db
    .insert(snapshots)
    .values({ eventId, phase: which, startedAt: at(time), status: "complete" })
    .returning({ id: snapshots.id });
  const snapshotId = (snap as { id: number }).id;
  const [row] = await db
    .insert(allianceSnapshots)
    .values({
      snapshotId,
      unionId: UNION,
      tag: "LNK",
      name: "Lantern Keep",
      memberCount: list.length,
      totalPower: list.length * 30_000_000,
      totalKills: list.reduce((t, m) => t + (m.kills ?? 0), 0),
      source: "v1",
      isFresh: true,
      sourceUpdatedAt: at(time),
    })
    .returning({ id: allianceSnapshots.id });
  const allianceSnapshotId = (row as { id: number }).id;
  await db
    .insert(memberSnapshots)
    .values(list.map((m) => ({ allianceSnapshotId, ...m, power: 30_000_000, lv: 25 })));
  return { id: snapshotId, phase: which };
}

/** A Saturday event with the two rosters; the ids of its two snapshots. */
async function event(before: Member[], after: Member[]) {
  const [ev] = await db
    .insert(events)
    .values({
      name: "Saturday Event",
      eventAtUtc: at("14:00"),
      allianceIds: [UNION],
      beforeAt: at("12:00"),
      afterAt: at("16:00"),
    })
    .returning({ id: events.id });
  const eventId = (ev as { id: number }).id;
  const b = await phase(eventId, "before", "12:00", before);
  const a = await phase(eventId, "after", "16:00", after);
  return { eventId, b, a, snapshots: [b, a] };
}

/** The alliance page's member list as the URL `query` opens it: the uids in the order shown. */
async function listed(eventId: number, query: { show?: string; sort?: string }) {
  const detail = await getAllianceDetail(db, eventId, UNION);
  if (!detail) throw new Error("no alliance detail");
  const views = memberViews(detail.membersBefore, detail.membersAfter);
  const steps = mightSteps(views);
  const start = filterFromUrl(query, { canDelta: true, compared: true }, views);
  const f = { ...start, name: "", lo: 0, hi: steps.length - 1 };
  return { detail, uids: filterMembers(views, f, steps, true).map((m) => m.uid) };
}

describe("a ledger count opens exactly those members", () => {
  it("lists the members the ledger counts as joined and as left, and a member renamed in between in neither", async () => {
    const { eventId, b, a } = await event(
      [
        { uid: 4101, name: "Ada Quill", kills: 1_200_000 },
        { uid: 4102, name: "Bram Ashford", kills: 900_000 },
        { uid: 4103, name: "Cora Vell", kills: 800_000 },
        { uid: 4104, name: "Dain Moss", kills: 700_000 },
      ],
      [
        { uid: 4101, name: "Ada Quill", kills: 1_260_000 },
        // Same uid, new name: stayed (issue 676).
        { uid: 4103, name: "Cora Vellwind", kills: 830_000 },
        { uid: 4105, name: "Esme Rook", kills: 2_400_000 },
        { uid: 4106, name: "Fenn Hollow", kills: 300_000 },
        { uid: 4107, name: "Gil Marsh", kills: 150_000 },
      ],
    );
    const change = (await rosterChanges(db, eventId, { before: b.id, after: a.id })).get(UNION);

    const joined = await listed(eventId, { show: "joined" });
    const left = await listed(eventId, { show: "left" });

    expect(new Set(joined.uids)).toEqual(new Set([4105, 4106, 4107]));
    expect(new Set(left.uids)).toEqual(new Set([4102, 4104]));
    expect(change && [change.joined, change.left]).toEqual([joined.uids.length, left.uids.length]);
    expect([...joined.uids, ...left.uids]).not.toContain(4103);
  });
});

describe("War turnout and Kill share open the list by kills gained", () => {
  it("puts War turnout's gainers first, in the list sorted by the URL's kills change, a null kills at Start counting as 0 (D15)", async () => {
    const { eventId, snapshots: ids } = await event(
      [
        { uid: 4201, name: "Hale Brisk", kills: 1_000_000 },
        { uid: 4202, name: "Ivo Thorn", kills: 2_000_000 },
        // Unknown kills at Start (D15): War turnout counts the End's figure as gained.
        { uid: 4203, name: "Jory Fen", kills: null },
        { uid: 4204, name: "Kit Lark", kills: 500_000 },
        { uid: 4205, name: "Lio Penn", kills: 800_000 },
      ],
      [
        { uid: 4201, name: "Hale Brisk", kills: 1_090_000 },
        { uid: 4202, name: "Ivo Thorn", kills: 2_030_000 },
        { uid: 4203, name: "Jory Fen", kills: 40_000 },
        // Unchanged, then a fall: neither is a gain.
        { uid: 4204, name: "Kit Lark", kills: 500_000 },
        { uid: 4205, name: "Lio Penn", kills: 790_000 },
        // Joined with lifetime kills: not in both rosters, never a gainer.
        { uid: 4206, name: "Mara Voss", kills: 9_000_000 },
      ],
    );
    const lists = await memberTurnout(db, ids);
    const turnout = lists?.withKills.find((t) => t.unionId === UNION);

    const { detail, uids } = await listed(eventId, { sort: "killsDelta" });
    const { gainerUids } = killsTurnout(detail.membersBefore, detail.membersAfter);

    expect(turnout?.gainers).toBe(3);
    expect(uids.slice(0, turnout?.gainers)).toEqual(gainerUids);
    expect(gainerUids).toEqual([4201, 4203, 4202]);
  });
});
