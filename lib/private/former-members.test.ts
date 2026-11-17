import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  snapshots,
} from "../schema";
import { allianceDuelPoints } from "../schema-import";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { formerMembers } from "./former-members";
import { saveFacts, type FactChange } from "./member-facts";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
const NOW = new Date("2026-11-17T12:00:00Z");

let db: Db;
let ana: WorkspaceAccess;

/** One end-of-day read: invented members, with the private keys in raw_json as the upstream sends them. */
async function read(day: string, members: [number, string, number][]) {
  await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: members.length,
    sourceUpdatedAt: new Date(`${day}T01:30:00Z`),
    isFresh: true,
    memberUids: members.map(([uid]) => uid),
    memberNames: members.map(([, name]) => name),
    memberPower: members.map(([, , power]) => power),
    memberKills: members.map(() => 5000),
    rawJson: {
      members: members.map(([uid, nick_name]) => ({
        uid,
        nick_name,
        x: 412,
        y: 977,
        online: true,
        last_online_at: 1763337600,
        joined_at: 1760000000,
        daily_tech: 321,
        daily_honor: 45,
        active: 6789,
        avatar_url: "https://example.test/avatar.png",
      })),
    },
  });
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  ana = access;
});

describe("former members (D107)", () => {
  it("lists who left, newest leavers first, with facts still writable and no private field", async () => {
    await read("2026-11-14", [
      [21, "Wren", 40_000_000],
      [22, "Ilsa", 30_000_000],
      [23, "Tobiah", 20_000_000],
    ]);
    await read("2026-11-15", [
      [21, "Wren", 41_000_000],
      [22, "Ilsa", 31_000_000],
    ]);
    await read("2026-11-16", [[21, "Wren", 42_000_000]]);
    // Facts stay writable for someone who left; a uid no roster ever listed gets none.
    const why: FactChange = {
      field: "notes",
      version: 0,
      value: "moved server",
      source: "officer",
    };
    expect(await saveFacts(db, ana, 22, [why], NOW)).toMatchObject([{ status: "saved" }]);
    expect(await saveFacts(db, ana, 99, [why], NOW)).toBeNull();

    const former = await formerMembers(db, ana, ZONE);

    expect(former.map((m) => [m.uid, m.name, m.lastSeen, m.might])).toEqual([
      [22, "Ilsa", "2026-11-14", 31_000_000],
      [23, "Tobiah", "2026-11-13", 20_000_000],
    ]);
    expect(former[0]?.facts.notes?.value).toBe("moved server");
    // Only the name, public might and kills, the last day seen, the facts and Duel points (CLAUDE.md, D71).
    for (const m of former) {
      expect(Object.keys(m).sort()).toEqual([
        "duel",
        "facts",
        "kills",
        "lastSeen",
        "might",
        "name",
        "uid",
      ]);
    }
    const sent = JSON.stringify(former);
    for (const leak of [
      "412",
      "977",
      "online",
      "avatar",
      "321",
      "6789",
      "1763337600",
      "1760000000",
    ])
      expect(sent).not.toContain(leak);
  });

  it("finds who was only in an event's Start roster (member rows, no arrays)", async () => {
    await read("2026-11-14", [[21, "Wren", 40_000_000]]);
    await read("2026-11-16", [[21, "Wren", 42_000_000]]);
    const at = new Date("2026-11-14T12:00:00Z");
    const [event] = await db
      .insert(events)
      .values({ name: "Saturday", eventAtUtc: at, allianceIds: [OGS], beforeAt: at, afterAt: at })
      .returning({ id: events.id });
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase: "before", startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: snap?.id ?? 0,
        unionId: OGS,
        source: "v1",
        isFresh: true,
        sourceUpdatedAt: at,
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values({
      allianceSnapshotId: row?.id ?? 0,
      uid: 25,
      name: "Odalys",
      power: 18_000_000,
      kills: 7000,
      avatarUrl: "https://example.test/avatar.png",
    });
    const why: FactChange = { field: "notes", version: 0, value: "event only", source: "officer" };

    expect(await saveFacts(db, ana, 25, [why], NOW)).toMatchObject([{ status: "saved" }]);
    const former = await formerMembers(db, ana, ZONE);
    expect(former).toEqual([
      expect.objectContaining({
        uid: 25,
        name: "Odalys",
        lastSeen: "2026-11-14",
        might: 18_000_000,
      }),
    ]);
    expect(JSON.stringify(former)).not.toContain("avatar");
  });

  it("shows the newest week of Alliance Duel points saved for them, as the member card does", async () => {
    await read("2026-11-14", [
      [21, "Wren", 40_000_000],
      [22, "Ilsa", 30_000_000],
    ]);
    await read("2026-11-16", [[21, "Wren", 42_000_000]]);
    const points = (week: string, day: "mon" | "tue" | "week", value: number) => ({
      workspaceId: ana.workspaceId,
      uid: 22,
      week,
      day,
      points: value,
      savedAt: NOW,
    });
    await db
      .insert(allianceDuelPoints)
      .values([
        points("2026-11-02", "week", 9_000_000),
        points("2026-11-09", "mon", 2_400_000),
        points("2026-11-09", "tue", 3_100_000),
        { ...points("2026-11-09", "week", 1), uid: 21 },
      ]);

    const [ilsa] = await formerMembers(db, ana, ZONE);
    expect(ilsa?.duel).toEqual({ week: "2026-11-09", points: { mon: 2_400_000, tue: 3_100_000 } });
  });
});
