// Drilldown on Raid prep and the Roll call list (2026-11-22) against a real Postgres (PGlite), built as the
// pages build them: "To remind: n" and "Mark ✓ the n seen with a shield" each show exactly the members they
// count, and a Roll call card's counts open chips that count the same members. One Raid prep: five members,
// both checks read, one away on raid day. Names are invented.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { fill } from "@/lib/copy";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { saveFacts } from "@/lib/private/member-facts";
import { prepView } from "@/lib/private/raid-prep";
import { addCall, markOne, markRest, openOccasion } from "@/lib/private/roll-call";
import type { Mark } from "@/lib/private/roll-call-rules";
import { callRead, weekItems } from "@/lib/private/roll-call-view";
import { createSession } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";
import { playerReads } from "@/lib/schema-squads";

import { prepHead, prepRows } from "./prep-data";
import { toAccept, toRemind } from "./prep-message";
import { markRows, rollCard } from "./roll-call-data";
import { gridCounts } from "./roll-call-grid";

const OGS = 67111155;
/** Saturday 10:30 ST (UTC−2), after both checks. */
const NOW = new Date("2026-11-21T12:30:00Z");
const ZONE = "Etc/GMT+2";
const t = WORKSPACE_DICTIONARIES.en;
const NAMES: Record<number, string> = {
  101: "Aster Vale",
  102: "Briar Holt",
  103: "Cedar Moss",
  104: "Dove Lark",
  105: "Elm Reed",
};
const UIDS = Object.keys(NAMES).map(Number);
const at = (iso: string) => new Date(iso);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(dailyReads).values({ day: "2026-11-20", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-20",
    unionId: OGS,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: UIDS,
    memberNames: UIDS.map((u) => NAMES[u] as string),
    memberPower: UIDS.map(() => 1000),
    memberKills: UIDS.map(() => 0),
  });
  // Night check, Fri 23:31 ST: 101 and 102 seen with a shield, 103 not seen; 104 and 105 not read.
  const night = { unionId: OGS, readAt: at("2026-11-21T01:31:00Z"), shieldType: 0 };
  const map = at("2026-11-21T00:32:00Z");
  await db.insert(playerReads).values([
    { ...night, uid: 101, shielding: 1, mapUpdatedAt: map },
    { ...night, uid: 102, shielding: 1, mapUpdatedAt: map },
    { ...night, uid: 103, shielding: 0, mapUpdatedAt: map },
    { ...night, uid: 105, shielding: 0, mapUpdatedAt: map },
  ]);
  // Morning check, Sat 10:04 ST: 101 still seen, 102's shield gone.
  const morning = { unionId: OGS, readAt: at("2026-11-21T12:04:00Z"), shieldType: 0 };
  await db.insert(playerReads).values([
    { ...morning, uid: 101, shielding: 1, mapUpdatedAt: at("2026-11-21T10:10:00Z") },
    { ...morning, uid: 102, shielding: 0, mapUpdatedAt: at("2026-11-21T11:40:00Z") },
  ]);
});

async function officer() {
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const [user] = await db
    .insert(workspaceUsers)
    .values({
      workspaceId: ws?.id ?? 0,
      discordUserId: "ogs-ana",
      displayName: "Ana",
      lastLoginAt: NOW,
    })
    .returning({ id: workspaceUsers.id });
  const { token } = await createSession(db, ws?.id ?? 0, user?.id ?? 0, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/**
 * Saturday's Raid prep with these Shield taps and "the rest" ("no problem seen") for `rest`, 105 away from
 * Friday to Sunday, read as its page reads it.
 */
async function raidPrep(marks: Record<number, "yes" | "no">, rest: number[] = []) {
  const access = await officer();
  const away = { text: "trip", from: "2026-11-20", until: "2026-11-22" };
  await saveFacts(
    db,
    access,
    105,
    [{ field: "away", version: 0, value: away, source: "officer" }],
    NOW,
  );
  const occasion = await addCall(db, access, { kind: "shield", day: "2026-11-21" }, randomUUID());
  for (const [uid, mark] of Object.entries(marks)) {
    await markOne(db, access, { occasion, uid: Number(uid), mark, version: 0 }, NOW);
  }
  if (rest.length > 0)
    await markRest(db, access, { occasion, uids: rest }, { now: NOW, zone: ZONE });
  const read = await callRead(db, access, occasion, "en", ZONE);
  const opened = await openOccasion(db, access, occasion);
  if (!read || !opened) throw new Error("no roll call");
  const view = await prepView(db, access, opened, { zone: ZONE, now: NOW }, read.loaded);
  const rows = markRows(read.view.rows, { t, language: "en" });
  // The page's own split: away members are apart, never asked.
  const asked = rows.filter((row) => row.away === null);
  return { access, occasion, asked, prep: prepRows(view, t, ZONE), head: prepHead(view, t, ZONE) };
}

const markOf = (asked: { uid: number; mark: Mark | null }[]) => (uid: number) =>
  asked.find((row) => row.uid === uid)?.mark ?? null;

describe("drilldown on Raid prep and the Roll call list", () => {
  it("To remind shows exactly the members it counts: ✗, and not set with no shield seen", async () => {
    const { asked, prep } = await raidPrep({ 103: "no" });
    const remind = toRemind(asked, markOf(asked), (uid) => prep[uid]?.tracker?.on === true);
    // 101 was seen with a shield this morning; 105 is away. In the rows' order (not set first); the count
    // is the list's length.
    expect(remind.map((row) => row.name)).toEqual(["Briar Holt", "Dove Lark", "Cedar Moss"]);
    expect(fill(t["roll.prep.remind"], { n: remind.length })).toBe("To remind: 3");
  });

  it("Mark ✓ the n seen with a shield shows exactly the members it would mark", async () => {
    // 102 was seen at night but not this morning: the newest reading decides.
    const { asked, head } = await raidPrep({});
    const notSet = asked.filter((row) => row.mark === null);
    const accept = toAccept(notSet, head.seen);
    expect(accept.map((row) => row.name)).toEqual(["Aster Vale"]);
    expect(head.seen).toEqual([101]);
  });

  it("a Roll call card's counts open chips that count the same members, away left out", async () => {
    const { access, occasion, asked } = await raidPrep({ 101: "yes", 103: "no" }, [102]);
    const [item] = await weekItems(db, access, "2026-11-16", ZONE);
    if (!item) throw new Error("no card");
    const card = rollCard(item, "ogs", "2026-11-21", { t, language: "en", zone: ZONE });
    const mark = `/w/ogs/roll-call/mark?id=${"id" in occasion ? occasion.id : 0}`;
    expect(card.counts).toEqual([
      { text: "3 of 4 marked", href: null },
      { text: "Shield up 1 · No problem seen 1", href: `${mark}&filter=yes` },
      { text: "No shield 1", href: `${mark}&filter=no` },
      { text: "Not set 1", href: `${mark}&filter=todo` },
      { text: "Away 1", href: null },
    ]);
    // The marking page's chips, on the same roll call: ✓ 2, ✗ 1, To mark 1.
    const chips = gridCounts(
      asked.map((row) => row.uid),
      markOf(asked),
    );
    expect(chips).toMatchObject({ yes: 2, no: 1, todo: 1 });
    const { tally } = item;
    expect({ yes: tally.yes + tally.assumed, no: tally.no, todo: tally.notSet }).toEqual({
      yes: chips.yes,
      no: chips.no,
      todo: chips.todo,
    });
  });
});
