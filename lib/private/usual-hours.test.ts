// Members' usual hours in game (issue 873, D163): the band from seeded readings, "not enough readings" under 7,
// the alliance histogram read from PGlite through insightsView, the own alliance's rows only, and nothing in
// the public read model. Invented values; the server zone is UTC−2 (Etc/GMT+2), so ST = UTC − 2 h.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { alliancePage } from "../queries/alliance-page";
import { findBlockedKeys } from "../queries/blocked-keys";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { playerReads } from "../schema-squads";
import { requireWorkspace } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { insightsView } from "./insights";
import { usualLine, usualWords } from "./insights-usual-words";
import { memberCard } from "./member-card";
import { createSession } from "./session";
import { distinctReadings, usualOf } from "./usual-hours";

const OURS = 67111155;
const OTHER = 67111166;
const ZONE = "Etc/GMT+2";
/** Sunday 2026-11-22, 13:00 ST. */
const NOW = new Date("2026-11-22T15:00:00Z");
const f = { t: WORKSPACE_DICTIONARIES.en, language: "en" as const };

/** A reading at `hour` ST on November `day`, as epoch ms. */
const at = (day: number, hour: number, minute = 0) =>
  Date.parse(`2026-11-${String(day).padStart(2, "0")}T00:00:00Z`) +
  (hour + 2) * 3_600_000 +
  minute * 60_000;

/** Fourteen readings: ten at 20:xx–21:xx ST, two at 22:xx, one at 09:00 and one at 03:00. */
const FOURTEEN = [
  ...[1, 2, 3, 4, 5].map((d) => at(d, 20, d)),
  ...[6, 7, 8, 9, 10].map((d) => at(d, 21, d)),
  at(11, 22),
  at(12, 22),
  at(13, 9),
  at(14, 3),
];

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => truncateAll(db));

describe("usualOf", () => {
  it("is the shortest run of server hours holding 60 % of the readings", () => {
    const usual = usualOf(FOURTEEN, NOW, ZONE);
    expect(usual).toEqual({ readings: 14, band: { from: 20, to: 21, n: 10 } });
    expect(usualLine(usual, f)).toBe("Usually in game around 20:00–21:59 ST (from 14 readings)");
  });

  it("says not enough readings under 7, counting one time seen again once", () => {
    expect(usualOf(FOURTEEN.slice(0, 6), NOW, ZONE)).toEqual({ readings: 6, band: null });
    const same = Array.from({ length: 9 }, () => at(5, 20));
    expect(distinctReadings(same, NOW)).toHaveLength(1);
    expect(usualLine(usualOf(same, NOW, ZONE), f)).toBe(
      "Usual hours in game: not enough readings yet (1 so far)",
    );
  });

  it("runs through midnight and leaves out readings older than 30 days", () => {
    const night = [23, 23, 23, 0, 0, 0, 1, 12].map((h, i) => at(10 + i, h));
    const usual = usualOf([...night, Date.parse("2026-10-01T15:00:00Z")], NOW, ZONE);
    expect(usual).toEqual({ readings: 8, band: { from: 23, to: 0, n: 6 } });
  });
});

async function roster(day: string, unionId: number, members: { uid: number; seen: string }[]) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: NOW, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: "OG",
    name: "Hall",
    memberCount: members.length,
    sourceUpdatedAt: NOW,
    isFresh: true,
    memberUids: members.map((m) => m.uid),
    memberNames: members.map((m) => `P${m.uid}`),
    memberPower: members.map(() => 1),
    memberKills: members.map(() => 0),
    rawJson: {
      members: members.map((m) => ({ uid: m.uid, nick_name: `P${m.uid}`, last_online_at: m.seen })),
    },
  });
}

async function desk() {
  await saveWorkspace(db, {
    unionId: OURS,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/** Member 101: twelve daily rosters, six at 20:xx and six at 21:xx ST; member 102: three distinct times. */
async function seed() {
  for (let d = 10; d <= 21; d++) {
    const seen = new Date(at(d, d <= 15 ? 20 : 21, d)).toISOString();
    await roster(`2026-11-${d}`, OURS, [
      { uid: 101, seen },
      { uid: 102, seen: d <= 12 ? new Date(at(d, 8)).toISOString() : "2026-11-12T10:00:00Z" },
    ]);
  }
}

describe("the Insights Usual hours card", () => {
  it("counts the members whose band holds each server hour, from rosters and player reads", async () => {
    await seed();
    const reading = (uid: number, seenAt: number) => ({
      unionId: OURS,
      uid,
      readAt: new Date(seenAt),
      lastSeenAt: new Date(seenAt),
    });
    await db.insert(playerReads).values([reading(101, at(9, 21, 5)), reading(101, at(8, 21, 7))]);
    const view = await insightsView(db, await desk(), NOW, ZONE);
    expect(view.usual.members).toBe(2);
    expect(view.usual.enough).toBe(1);
    const hours = view.usual.byHour.flatMap((n, h) => (n ? [h] : []));
    expect(hours).toEqual([20, 21]);
    const words = usualWords(view.usual, f);
    expect(words.based[0]).toBe(
      "Most members are usually in game around 20:00–21:59 ST: 1 of the 1 members with enough readings.",
    );
    expect(words.details?.rows[20]).toMatchObject({ st: "20:00 ST", value: "1", share: 1 });
  });

  it("reads the own alliance's rows only", async () => {
    await seed();
    await roster("2026-11-21", OTHER, [{ uid: 101, seen: "2026-11-21T05:00:00Z" }]);
    await db.insert(playerReads).values(
      Array.from({ length: 10 }, (_, i) => ({
        unionId: OTHER,
        uid: 102,
        readAt: new Date(at(i + 1, 5)),
        lastSeenAt: new Date(at(i + 1, 5)),
      })),
    );
    const view = await insightsView(db, await desk(), NOW, ZONE);
    expect(view.usual.enough).toBe(1);
    expect(view.usual.byHour[5]).toBe(0);
  });

  it("never reaches the public alliance page", async () => {
    await seed();
    await db.insert(playerReads).values({ unionId: OURS, uid: 101, readAt: NOW, lastSeenAt: NOW });
    const page = await alliancePage(db, OURS);
    expect(findBlockedKeys(page, { allowActivity: true })).toEqual([]);
    expect(JSON.stringify(page)).not.toMatch(/last_seen|last_online|usual/i);
  });
});

describe("the member card's usual-hours line", () => {
  it("says the band from the rosters and player reads, and not enough readings under 7", async () => {
    await seed();
    await db.insert(playerReads).values({
      unionId: OURS,
      uid: 101,
      readAt: new Date(at(9, 21, 5)),
      lastSeenAt: new Date(at(9, 21, 5)),
    });
    const access = await desk();
    const at_ = { now: NOW, zone: ZONE, language: "en" as const, t: WORKSPACE_DICTIONARIES.en };
    const enough = await memberCard(db, access, 101, at_);
    expect(enough?.presence).toContain("Usually in game around 20:00–21:59 ST (from 13 readings)");
    const few = await memberCard(db, access, 102, at_);
    expect(few?.presence).toContain("Usual hours in game: not enough readings yet (3 so far)");
  });
});
