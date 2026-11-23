// D158 rule 7, one level further (issue 752): a day of the week's pulse opens who reached each measure
// (pattern (c)), a day of the membership flow its came-from and went-to bars, a KvK recovery day its
// numbers. Each level comes from the same reads as the count it opens from, which the tests check against
// the parent's figure, and holds only the workspace's own alliance. PGlite, invented values only.
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
import { requireWorkspace } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { insightsView } from "./insights";
import { flowDayWords, pulseDayWords } from "./insights-days-words";
import { kvkLevelWords, kvkWords } from "./insights-more-words";
import { createSession } from "./session";

const OURS = 67111155;
const FERN = 70000001;
const NOW = new Date("2026-11-20T12:00:00Z");
const ZONE = "Etc/GMT+2";
const f = { t: WORKSPACE_DICTIONARIES.en, language: "en" as const };
/** Spaces made plain: the pages write dates with no-break spaces. */
const plain = (s: string | undefined) => s?.replace(/\s/g, " ");

/** The value, or a failed test: the level must be there. */
function must<T>(x: T | null | undefined, what: string): T {
  if (x === null || x === undefined) throw new Error(`no ${what}`);
  return x;
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => truncateAll(db));

type Daily = [active: number | null, honor: number | null, tech: number | null];

/**
 * A daily read of `unionId`: each member's might is uid × 100k, and with `daily` they send their own
 * `active`, coins and donation that day.
 */
async function roster(
  day: string,
  unionId: number,
  uids: number[],
  daily: Record<number, Daily> = {},
) {
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
    rawJson: {
      members: uids.map((uid) => {
        const [active, honor, tech] = daily[uid] ?? [500, 1000, 4000];
        return {
          uid,
          nick_name: `P${uid}`,
          power: uid * 100_000,
          active,
          daily_honor: honor,
          daily_tech: tech,
        };
      }),
    },
  });
}

/** `roster` with every member's day: uid → [active, coins, donation]. */
const dailies = (day: string, unionId: number, daily: Record<number, Daily>) =>
  roster(day, unionId, Object.keys(daily).map(Number), daily);

/** Signed in as an officer of a new workspace of `unionId`. */
async function officer(slug = "ogs", unionId = OURS) {
  await saveWorkspace(db, { unionId, slug, discordGuildId: String(unionId), leaderRoleIds: ["2"] });
  const ws = must(await findWorkspaceBySlug(db, slug), "workspace");
  const userId = await recordSignIn(db, ws.id, `${slug}-ana`, "Ana", NOW);
  const { token } = await createSession(db, ws.id, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
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
      .values({ eventId: must(event, "event").id, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({ snapshotId: must(snap, "snapshot").id, unionId, source: "v1", isFresh: true })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      Object.entries(might).map(([uid, p]) => ({
        allianceSnapshotId: must(row, "row").id,
        uid: Number(uid),
        name: `P${uid}`,
        power: p[i] ?? null,
      })),
    );
  }
}

describe("a chart's day level (D158 rule 7, issue 752)", () => {
  it("opens a pulse day to who reached each measure (pattern (c)): its counts are the day's column, and only our alliance's members", async () => {
    const access = await officer();
    // Mon 16, then Tue 17: 101 earns 50 quest points, 102 and 103 none; 104 is new, so their points are
    // not known. [active, coins, donation].
    await dailies("2026-11-16", OURS, {
      101: [100, 1000, 500],
      102: [null, 200, null],
      103: [50, 1000, 300],
    });
    await dailies("2026-11-17", OURS, {
      101: [150, 1000, null],
      102: [null, 1000, 700],
      103: [50, 500, null],
      104: [80, 1000, 900],
    });
    // Another alliance's members reach everything on the same days.
    await dailies("2026-11-16", FERN, { 201: [100, 1000, 500] });
    await dailies("2026-11-17", FERN, { 201: [200, 1000, 500], 202: [90, 1000, 500] });

    const view = await insightsView(db, access, NOW, ZONE, { pulseDay: "2026-11-17" });
    const column = must(view.pulse, "pulse").days.find((d) => d.day === "2026-11-17")?.pulse;
    if (!column || column === "later") throw new Error("no pulse on Nov 17");
    const { reached } = must(view.pulseDay, "pulse day");
    for (const k of ["quests", "coins", "donated"] as const)
      expect({ n: reached[k].uids.length, of: reached[k].of }).toEqual(column[k]);
    const words = must(pulseDayWords(view, f), "pulse day words");
    expect(words.rows.map((r) => [r.value, r.set?.people.map((p) => p.name)])).toEqual([
      ["1 of 3 members", ["P101"]],
      ["3 of 4 members", ["P101", "P102", "P104"]],
      ["2 of 4 members", ["P102", "P104"]],
    ]);
    // The names stay in place: no Members link (pattern (c), in place only).
    expect(words.rows.map((r) => r.set?.onward)).toEqual([null, null, null]);
    expect(words.notes).toEqual(["Daily quest points: not known for 1."]);
    expect(words.week).toEqual({ label: "This week", monday: null });
    // A day with no read opens nothing, nor does a read before the pulse's weeks (from Mon Oct 19): the
    // page reads it, but no column shows it.
    await dailies("2026-10-12", OURS, { 101: [100, 1000, 500] });
    for (const pulseDay of ["2026-11-15", "2026-10-12"])
      expect((await insightsView(db, access, NOW, ZONE, { pulseDay })).pulseDay).toBeNull();

    // The other alliance's workspace, at the same address, names its own members only.
    const fern = await officer("fern", FERN);
    const theirs = await insightsView(db, fern, NOW, ZONE, { pulseDay: "2026-11-17" });
    expect(must(theirs.pulseDay, "their pulse day").reached.coins.uids).toEqual([201, 202]);
  });

  it("opens a flow day to where its joiners came from and its leavers went, which add up to that day's counts", async () => {
    const access = await officer();
    // Tue 17: 104 and 105 join, 103 leaves. Wed 18: 106 joins, 102 leaves.
    await roster("2026-11-16", OURS, [101, 102, 103]);
    await roster("2026-11-17", OURS, [101, 102, 104, 105]);
    await roster("2026-11-18", OURS, [101, 104, 105, 106]);
    // Fern listed 104 before they joined us and 103 after they left; its own members come and go too.
    await roster("2026-11-15", FERN, [104, 201]);
    await roster("2026-11-17", FERN, [202]);
    await roster("2026-11-18", FERN, [103, 203]);

    const tue = await insightsView(db, access, NOW, ZONE, { flowDay: "2026-11-17" });
    const flow = must(tue.flow, "flow");
    const moves = flow.weeks.flatMap((w) => w.days).find((d) => d.day === "2026-11-17")?.moves;
    if (!moves || moves === "later") throw new Error("no flow on Nov 17");
    expect(flow.day).toEqual({
      day: "2026-11-17",
      joined: moves.joined.length,
      left: moves.left.length,
      cameFrom: [
        { unionId: FERN, tag: null, n: 1 },
        { unionId: 0, tag: null, n: 1 },
      ],
      wentTo: [{ unionId: FERN, tag: null, n: 1 }],
    });
    const words = must(flowDayWords(tue, f), "flow day words");
    expect(plain(words.sum)).toBe(
      "Tue, Nov 17: 2 joined, 1 left. The places below add up to this.",
    );
    // This week too, Back goes to the week's days: the flow's week rows draw no days.
    expect([plain(words.week.label), words.week.monday]).toEqual(["Week of Nov 16", "2026-11-16"]);
    expect(words.came.map((r) => [r.label, r.value])).toEqual([
      ["⁨[FN] Fern Hall⁩", "1"],
      ["Not known", "1"],
    ]);
    // Wednesday's places are its own: nobody seen elsewhere.
    const wed = must(
      (await insightsView(db, access, NOW, ZONE, { flowDay: "2026-11-18" })).flow,
      "flow",
    );
    expect(wed.day).toMatchObject({
      cameFrom: [{ unionId: 0, tag: null, n: 1 }],
      wentTo: [{ unionId: 0, tag: null, n: 1 }],
    });
    // The first read has nothing to compare with, and a day with no read has no moves: nothing opens.
    for (const flowDay of ["2026-11-16", "2026-11-19"])
      expect(
        must((await insightsView(db, access, NOW, ZONE, { flowDay })).flow, "flow").day,
      ).toBeNull();
  });

  it("opens a KvK recovery day to its numbers: the share its column shows, and the members that day's read leaves out", async () => {
    const access = await officer();
    // Sat 14's KvK: 101 from 20M to 5M, 102 from 10M to 8M. 102 is not in Sunday's read, and Monday's
    // lists neither of them (only 103, who was not in the KvK).
    await kvk(new Date("2026-11-14T14:00:00Z"), OURS, {
      101: [20_000_000, 5_000_000],
      102: [10_000_000, 8_000_000],
    });
    // Roster might is uid × 100k: 101 at 10.1M, 102 at 10.2M.
    await roster("2026-11-14", OURS, [101, 102]);
    await roster("2026-11-15", OURS, [101]);
    await roster("2026-11-16", OURS, [103]);
    await roster("2026-11-17", OURS, [101, 102]);

    const view = await insightsView(db, access, NOW, ZONE);
    const e = must(view.kvk.events[0], "KvK");
    expect(e.members).toBe(2);
    const day = (d: string, members: number, before: number, after: number, then: number) => ({
      day: d,
      members,
      before,
      after,
      then,
      share: members > 0 ? expect.closeTo((then - after) / (before - after), 10) : null,
    });
    expect(e.days).toEqual([
      day("2026-11-15", 1, 20_000_000, 5_000_000, 10_100_000),
      day("2026-11-16", 0, 0, 0, 0),
      day("2026-11-17", 2, 30_000_000, 13_000_000, 20_300_000),
    ]);
    const words = must(kvkWords(view.kvk, "2026-11-17", f, "23:30").events[0], "KvK words");
    const columns = words.days;
    // Monday's read lists none of them: its column is "—", and it opens nothing (D75).
    expect(columns[1]?.value).toBe("—");
    expect(words.picks.map((p) => p.key)).toEqual(["2026-11-15", "2026-11-17"]);
    const asked = (kvkDay: string) =>
      kvkLevelWords(view.kvk, "2026-11-17", { kvk: "2026-11-14", kvkDay }, f);
    expect(asked("2026-11-16")).toMatchObject({ event: { day: "2026-11-14" }, day: null });
    const sun = must(asked("2026-11-15")?.day, "Sunday");
    expect(sun.might.map((r) => [plain(r.label), r.value, r.note])).toEqual([
      ["Before (Start read)", "20.0M", undefined],
      ["After (End read)", "5.00M", "lost 75%"],
      ["On Nov 15", "10.1M", "34% back"],
    ]);
    expect(plain(sun.sum)).toBe(
      `Sun, Nov 15: ${columns[0]?.value} of the might they lost is back.`,
    );
    expect(sun.counted).toBe(
      "Counted: 1 of the 2 members this KvK counts. Not in this day’s daily update: 1.",
    );
    const tue = must(asked("2026-11-17")?.day, "Tuesday");
    expect(tue.counted).toBe("Counted: 2 of the 2 members this KvK counts.");
    expect(tue.sum).toContain(`${columns[2]?.value} of the might`);
    // The KvK alone opens its days; a day outside them, or another KvK's day, opens no day.
    expect(asked("2026-11-18")).toMatchObject({ event: { day: "2026-11-14" }, day: null });
    const other = { kvk: "2026-11-07", kvkDay: "2026-11-15" };
    expect(kvkLevelWords(view.kvk, "2026-11-17", other, f)).toBeNull();
  });
});
