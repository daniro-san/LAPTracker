import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ago, fakeV1, IDS, minutes, roster, T0 } from "./collector.test-helpers";
import { autoRetryDailyRead, runDailyRead } from "./daily-read";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { BLOCKED_ROSTER_KEYS, findBlockedKeys, memberHistoryCard } from "./queries";
import { allianceStatement } from "./queries/statement";
import { dayRosterUids } from "./repo/squads";
import { endOfDayReads } from "./repo/workspace-rosters";
import { dailyReads, dailyRosters, playerFrames, runLogs } from "./schema";
import { alliances } from "./schema-alliances";
import { toSnapshotInput } from "./sources/shared";
import { UpstreamError } from "./sources/types";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const deps = (v1: ReturnType<typeof fakeV1>) => ({ v1, now: () => T0 });

/** Every alliance on LAP_API_KEY: no workspace key (D133's targets). */
const ours = (ids: number[]) => ids.map((unionId) => ({ unionId, key: null }));

describe("runDailyRead (D60)", () => {
  it("reads no roster when the quota would not leave an event run its reserve", async () => {
    // 2 alliances need requiredQuota(2) + requiredQuota(20) = 14 + 50 = 64.
    const v1 = fakeV1((id) => roster(id, ago(T0, minutes(1))), 63);

    const summary = await runDailyRead(deps(v1), db, "2026-11-10", ours(IDS.slice(0, 2)));

    expect(v1.calls).toEqual([]);
    expect(summary).toMatchObject({ status: "failed", callsUsed: 1 });
    expect(summary?.error).toBe("quota: remaining 63 < required 64");
    expect(await db.select().from(dailyRosters)).toEqual([]);
  });

  it("stores an error row for a failed alliance and closes the read partial, once per day", async () => {
    const [ok = 0, bad = 0] = IDS;
    // D133: a failed row is named by the alliance's newest label.
    const seen = { firstSeenDay: "2026-11-09", lastSeenDay: "2026-11-09" };
    await db.insert(alliances).values({ unionId: bad, tag: "BAD", name: "Bad Example", ...seen });
    const v1 = fakeV1((id) =>
      id === bad ? new UpstreamError(503) : roster(id, ago(T0, minutes(1))),
    );

    const summary = await runDailyRead(deps(v1), db, "2026-11-10", ours([ok, bad]));
    const again = await runDailyRead(deps(v1), db, "2026-11-10", ours([ok, bad]));

    expect(summary).toMatchObject({ status: "partial", callsUsed: 3 });
    expect(summary?.failed).toEqual([{ unionId: bad, tag: "BAD", error: "v1 http 503" }]);
    expect(again).toBeNull();
    const rows = await db.select().from(dailyRosters).orderBy(dailyRosters.id);
    expect(rows.map((r) => [r.unionId, r.error, r.memberUids.length])).toEqual(
      expect.arrayContaining([
        [ok, null, 3],
        [bad, "v1 http 503", 0],
      ]),
    );
    expect(await db.select({ status: dailyReads.status }).from(dailyReads)).toEqual([
      { status: "partial" },
    ]);
  });

  it("stores no roster for a read that holds another alliance: an error row (D69 amendment)", async () => {
    const [ok = 0, bad = 0] = IDS;
    const read = (id: number) => roster(id, ago(T0, minutes(1)));
    await runDailyRead(deps(fakeV1(read)), db, "2026-11-09", ours([ok, bad]));
    // The next day, bad's answer carries ok's tag, name and members under bad's id.
    const v1 = fakeV1((id) => (id === bad ? { ...read(ok), unionId: bad } : read(id)));

    const summary = await runDailyRead(deps(v1), db, "2026-11-10", ours([ok, bad]));

    expect(summary?.failed.map((f) => [f.unionId, f.error])).toEqual([
      [bad, "v1 wrong alliance (tag)"],
    ]);
    expect(summary?.callsUsed).toBe(3);
  });

  it("keeps each member's frame as the player's current one, unless a newer read already set it (D65)", async () => {
    const [id = 0] = IDS;
    const read = async (day: string, at: Date, frameId: number) => {
      const r = roster(id, at);
      const members = r.members.map((m) => ({ ...m, frameId }));
      await runDailyRead(deps(fakeV1(() => ({ ...r, members }))), db, day, ours([id]));
    };
    const frames = async () =>
      (await db.select().from(playerFrames).orderBy(playerFrames.uid)).map((f) => f.frameId);

    await read("2026-11-10", ago(T0, minutes(30)), 5001);
    expect(await frames()).toEqual([5001, 5001, 5001]);
    await read("2026-11-11", ago(T0, minutes(1)), 5010);
    expect(await frames()).toEqual([5010, 5010, 5010]);
    await read("2026-11-12", ago(T0, minutes(60)), 5026);
    expect(await frames()).toEqual([5010, 5010, 5010]);
  });
  it("keeps every roster field in raw_json, and the member history card serves none of the blocked keys (D72)", async () => {
    const [id = 0] = IDS;
    const raw: unknown = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../fixtures/v1-20261116T105019Z/alliance-67111155.json"),
        "utf8",
      ),
    );
    const at = ago(T0, minutes(1));
    await runDailyRead(deps(fakeV1(() => roster(id, at, { raw }))), db, "2026-11-10", ours([id]));

    const [row] = await db
      .select({ rawJson: dailyRosters.rawJson })
      .from(dailyRosters)
      .where(eq(dailyRosters.unionId, id));
    const stored = new Set(findBlockedKeys(row?.rawJson).map((p) => p.split(".").at(-1)));
    for (const key of BLOCKED_ROSTER_KEYS) expect(stored).toContain(key);
    const card = await memberHistoryCard(db, id, at);
    expect(card?.roster).toHaveLength(3);
    expect(findBlockedKeys(card)).toEqual([]);
  });
});

describe("a roster above its capacity (issue 481)", () => {
  const [id = 0] = IDS;
  const day = "2026-11-10";
  /** An invented /v1 body of `n` members; the last `unranked` have an empty rank. */
  function body(n: number, capacity: number, unranked: number) {
    const members = Array.from({ length: n }, (_, i) => {
      const ranked = i < n - unranked;
      return {
        uid: id * 1000 + i,
        nick_name: `Member ${i + 1}`,
        power: 1_000_000,
        kills: 10,
        lv: 30,
        rank_code: ranked ? 101 : null,
        rank_label: ranked ? "R1" : "",
      };
    });
    const at = ago(T0, minutes(1)).getTime() / 1000;
    return {
      union_id: id,
      abbr: "INV",
      name: "Invented",
      power: n * 1_000_000,
      member_count: n,
      capacity,
      level: 10,
      rank: { rank: 1 },
      updated_at: at,
      members,
    };
  }
  /** One daily read of the body; what the Members tab, the squads queue, the card and the log see. */
  async function read(b: ReturnType<typeof body>) {
    const a = toSnapshotInput(b, {
      cached: false,
      quota: { limit: 1000, used: 0, remaining: 900 },
      raw: b,
    });
    await runDailyRead(deps(fakeV1(() => a)), db, day, ours([id]));
    const [row] = await db
      .select({ memberCount: dailyRosters.memberCount })
      .from(dailyRosters)
      .where(eq(dailyRosters.unionId, id));
    const [members] = await endOfDayReads(db, id, 1);
    const lines = await db.select().from(runLogs).where(eq(runLogs.code, "roster.over_capacity"));
    return {
      memberCount: row?.memberCount,
      membersTab: members?.members.length,
      queue: (await dayRosterUids(db, day, id))?.length,
      card: (await allianceStatement(db, id))?.members,
      lines: lines.map((l) => l.data),
    };
  }

  it("keeps a 101/100 read without its unranked member, and logs the counts", async () => {
    expect(await read(body(101, 100, 1))).toEqual({
      memberCount: 100,
      membersTab: 100,
      queue: 100,
      card: 100,
      lines: [{ union_id: id, members: 101, capacity: 100, unranked: 1 }],
    });
  });

  it("keeps the unranked members of an alliance under capacity, and logs nothing", async () => {
    expect(await read(body(65, 100, 3))).toEqual({
      memberCount: 65,
      membersTab: 65,
      queue: 65,
      card: 65,
      lines: [],
    });
  });

  it("leaves a full 120/120 alliance untouched", async () => {
    expect(await read(body(120, 120, 0))).toEqual({
      memberCount: 120,
      membersTab: 120,
      queue: 120,
      card: 120,
      lines: [],
    });
  });
});

describe("autoRetryDailyRead (D72)", () => {
  const [kept = 0, bad = 0] = IDS;
  const day = "2026-11-10";
  /** The read at `T0` (23:37) fails `bad` and keeps `kept`'s roster, 15 minutes old then. */
  async function shortRead(badFailsAfter: boolean) {
    const clock = { now: T0 };
    const v1 = fakeV1((id) =>
      id === kept
        ? roster(id, ago(T0, minutes(15)))
        : clock.now === T0 || badFailsAfter
          ? new UpstreamError(503)
          : roster(id, ago(clock.now, minutes(1))),
    );
    const d = { v1, now: () => clock.now };
    expect(await runDailyRead(d, db, day, ours([kept, bad]))).toMatchObject({ status: "partial" });
    return { clock, v1, d };
  }

  it("judges the rosters it kept against the start of the read it completes, not its own", async () => {
    const { clock, v1, d } = await shortRead(false);
    clock.now = new Date(T0.getTime() + minutes(15));

    const summary = await autoRetryDailyRead(d, db, day, ours([kept, bad]));

    expect(v1.calls.slice(-1)).toEqual([bad]);
    expect(summary).toMatchObject({ status: "complete", stale: [], failed: [] });
  });

  it("runs once per day: a second automatic retry after one is recorded reads nothing", async () => {
    const { clock, v1, d } = await shortRead(true);
    clock.now = new Date(T0.getTime() + minutes(15));
    expect(await autoRetryDailyRead(d, db, day, ours([kept, bad]))).toMatchObject({
      status: "partial",
    });
    const calls = v1.calls.length;
    clock.now = new Date(T0.getTime() + minutes(30));

    expect(await autoRetryDailyRead(d, db, day, ours([kept, bad]))).toBeNull();
    expect(v1.calls).toHaveLength(calls);
  });

  it("reads nothing less than 10 minutes after the read started", async () => {
    const { clock, v1, d } = await shortRead(true);
    const calls = v1.calls.length;
    clock.now = new Date(T0.getTime() + minutes(9));

    expect(await autoRetryDailyRead(d, db, day, ours([kept, bad]))).toBeNull();
    expect(v1.calls).toHaveLength(calls);
  });
});
