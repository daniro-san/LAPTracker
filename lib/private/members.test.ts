import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { scheduledEventKills } from "../repo/workspace-rosters";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  snapshots,
} from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { saveFacts, type FactChange } from "./member-facts";
import { KVK_REASON_ON } from "./member-week";
import { killsGained, membersView, rankOf, type MemberRow } from "./members";
import { whoOf } from "./members-list";
import { statusOf } from "./members-sheet";
import { createSession } from "./session";

const OGS = 67111155;
const NSE = 67109944;
const NOW = new Date("2026-11-16T12:00:00Z");
const ZONE = "Etc/GMT+2";
const DAY = 86_400_000;
const dayOf = (n: number) => new Date(Date.UTC(2026, 10, 9) + n * DAY).toISOString().slice(0, 10);
/** A member on an end-of-day read with no daily quests and no donations that day (D127). */
const NONE = { tech: null, active: null };

/** uid → the roster fields the read keeps; a member's might and kills arrays come from the same values. */
type Members = Record<number, { tech?: number | null; active?: number | null; power?: number }>;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: NSE, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] });
});

/** A signed-in officer's access to the workspace `slug`, made the way a sign-in makes it. */
async function signedIn(slug: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `officer-${slug}`, "Officer", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

/** One alliance's end-of-day read on server day `day` (D72): the member arrays and raw_json, plus
 * `extra` raw members as the upstream might send them. */
async function endOfDay(unionId: number, day: string, members: Members, extra: object[] = []) {
  const uids = Object.keys(members).map(Number);
  const at = new Date(`${day}T23:37:00-02:00`);
  await db
    .insert(dailyReads)
    .values({ day, startedAt: at, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    memberCount: uids.length,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map((u) => members[u]?.power ?? 1000),
    memberKills: uids.map(() => 0),
    rawJson: {
      members: [
        ...uids.map((uid) => ({
          uid,
          nick_name: `P${uid}`,
          power: members[uid]?.power ?? 1000,
          lv: 25,
          rank_code: 103,
          rank_label: "R3",
          daily_tech: members[uid]?.tech ?? null,
          active:
            members[uid]?.active === undefined ? 10 + Number(day.slice(8)) : members[uid].active,
          avatar_url: "https://phs-image.globallap.com/a.png",
        })),
        ...extra,
      ],
    },
  });
}

describe("the Members tab, between two workspaces (D71)", () => {
  it("shows a player who moved to the old alliance only up to the move, and to the new one only after it", async () => {
    // Player 900 donates in OGs on Monday and Tuesday, then moves to NSE and donates there.
    await endOfDay(OGS, dayOf(0), { 1: { tech: 50 }, 900: { tech: 500 } });
    await endOfDay(OGS, dayOf(1), { 1: { tech: 50 }, 900: { tech: 600 } });
    await endOfDay(NSE, dayOf(0), { 2: { tech: 70 } });
    await endOfDay(NSE, dayOf(1), { 2: { tech: 70 } });
    const [ogs, nse] = [await signedIn("ogs"), await signedIn("nse")];

    const before = await membersView(db, ogs, NOW, ZONE);
    expect(before.members.find((m) => m.uid === 900)?.donations.slice(0, 2)).toEqual([500, 600]);

    await endOfDay(OGS, dayOf(2), { 1: { tech: 50 } });
    await endOfDay(OGS, dayOf(3), { 1: { tech: 50 } });
    await endOfDay(NSE, dayOf(2), { 2: { tech: 70 }, 900: { tech: 700 } });
    await endOfDay(NSE, dayOf(3), { 2: { tech: 70 }, 900: { tech: 800 } });

    const [old, now] = [
      await membersView(db, ogs, NOW, ZONE),
      await membersView(db, nse, NOW, ZONE),
    ];
    expect(old.members.map((m) => m.uid)).toEqual([1]);
    const moved = now.members.find((m) => m.uid === 900);
    // NSE sees none of the OGs days, counts only its own, and sees the player as new since Wednesday.
    expect(moved?.donations).toEqual([null, null, 700, 800, "later", "later", "later"]);
    expect(moved?.weekTotal).toBe(1500);
    expect(moved?.seenSince).toBe(dayOf(2));
    expect(moved?.isNew).toBe(true);
    expect(JSON.stringify(now)).not.toContain("avatar");
  });
});

/** A scheduled event on Saturday with Start and End rosters of OGs: uid → [kills before, kills after]. */
async function kvk(kills: Record<number, [number | null, number | null]>) {
  const at = new Date("2026-11-14T14:00:00Z");
  const [event] = await db
    .insert(events)
    .values({ name: "Saturday", eventAtUtc: at, allianceIds: [OGS], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  for (const [i, phase] of (["before", "after"] as const).entries()) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: snap?.id ?? 0,
        unionId: OGS,
        tag: "OGs",
        source: "v1",
        isFresh: true,
        memberCount: 3,
        sourceUpdatedAt: at,
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      Object.entries(kills).map(([uid, k]) => ({
        allianceSnapshotId: row?.id ?? 0,
        uid: Number(uid),
        name: `P${uid}`,
        lv: 25,
        power: 1000,
        kills: k[i] ?? null,
      })),
    );
  }
}

describe("Check in reasons (D75)", () => {
  it("finds who gained no kills in the week's scheduled event, and holds that reason until away notes exist", async () => {
    await endOfDay(OGS, dayOf(5), { 1: { tech: 5 }, 2: { tech: 5 }, 3: { tech: 5 } });
    await kvk({ 1: [100, 100], 2: [100, 150], 3: [null, 100] });

    const event = await scheduledEventKills(db, OGS, new Date(NOW.getTime() - 7 * 86_400_000));
    const view = await membersView(db, await signedIn("ogs"), NOW, ZONE);

    expect(event?.at).toEqual(new Date("2026-11-14T14:00:00Z"));
    // Kills gained, and kills unknown at the Start (which never counts), are not "no kills gained".
    expect([1, 2, 3].map((uid) => killsGained(event, uid))).toEqual([0, 50, null]);
    expect(KVK_REASON_ON).toBe(false);
    expect(view.members.flatMap((m) => m.reasons)).toEqual([]);
  });

  it("lists D70's might unchanged as a reason, and a member whose might grew as fine", async () => {
    // 16 daily reads (days −14 … 1): member 1's might never moves; member 2's grows every day.
    for (let n = -14; n <= 1; n++)
      await endOfDay(OGS, dayOf(n), { 1: { tech: 5, power: 800 }, 2: { tech: 5, power: 900 + n } });

    const view = await membersView(db, await signedIn("ogs"), NOW, ZONE);

    const reasons = new Map(view.members.map((m) => [m.uid, m.reasons]));
    expect(reasons.get(1)).toEqual([{ kind: "might", days: 15 }]);
    expect(reasons.get(2)).toEqual([]);
  });
});

/** An officer's write of one fact, as the card's editor sends it. */
const fact = (access: WorkspaceAccess, uid: number, change: FactChange) =>
  saveFacts(db, access, uid, [change], NOW);

describe("member facts on the Members tab (#297)", () => {
  it("puts a member with an away note that still runs on a break: no reasons, no thanks", async () => {
    // Members 1 and 2 donated on Monday, then had no quests and no donations on 3 end-of-day reads.
    // Member 3 is new (first seen Tuesday) with the same 3 reads.
    await endOfDay(OGS, dayOf(0), { 1: { tech: 900, active: 50 }, 2: { tech: 5, active: 50 } });
    for (const n of [1, 2, 3]) await endOfDay(OGS, dayOf(n), { 1: NONE, 2: NONE, 3: NONE });
    const ogs = await signedIn("ogs");
    const away = { text: "travelling", until: "2026-11-20" };
    await fact(ogs, 1, { field: "away", version: 0, value: away, source: "officer" });

    const view = await membersView(db, ogs, NOW, ZONE);
    const [one, two] = [1, 2].map((uid) => view.members.find((m) => m.uid === uid) as MemberRow);

    expect([one?.awayUntil, one?.reasons, statusOf(one as MemberRow)]).toEqual([
      "2026-11-20",
      [],
      "break",
    ]);
    expect(two?.reasons).toEqual([{ kind: "idle", days: 3 }]);
    // D127: a new member never gets the offline signal.
    expect(view.members.find((m) => m.uid === 3)).toMatchObject({ isNew: true, reasons: [] });
    // The thanks use the week (D127): Monday's donations and quest points count on Thursday.
    expect(view.thanks.donors.map((t) => t.uid)).toEqual([2]);
    expect(view.thanks.activity).toEqual([{ uid: 2, name: "P2", value: 50 }]);
  });

  it("shows an officer's status instead of the computed one; On a break also clears reasons and thanks", async () => {
    // All three donated on Monday (2 the most), then had no quests and no donations on 3 reads.
    const monday = (tech: number) => ({ tech, active: 50 });
    await endOfDay(OGS, dayOf(0), { 1: monday(900), 2: monday(5000), 3: monday(5) });
    for (const n of [1, 2, 3]) await endOfDay(OGS, dayOf(n), { 1: NONE, 2: NONE, 3: NONE });
    const ogs = await signedIn("ogs");
    await fact(ogs, 1, { field: "status", version: 0, value: "help", source: "officer" });
    await fact(ogs, 2, { field: "status", version: 0, value: "break", source: "officer" });

    const view = await membersView(db, ogs, NOW, ZONE);
    const row = (uid: number) => view.members.find((m) => m.uid === uid) as MemberRow;

    expect([1, 2, 3].map((uid) => statusOf(row(uid)))).toEqual(["help", "break", "checkin"]);
    expect([1, 2, 3].map((uid) => row(uid).reasons.length)).toEqual([1, 0, 1]);
    expect(view.members.filter((m) => whoOf(m).includes("checkin")).length).toBe(1);
    expect(view.thanks.donors.map((t) => t.uid)).toEqual([1, 3]);
  });
});

/** A public event's Start roster of one alliance at `at`: uid → [name, rank code, Sanctuary]. */
async function eventRoster(
  unionId: number,
  at: Date,
  rows: Record<number, [string, number, number]>,
) {
  const [event] = await db
    .insert(events)
    .values({ name: "Saturday", eventAtUtc: at, allianceIds: [unionId], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  const [snap] = await db
    .insert(snapshots)
    .values({ eventId: event?.id ?? 0, phase: "before", startedAt: at, status: "complete" })
    .returning({ id: snapshots.id });
  const [row] = await db
    .insert(allianceSnapshots)
    .values({
      snapshotId: snap?.id ?? 0,
      unionId,
      source: "v1",
      isFresh: true,
      memberCount: 2,
      sourceUpdatedAt: at,
    })
    .returning({ id: allianceSnapshots.id });
  await db.insert(memberSnapshots).values(
    Object.entries(rows).map(([uid, [name, rankCode, lv]]) => ({
      allianceSnapshotId: row?.id ?? 0,
      uid: Number(uid),
      name,
      power: 2000 + Number(uid),
      kills: 0,
      lv,
      rankCode,
      rankLabel: `R${rankCode - 100}`,
    })),
  );
}

describe("before the alliance's first end-of-day read", () => {
  it("lists its newest roster of any kind, computes nothing from it, and works for any workspace", async () => {
    // OGs: Saturday's Start roster, then Sunday's daily read from before D72 (no end-of-day fields).
    await eventRoster(OGS, new Date("2026-11-14T12:00:00Z"), {
      1: ["P1", 104, 26],
      2: ["P2", 103, 24],
    });
    await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
    const sunday = new Date("2026-11-15T08:00:00Z");
    await db.insert(dailyRosters).values({
      readDay: "2026-11-15",
      unionId: OGS,
      memberCount: 3,
      sourceUpdatedAt: sunday,
      isFresh: true,
      memberUids: [1, 2, 3],
      memberNames: ["P1", "P2", "P3"],
      memberPower: [1100, 1200, 1300],
      memberKills: [0, 0, 0],
    });
    // NSE: one public roster snapshot and nothing else.
    await eventRoster(NSE, new Date("2026-11-14T13:00:00Z"), {
      7: ["N7", 105, 30],
      8: ["N8", 101, 20],
    });

    const [ogs, nse] = [
      await membersView(db, await signedIn("ogs"), NOW, ZONE),
      await membersView(db, await signedIn("nse"), NOW, ZONE),
    ];

    expect([ogs.early, ogs.readAt]).toEqual([true, sunday]);
    // Sanctuary and rank from Saturday's roster; P3 joined after it, so "—".
    expect(ogs.members.map((m) => [m.uid, m.rank, m.sanctuary, m.might])).toEqual([
      [1, "R4", 26, 1100],
      [2, "R3", 24, 1200],
      [3, null, null, 1300],
    ]);
    const blank = ogs.members.every(
      (m) =>
        m.donations.every((d) => d === null) &&
        m.weekTotal === null &&
        m.activity === null &&
        statusOf(m) === "none",
    );
    expect(blank).toBe(true);
    expect(ogs.members.flatMap(whoOf)).toEqual([]);
    expect(nse.members.map((m) => [m.uid, m.rank, m.sanctuary])).toEqual([
      [7, "R5", 30],
      [8, "R1", 20],
    ]);
  });
});

describe("the roster read", () => {
  it("leaves out a member the upstream sent without a uid, instead of listing a member 0", async () => {
    await endOfDay(OGS, dayOf(0), { 1: { tech: 5 } }, [{ nick_name: "Ghost" }, { uid: null }]);

    const view = await membersView(db, await signedIn("ogs"), NOW, ZONE);

    expect(view.members.map((m) => m.uid)).toEqual([1]);
  });

  it("shows an R4's title by the game's name, and other ranks as R1 … R5", () => {
    expect(rankOf({ rankCode: 104, rankLabel: "R4 · Overseer" })).toBe("R4 · Goddess");
    expect(rankOf({ rankCode: 104, rankLabel: "R4 · Diplomat" })).toBe("R4 · Diplomat");
    expect(rankOf({ rankCode: 104, rankLabel: "R4" })).toBe("R4");
    expect(rankOf({ rankCode: 105, rankLabel: "R5" })).toBe("R5");
    expect(rankOf({ rankCode: null, rankLabel: null })).toBeNull();
  });
});
