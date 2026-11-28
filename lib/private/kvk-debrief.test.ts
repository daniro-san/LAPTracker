// Insights → KvK → Debrief (issue 872): each section from seeded data, no member who gained nothing named,
// no debrief in an Origin of Chaos week, a card with no blocked roster key, and the own alliance only.
// Against a real Postgres (PGlite). Invented names and places only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findBlockedKeys } from "../queries/blocked-keys";
import { saveCastle } from "../repo/workspaces";
import {
  allianceSnapshots,
  dailyRosters,
  events,
  memberSnapshots,
  rollCallMarks,
  rollCalls,
  snapshots,
  workspaces,
} from "../schema";
import { raidOpponents, raidReads } from "../schema-shield";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { kvkDebriefView } from "./kvk-debrief";
import { debriefCard, renderDebriefCard } from "./kvk-debrief-card";

const OURS = 900_001;
const THEIRS = 900_002;
/** Saturday 2026-11-21 is a KvK (ST is UTC here); Saturday 2026-12-05 is an Origin of Chaos. */
const AT = new Date("2026-11-21T14:00:00Z");
const NOW = new Date("2026-11-23T12:00:00Z");
/** uid → kills at the Start and End, might at the Start and End, place. Invented 2 gained nothing. */
const MEMBERS = {
  [OURS]: [
    { uid: 1, kills: [100, 130], power: [1000, 800], x: 101, y: 101 },
    { uid: 2, kills: [100, 100], power: [1000, 900], x: 140, y: 140 },
    { uid: 3, kills: [100, 110], power: [1000, 700], x: 300, y: 300 },
  ],
  [THEIRS]: [
    { uid: 7, kills: [100, 500], power: [1000, 900], x: 700, y: 700 },
    { uid: 8, kills: [100, 600], power: [1000, 900], x: 710, y: 710 },
  ],
};
const CFG = { ...TEST_ENV, SERVER_TZ: "UTC" };
const nameOf = (uid: number) => (uid > 6 ? `Theirs ${uid}` : `Invented ${uid}`);

describe("kvkDebriefView", () => {
  let db: Db;
  const ids = { ours: 0, theirs: 0 };
  const access = () =>
    ({
      workspaceId: ids.ours,
      unionId: OURS,
      features: { on: new Set(["shield_check"]) },
    }) as unknown as WorkspaceAccess;
  /** The seeded KvK's debrief, which must be there. */
  async function shown() {
    const d = await kvkDebriefView(db, access(), NOW, { cfg: CFG, matchup: false });
    if (!d) throw new Error("no debrief");
    return d;
  }
  beforeAll(async () => {
    db = await openTestDb();
  });
  beforeEach(async () => {
    await truncateAll(db);
    const rows = await db
      .insert(workspaces)
      .values([
        { unionId: OURS, slug: "alpha", discordGuildId: "1", leaderRoleIds: ["2"] },
        { unionId: THEIRS, slug: "bravo", discordGuildId: "3", leaderRoleIds: ["4"] },
      ])
      .returning({ id: workspaces.id });
    ids.ours = rows[0]?.id ?? 0;
    ids.theirs = rows[1]?.id ?? 0;
    await event(AT);
    // The day after: ours back to 2400 of the 2300 → 3000 lost; theirs alike.
    for (const [unionId, list] of Object.entries(MEMBERS)) {
      const members = list.map((m) => ({ uid: m.uid, nick_name: nameOf(m.uid), power: 800 }));
      await db.insert(dailyRosters).values({
        readDay: "2026-11-22",
        unionId: Number(unionId),
        memberCount: members.length,
        isFresh: true,
        sourceUpdatedAt: new Date("2026-11-22T23:30:00Z"),
        memberUids: members.map((m) => m.uid),
        memberNames: members.map((m) => m.nick_name),
        memberPower: members.map((m) => m.power),
        memberKills: members.map(() => 0),
        rawJson: { members },
      });
    }
    // Each workspace's Raid prep of that KvK: Friday's roll call, ✓ and ✗ marks of both parts.
    for (const [workspaceId, marks] of [
      [
        ids.ours,
        [
          [1, "main", "yes"],
          [2, "main", "no"],
          [3, "wall", "yes"],
        ],
      ],
      [
        ids.theirs,
        [
          [2, "wall", "yes"],
          [2, "main", "yes"],
        ],
      ],
    ] as const) {
      const [call] = await db
        .insert(rollCalls)
        .values({ workspaceId, kind: "shield", day: "2026-11-20", week: "2026-11-16" })
        .returning({ id: rollCalls.id });
      await db.insert(rollCallMarks).values(
        marks.map(([uid, part, mark]) => ({
          rollCallId: call?.id ?? 0,
          uid,
          part,
          mark,
          version: 1,
          writtenAt: AT,
        })),
      );
    }
    await saveCastle(db, ids.ours, { x: 100, y: 100 });
    await saveCastle(db, ids.theirs, { x: 999, y: 999 });
  });

  /** A public scheduled event at `at` with a Start and an End for both alliances. */
  async function event(at: Date) {
    const [row] = await db
      .insert(events)
      .values({
        name: "Saturday Event",
        eventAtUtc: at,
        allianceIds: [OURS, THEIRS],
        beforeAt: new Date(at.getTime() - 2 * 3_600_000),
        afterAt: new Date(at.getTime() + 2 * 3_600_000),
      })
      .returning({ id: events.id });
    for (const [i, phase] of (["before", "after"] as const).entries()) {
      const [snap] = await db
        .insert(snapshots)
        .values({
          eventId: row?.id ?? 0,
          phase,
          startedAt: new Date(at.getTime() + (i * 2 - 1) * 3_600_000),
          status: "complete",
        })
        .returning({ id: snapshots.id });
      for (const [unionId, list] of Object.entries(MEMBERS)) {
        const [alliance] = await db
          .insert(allianceSnapshots)
          .values({
            snapshotId: snap?.id ?? 0,
            unionId: Number(unionId),
            source: "v1",
            isFresh: true,
            rawJson: {
              members: list.map((m) => ({ uid: m.uid, x: m.x, y: m.y, online: 1 })),
            },
          })
          .returning({ id: allianceSnapshots.id });
        await db.insert(memberSnapshots).values(
          list.map((m) => ({
            allianceSnapshotId: alliance?.id ?? 0,
            uid: m.uid,
            name: nameOf(m.uid),
            kills: m.kills[i],
            power: m.power[i],
          })),
        );
      }
    }
  }

  it("builds Thanks, Roll call, Map and Recovery from the stored KvK; no opponent with none set", async () => {
    const d = await kvkDebriefView(db, access(), NOW, { cfg: CFG, matchup: true });
    expect(d?.day).toBe("2026-11-21");
    expect(d?.thanks).toEqual([
      { uid: 1, name: "Invented 1", gain: 30 },
      { uid: 3, name: "Invented 3", gain: 10 },
    ]);
    expect([d?.counted, d?.gained]).toEqual([3, 40]);
    expect(d?.rollCall).toEqual({ shield: ["Invented 1"], wall: ["Invented 3"] });
    expect(d?.bands).toEqual([
      { band: "near", members: 1, kills: 30 },
      { band: "mid", members: 1, kills: 0 },
      { band: "far", members: 1, kills: 10 },
    ]);
    expect(d?.recovery).toMatchObject({
      day: "2026-11-21",
      before: 3000,
      after: 2400,
      now: 2400,
      people: [],
      help: [],
    });
    expect(d?.recovery?.days).toHaveLength(1);
    expect(d?.opponent).toBeNull();
  });

  it("never names a member who gained no kills, on the page's data or on the card", async () => {
    const d = await shown();
    expect(d?.thanks.map((p) => p.name)).not.toContain("Invented 2");
    const card = debriefCard(d, { t: WORKSPACE_DICTIONARIES.en, language: "en" });
    expect(JSON.stringify(card)).not.toContain("Invented 2");
    expect(card.sections[0]?.rows).toEqual([
      { label: "Invented 1", value: "+30" },
      { label: "Invented 3", value: "+10" },
    ]);
  });

  it(
    "makes a card with no blocked roster key, no place and only names of members who gained kills",
    { timeout: 40_000 },
    async () => {
      const d = await shown();
      const card = debriefCard(d, { t: WORKSPACE_DICTIONARIES.fr, language: "fr" });
      expect(findBlockedKeys(card)).toEqual([]);
      const text = JSON.stringify(card);
      // Places (101, 140, 300) and the roll call's names stay off the card; its counts are there.
      expect(text).not.toMatch(/\b(?:101|140|300)\b|Invented 2/);
      expect(card.sections[1]?.rows.map((r) => r.value)).toEqual(["1", "1"]);
      const png = await renderDebriefCard(card);
      expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    },
  );

  it("draws a thanked member whose name the fonts cannot draw as their uid", async () => {
    const d = await shown();
    const card = debriefCard(
      { ...d, thanks: [{ uid: 42, name: "龍の会 🔥", gain: 5 }] },
      { t: WORKSPACE_DICTIONARIES.en, language: "en" },
    );
    expect(card.sections[0]?.rows).toEqual([{ label: "#42", value: "+5" }]);
  });

  it("shows the raid opponent's Start to End when no KvK matchup is set (issue 861)", async () => {
    const them = 777_001;
    await db.insert(raidOpponents).values({
      workspaceId: ids.ours,
      saturday: "2026-11-21",
      server: 328,
      unionId: them,
      tag: "RIV",
      setAt: AT,
    });
    const read = (phase: "start" | "end", side: "us" | "them", kills: number, power: number) => ({
      workspaceId: ids.ours,
      saturday: "2026-11-21",
      phase,
      side,
      unionId: side === "us" ? OURS : them,
      memberCount: 1,
      memberUids: [side === "us" ? 1 : 9],
      memberPower: [power],
      memberKills: [kills],
      isFresh: true,
      readAt: AT,
    });
    await db
      .insert(raidReads)
      .values([
        read("start", "us", 100, 1000),
        read("end", "us", 150, 900),
        read("start", "them", 100, 1000),
        read("end", "them", 120, 800),
      ]);
    const d = await shown();
    expect(d.raid).toEqual({
      tag: "RIV",
      server: 328,
      us: { kills: 50, might: -100, members: 1 },
      them: { kills: 20, might: -200, members: 1 },
    });
    const card = debriefCard(d, { t: WORKSPACE_DICTIONARIES.en, language: "en" });
    expect(card.sections[4]).toEqual({
      head: "Opponent",
      lines: ["Raid opponent RIV (S328), Start to End of the raid:"],
      rows: [
        { label: "Kills gained", value: "+50 us · +20 them" },
        { label: "Might change", value: "−100 us · −200 them" },
      ],
    });
  });

  it("has no debrief when the newest KvK-time event is an Origin of Chaos", async () => {
    await event(new Date("2026-12-05T14:00:00Z"));
    expect(
      await kvkDebriefView(db, access(), new Date("2026-12-06T12:00:00Z"), {
        cfg: CFG,
        matchup: true,
      }),
    ).toBeNull();
  });

  it("reads only the own alliance: its members, its Raid prep marks and its castle point", async () => {
    const d = await kvkDebriefView(db, access(), NOW, { cfg: CFG, matchup: true });
    expect(JSON.stringify(d)).not.toContain("Theirs");
    // Bravo's ✓ marks for uid 2 are not ours; ours has a ✗ for it and no wall mark.
    expect(d?.rollCall?.wall).toEqual(["Invented 3"]);
    expect(d?.rollCall?.shield).toEqual(["Invented 1"]);
    // Our castle point (100, 100), not Bravo's: the nearest member is the one at (101, 101).
    expect(d?.bands?.[0]).toEqual({ band: "near", members: 1, kills: 30 });
  });
});
