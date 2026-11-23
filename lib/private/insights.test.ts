// Issue 489: the Insights page's read from PGlite: our end-of-day rosters, another alliance's daily rosters
// and our members' /v1/players history rows for where people came from and went, a member on a break left
// out of the effort comparison, and none of the roster's private fields in the view. Invented values only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberFacts,
  memberSnapshots,
  snapshots,
} from "../schema";
import { shieldChecks } from "../schema-shield";
import { memberSquads, playerHistory, playerReads } from "../schema-squads";
import { requireWorkspace } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { insightsView, type InsightsView } from "./insights";
import { flowDaysWords } from "./insights-days-words";
import type { Pulse, PulseView } from "./insights-rules";
import { insightsWords } from "./insights-words";
import { createSession } from "./session";

const OURS = 67111155;
const [FERN, MOSS] = [70000001, 70000002];
const NOW = new Date("2026-11-20T12:00:00Z");
const ZONE = "Etc/GMT+2";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => truncateAll(db));

async function roster(day: string, unionId: number, uids: number[], raw = false) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: NOW, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: unionId === FERN ? "FN" : "OG",
    name: unionId === FERN ? "Fern Hall" : "Our Hall",
    memberCount: uids.length,
    sourceUpdatedAt: NOW,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map((u) => u * 100_000),
    memberKills: uids.map(() => 0),
    ...(raw && {
      rawJson: {
        members: uids.map((uid) => ({
          uid,
          nick_name: `P${uid}`,
          power: uid * 100_000,
          active: 500,
          daily_honor: 1000,
          daily_tech: 4000,
          x: 98765,
          y: 54321,
          last_online_at: 1763337600,
        })),
      },
    }),
  });
}

/** Signed in as an officer of a new "ogs" workspace. */
async function officer() {
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

/** A scheduled event of `unionId` with Start and End rows: uid → [might before, might after]. */
async function kvk(at: Date, unionId: number, might: Record<number, [number, number]>) {
  const [event] = await db
    .insert(events)
    .values({ name: "Saturday", eventAtUtc: at, allianceIds: [unionId], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  for (const [i, phase] of (["before", "after"] as const).entries()) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({ snapshotId: snap?.id ?? 0, unionId, source: "v1", isFresh: true })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      Object.entries(might).map(([uid, p]) => ({
        allianceSnapshotId: row?.id ?? 0,
        uid: Number(uid),
        name: `P${uid}`,
        power: p[i] ?? null,
      })),
    );
  }
}

/** The days of a pulse week that have a read. */
const readDays = (days: PulseView["days"]) =>
  days.flatMap((d) => (d.pulse && d.pulse !== "later" ? [d.pulse] : []));
/** Days' counts of one kind added up: what the week pools. */
const pooled = (days: Pulse[], k: "quests" | "coins" | "donated") =>
  days.reduce((a, p) => ({ n: a.n + (p[k]?.n ?? 0), of: a.of + (p[k]?.of ?? 0) }), { n: 0, of: 0 });

/** The flow week of Nov 9's day level in English: its sum line, then its notes, spaces made plain. */
function flowLines(view: InsightsView) {
  const words = flowDaysWords(view, "2026-11-09", { t: WORKSPACE_DICTIONARIES.en, language: "en" });
  return [words?.sum ?? "", ...(words?.notes ?? [])].map((line) => line.replace(/\s/g, " "));
}

describe("the Insights read (issue 489)", () => {
  it("finds where joiners came from and leavers went, leaves a member on a break out, and shows no private field", async () => {
    await saveWorkspace(db, {
      unionId: OURS,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
    });
    await roster("2026-11-14", FERN, [104]);
    await roster("2026-11-16", OURS, [101, 102, 103, 105, 106, 107], true);
    await roster("2026-11-17", OURS, [101, 102, 104, 105, 106, 107], true);
    await roster("2026-11-18", OURS, [101, 102, 104, 105, 106, 107, 108], true);
    await roster("2026-11-18", FERN, [103]);
    // 108 came from an alliance only its own history row names.
    await db.insert(playerHistory).values({
      unionId: OURS,
      uid: 108,
      t: new Date("2026-11-17T10:00:00Z"),
      playerUnionId: MOSS,
      unionAbbr: "MS",
    });
    const ws = await findWorkspaceBySlug(db, "ogs");
    const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
    await db.insert(memberFacts).values({
      workspaceId: ws?.id ?? 0,
      uid: 102,
      field: "status",
      version: 1,
      value: "break",
      source: "officer",
      writtenBy: userId,
      writtenAt: NOW,
    });
    const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
    const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
    if (!access.ok) throw new Error("no access");

    const view = await insightsView(db, access, NOW, ZONE);
    expect(view.flow?.cameFrom).toEqual([
      { unionId: FERN, tag: null, n: 1 },
      { unionId: MOSS, tag: "MS", n: 1 },
    ]);
    expect(view.flow?.wentTo).toEqual([{ unionId: FERN, tag: null, n: 1 }]);
    expect(view.labels.get(FERN)).toMatchObject({ tag: "FN", name: "Fern Hall" });
    // 102 is on a break; 104 and 108 were first seen after our first read, so they are new.
    expect(view.effort?.leftOut).toEqual({ fresh: [104, 108], away: [102], noMight: [] });
    expect(view.effort?.members).toBe(4);
    expect(JSON.stringify(view)).not.toMatch(/98765|54321|1763337600|last_?online/);
  });

  it("reads our KvKs' might and each squad's newest sighting, and nothing of another alliance", async () => {
    const access = await officer();
    await roster("2026-11-14", OURS, [101, 102, 103], true);
    await roster("2026-11-15", OURS, [101, 102, 103], true);
    // Roster might is uid × 100k: 101 is at 10.1M now, after 20M before and 5M after.
    await kvk(new Date("2026-11-14T14:00:00Z"), OURS, { 101: [20_000_000, 5_000_000] });
    await kvk(new Date("2026-11-14T15:00:00Z"), FERN, { 101: [1, 1] });
    const squad = (uid: number, n: number, power: number, at: string) => ({
      unionId: OURS,
      uid,
      squad: n,
      power,
      heroes: [],
      seenAt: new Date(at),
      readAt: new Date(at),
    });
    await db
      .insert(memberSquads)
      .values([
        squad(101, 1, 9_000_000, "2026-11-18T10:00:00Z"),
        squad(101, 1, 9_500_000, "2026-11-20T10:00:00Z"),
        squad(101, 2, 7_000_000, "2026-11-20T10:00:00Z"),
        squad(102, 1, 4_000_000, "2026-11-16T10:00:00Z"),
        { ...squad(103, 1, 1, "2026-11-20T10:00:00Z"), unionId: FERN },
      ]);

    const view = await insightsView(db, access, NOW, ZONE);

    expect(view.kvk.events).toHaveLength(1);
    expect(view.kvk.events[0]).toMatchObject({ members: 1, before: 20_000_000, after: 5_000_000 });
    expect(view.kvk.events[0]?.help).toEqual([{ uid: 101, name: "P101" }]);
    // 101: 2 squads, seen 2 h ago; 102: 1 squad, 4 days ago; 103's only row is another alliance's.
    expect(view.squads).toMatchObject({ counts: [1, 1, 0], none: 1, fresh: [1, 0, 1] });
    // Fewer than 4 members with squads make no might groups.
    expect(view.squads?.bands).toEqual([]);
  });

  it("says the reads start after a KvK that came before them, and does not show that KvK", async () => {
    const access = await officer();
    // Our daily reads start on Tuesday 17; the KvK of Saturday 14 has both reads.
    await roster("2026-11-17", OURS, [101, 102], true);
    await roster("2026-11-18", OURS, [101, 102], true);
    await kvk(new Date("2026-11-14T14:00:00Z"), OURS, { 101: [20_000_000, 15_000_000] });

    const view = await insightsView(db, access, NOW, ZONE);

    expect(view.kvk).toEqual({ events: [], waiting: null, readsFrom: "2026-11-17" });
  });

  it("counts each week's Raid Shield checks over Friday's roster, and nothing while off", async () => {
    const access = await officer();
    await roster("2026-11-06", OURS, [101, 102, 103], true);
    await roster("2026-11-13", OURS, [101, 102, 103], true);
    // Nov 13: both checks ran; Nov 6: only the night check; Oct 30: none.
    await db.insert(shieldChecks).values([
      { day: "2026-11-13", unionId: OURS, nightAt: NOW, morningStatus: "done" },
      { day: "2026-11-06", unionId: OURS, nightAt: NOW },
    ]);
    // ST is UTC−2: Friday 23:00–00:00 ST is 01:00–02:00 UTC on Saturday, the morning 12:00–14:00 UTC.
    const reading = (uid: number, at: string, shielding: number | null, unionId = OURS) => ({
      unionId,
      uid,
      readAt: new Date(at),
      shielding,
    });
    await db
      .insert(playerReads)
      .values([
        reading(101, "2026-11-14T01:10:00Z", 0),
        reading(101, "2026-11-14T01:40:00Z", 1),
        reading(102, "2026-11-14T01:20:00Z", 0),
        reading(103, "2026-11-14T01:30:00Z", 1, FERN),
        ...[101, 102, 103].map((uid) => reading(uid, "2026-11-14T12:30:00Z", 1)),
        reading(101, "2026-11-07T01:30:00Z", 1),
        reading(102, "2026-11-07T01:30:00Z", 1),
        reading(103, "2026-11-07T01:30:00Z", null),
      ]);

    const view = await insightsView(db, access, NOW, ZONE);
    const counts = (roster: number, read: number, seen: number) => ({
      roster,
      read,
      seen,
      running: false,
    });
    expect(view.shield?.slice(0, 3)).toEqual([
      { friday: "2026-11-13", night: counts(3, 2, 1), morning: counts(3, 3, 3) },
      { friday: "2026-11-06", night: counts(3, 2, 2), morning: null },
      { friday: "2026-10-30", night: null, morning: null },
    ]);

    const on = new Set([...access.features.on].filter((f) => f !== "shield_check"));
    const off = { ...access, features: { ...access.features, on } };
    expect((await insightsView(db, off, NOW, ZONE)).shield).toBeNull();
  });

  it("opens a week to its days (D158 rule 7 (b)): the days add up to the week, for the flow and the pulse, and hold only our members", async () => {
    const access = await officer();
    // The week of Mon Nov 9: no read on Wed 11, Sat 14 or Sun 15. 103 joins on Tue, 101 leaves and 104
    // joins across Wed (shown on Thu), 105 joins on Fri.
    await roster("2026-11-09", OURS, [101, 102], true);
    await roster("2026-11-10", OURS, [101, 102, 103], true);
    await roster("2026-11-12", OURS, [102, 103, 104], true);
    await roster("2026-11-13", OURS, [102, 103, 104, 105], true);
    await roster("2026-11-16", OURS, [103, 104, 105], true);
    // Another alliance's members come and go on the same days: none of them is ours.
    await roster("2026-11-10", FERN, [201, 202]);
    await roster("2026-11-12", FERN, [201, 203]);
    await roster("2026-11-13", FERN, [101]);

    const view = await insightsView(db, access, NOW, ZONE, "2026-11-09");

    const week = view.flow?.weeks.find((w) => w.monday === "2026-11-09");
    if (!week) throw new Error("no flow week of Nov 9");
    const on = (day: string) => week.days.find((d) => d.day === day)?.moves;
    expect(on("2026-11-09")).toBeNull(); // the first read: nothing to compare it with
    expect(on("2026-11-10")).toEqual({ joined: [103], left: [] });
    expect(on("2026-11-11")).toBeNull(); // no read: its change shows on Thursday
    expect(on("2026-11-12")).toEqual({ joined: [104], left: [101] });
    expect(on("2026-11-13")).toEqual({ joined: [105], left: [] });
    const all = (k: "joined" | "left") =>
      week.days.flatMap((d) => (d.moves && d.moves !== "later" ? d.moves[k] : []));
    expect(all("joined")).toEqual(week.joined);
    expect(all("left")).toEqual(week.left);
    expect(new Set([...all("joined"), ...all("left")])).toEqual(new Set([101, 103, 104, 105]));
    // The day level says why a day shows no change: no daily update then, or nothing to compare yet.
    expect(flowLines(view)).toEqual([
      "Week of Nov 9: 3 joined, 1 left. Its days add up to this.",
      "No daily update on Wed, Sat, Sun: a join or leave then shows on the next one.",
      "The daily update of Mon, Nov 9 is the starting point: there is nothing before it to compare with.",
    ]);

    // The pulse's earlier week, day by day: each count's days add up to the week's.
    const pulseWeek = view.pulse?.weeks.find((w) => w.monday === "2026-11-09");
    expect(view.pulseWeek?.monday).toBe("2026-11-09");
    const read = readDays(view.pulseWeek?.days ?? []);
    expect(read).toHaveLength(pulseWeek?.reads ?? -1);
    for (const k of ["quests", "coins", "donated"] as const)
      expect(pooled(read, k)).toEqual(pulseWeek?.[k]);
    // This week's days are already on the card; a week that is not the pulse's opens nothing.
    expect((await insightsView(db, access, NOW, ZONE, "2026-11-16")).pulseWeek).toBeNull();
    expect((await insightsView(db, access, NOW, ZONE, "2026-11-11")).pulseWeek).toBeNull();
  });

  it("shows a flow week none of whose days can show a change as “—”, and dates the card from one daily update (D75)", async () => {
    const access = await officer();
    // The first read is Sunday Nov 15, alone in its week: the week of Nov 9 has nothing to compare. The
    // weeks before it have no read at all.
    await roster("2026-11-15", OURS, [101, 102], true);
    await roster("2026-11-16", OURS, [101, 102, 103], true);
    await roster("2026-11-17", OURS, [101, 103], true);

    const view = await insightsView(db, access, NOW, ZONE);
    const flow = insightsWords(view, WORKSPACE_DICTIONARIES.en, "en").flow;
    const weeks = flow?.weeks ?? [];
    expect(weeks.map((w) => [w.joined.value, w.left.value, w.note ?? null])).toEqual([
      ["—", "—", "nothing to compare"],
      ["—", "—", "nothing to compare"],
      ["—", "—", "nothing to compare"],
      ["—", "—", "nothing to compare"],
      ["+1", "−1", null],
    ]);
    // A "—" week draws no bar and opens nothing.
    expect(weeks.slice(0, 4).flatMap((w) => [w.joined.share, w.left.share, w.drill])).toEqual(
      Array(12).fill(null),
    );
    // One start date: the daily update the first change is compared with, as the tenure line says.
    expect(flow?.based.replace(/\s/g, " ")).toBe(
      "Based on 3 daily updates since November 15. A change shows on the first daily update after it.",
    );
    expect(flow?.tenure.at(-1)?.label.replace(/\s/g, " ")).toBe(
      "Already here at our first daily update, Nov 15",
    );
  });
});
