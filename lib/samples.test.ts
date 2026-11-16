// Event samples (D69) through the tick on PGlite: a KvK-shaped Saturday, Before 10:00 and After 16:15
// server (12:00 and 18:15 UTC), a sample every 15 minutes between them.
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_WEBHOOK, PUBLIC_WEBHOOK, TEST_ENV, testContext } from "./app-context.test-helpers";
import { sampleQuota } from "./budget";
import { ago, fakeV1, IDS, minutes, roster } from "./collector.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import {
  allianceHistory,
  eventSamples,
  memberHistory,
  memberHistoryIndex,
  playerHistory,
} from "./queries";
import { latestRehearsal } from "./queries/admin";
import { getEventPage } from "./queries/event-page";
import { createRehearsal } from "./rehearsal";
import { createManualEvent, dueSample } from "./repo/events";
import { startSample } from "./repo/snapshots";
import { executeSnapshot } from "./run";
import { allianceSnapshots, events, memberSnapshots, runLogs, snapshots } from "./schema";
import { runTick, type TickOutcome } from "./tick";

// Passes through, except where a test queues an answer: it makes the tick see a slot as free that another
// caller has just taken.
vi.mock("./repo/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./repo/events")>();
  return { ...actual, dueSample: vi.fn(actual.dueSample) };
});

const KVK = { ...TEST_ENV, SNAPSHOT_AFTER: "16:15", SAMPLE_EVERY_MIN: 15 };
/** The same shape over one hour (After 11:00 server): three samples, for the tests that read the pages. */
const SHORT = { ...KVK, SNAPSHOT_AFTER: "11:00" };
const ORIGIN = "https://laptracker.test";
/** A whole event is 26 collector runs on PGlite: 5–20 s, more under the full suite's parallel load. */
const FULL_EVENT_MS = 60_000;
const utc = (hhmm: string, day = "2026-11-07") => new Date(`${day}T${hhmm}:00Z`);
/** Every 15 minutes from `from` to `to`, both included ("12:00" … "18:15"). */
const grid = (from: string, to: string) => {
  const out: string[] = [];
  for (let t = utc(from).getTime(); t <= utc(to).getTime(); t += minutes(15))
    out.push(new Date(t).toISOString().slice(11, 16));
  return out;
};

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** Ticks at each time (20 s after it, as cron-job.org starts late); returns each tick's kind. */
async function tickAt(ctx: ReturnType<typeof testContext>, times: string[], day?: string) {
  const kinds: [string, TickOutcome["kind"]][] = [];
  for (const t of times) {
    ctx.clock.now = new Date(utc(t, day).getTime() + 20_000);
    kinds.push([t, (await runTick(ctx.ctx, db, ORIGIN)).kind]);
  }
  return kinds;
}

const rowsByPhase = () =>
  db
    .select({ id: snapshots.id, phase: snapshots.phase, slotAt: snapshots.slotAt })
    .from(snapshots)
    .orderBy(asc(snapshots.id));

/** What the public pages and routes show for the event, its alliances and a player. */
async function pages(eventId: number) {
  const [page, history, index, chain, player] = await Promise.all([
    getEventPage(db, eventId),
    memberHistory(db, IDS[0] as number),
    memberHistoryIndex(db, IDS[0] as number),
    allianceHistory(db, IDS[0] as number),
    playerHistory(db, (IDS[0] as number) * 10 + 1),
  ]);
  return { page, history, index, chain, player };
}

async function deleteSamples() {
  const ids = (await rowsByPhase()).filter((r) => r.phase === "sample").map((r) => r.id);
  await db.delete(runLogs).where(inArray(runLogs.snapshotId, ids));
  await db.delete(allianceSnapshots).where(inArray(allianceSnapshots.snapshotId, ids));
  await db.delete(snapshots).where(inArray(snapshots.id, ids));
}

describe("event samples through the tick (D69)", () => {
  it(
    "takes one sample per slot between Before and After, and a second tick in a slot takes none",
    async () => {
      const t = testContext(db, KVK);
      const kinds = await tickAt(t, [
        ...grid("12:00", "13:00"),
        "13:05",
        ...grid("13:15", "18:15"),
      ]);

      expect(kinds.filter(([, k]) => k === "run").map(([at]) => at)).toEqual(["12:00", "18:15"]);
      expect(kinds.find(([at]) => at === "13:05")).toEqual(["13:05", "idle"]);
      const rows = await rowsByPhase();
      expect(rows.filter((r) => r.phase !== "sample").map((r) => r.phase)).toEqual([
        "before",
        "after",
      ]);
      // 12:15 … 18:00: strictly after the Before's slot, strictly before after_at; 24 slots.
      expect(
        rows.filter((r) => r.phase === "sample").map((r) => r.slotAt?.toISOString().slice(11, 16)),
      ).toEqual(grid("12:15", "18:00"));
    },
    FULL_EVENT_MS,
  );

  it("stores a sample's members as arrays, with no member rows and no raw_json; Before and After keep both", async () => {
    const t = testContext(db, KVK);
    await tickAt(t, ["12:00", "12:15"]);

    const rows = await db
      .select({
        phase: snapshots.phase,
        raw: isNotNull(allianceSnapshots.rawJson),
        uids: allianceSnapshots.memberUids,
        members: memberSnapshots.id,
      })
      .from(allianceSnapshots)
      .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
      .leftJoin(memberSnapshots, eq(memberSnapshots.allianceSnapshotId, allianceSnapshots.id))
      .where(eq(allianceSnapshots.unionId, IDS[0] as number));
    const before = rows.filter((r) => r.phase === "before");
    const sample = rows.filter((r) => r.phase === "sample");
    expect(before).toHaveLength(3);
    expect(before.every((r) => r.raw && r.uids === null && r.members !== null)).toBe(true);
    expect(sample).toEqual([
      {
        phase: "sample",
        raw: false,
        uids: [1, 2, 3].map((i) => (IDS[0] as number) * 10 + i),
        members: null,
      },
    ]);
  });

  it("runs the After, not the sample, on a tick where both are due, and samples nothing after it", async () => {
    // After at 16:10 server (18:10 UTC): the 18:00 slot is still open when the After falls due.
    const t = testContext(db, { ...KVK, SNAPSHOT_AFTER: "16:10" });
    await tickAt(t, ["12:00"]);
    t.clock.now = utc("18:11");
    expect((await runTick(t.ctx, db, ORIGIN)).kind).toBe("run");
    t.clock.now = utc("18:13");
    expect((await runTick(t.ctx, db, ORIGIN)).kind).toBe("idle");

    expect((await rowsByPhase()).map((r) => r.phase)).toEqual(["before", "after"]);
  });

  it("skips a sample that would leave the After less than its reserve, and the After still runs", async () => {
    const t = testContext(db, KVK);
    await tickAt(t, ["12:00"]);
    // Enough for the After (requiredQuota(20) = 50), not for a sample on top of it (131).
    t.ctx.v1 = fakeV1((id) => roster(id, ago(t.clock.now, minutes(1))), sampleQuota(20) - 1);
    const kinds = await tickAt(t, ["12:15", "12:30", "18:15"]);

    expect(kinds.map(([, k]) => k)).toEqual(["sample", "sample", "run"]);
    const rows = await db
      .select({ phase: snapshots.phase, status: snapshots.status, error: snapshots.error })
      .from(snapshots)
      .orderBy(asc(snapshots.id));
    expect(rows).toEqual([
      { phase: "before", status: "complete", error: null },
      { phase: "sample", status: "failed", error: "quota: remaining 130 < required 131" },
      { phase: "sample", status: "failed", error: "quota: remaining 130 < required 131" },
      { phase: "after", status: "complete", error: null },
    ]);
  });

  it("reads a failed alliance into an error row with no internal fallback, and posts one admin message per event", async () => {
    const t = testContext(db, KVK);
    await tickAt(t, ["12:00"]);
    const failing = IDS[0] as number;
    t.ctx.v1 = fakeV1((id) =>
      id === failing ? new Error("timeout") : roster(id, ago(t.clock.now, minutes(1))),
    );
    const posted = t.posts.length;
    await tickAt(t, ["12:15", "12:30"]);

    const errors = await db
      .select({ error: allianceSnapshots.error })
      .from(allianceSnapshots)
      .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
      .where(eq(snapshots.phase, "sample"));
    expect(errors.filter((r) => r.error !== null)).toEqual([
      { error: "v1 Error" },
      { error: "v1 Error" },
    ]);
    expect(t.ctx.internal).toMatchObject({ calls: [] });
    const later = t.posts.slice(posted);
    expect(later.filter((p) => p.url === PUBLIC_WEBHOOK)).toEqual([]);
    expect(later.filter((p) => p.url === ADMIN_WEBHOOK)).toHaveLength(1);
    expect(later[0]?.content).toContain("Sample 10:15: partly done");
  });

  it("takes no sample for a manual round", async () => {
    const t = testContext(db, KVK);
    const day = "2026-11-04";
    t.clock.now = utc("15:00", day);
    const event = await createManualEvent(db, "Round", t.clock.now);
    await executeSnapshot(t.ctx, db, { event, phase: "before", force: false, origin: ORIGIN });
    const kinds = await tickAt(t, ["15:15", "15:30"], day);

    expect(kinds.map(([, k]) => k)).toEqual(["idle", "idle"]);
    expect((await rowsByPhase()).map((r) => r.phase)).toEqual(["before"]);
  });

  it("leaves the event page, member history, player page and public message as they are without samples", async () => {
    const times = grid("12:00", "13:00");
    const without = testContext(db, { ...SHORT, SAMPLE_EVERY_MIN: 0 });
    await tickAt(without, times);
    const publicText = (s: typeof without) =>
      [...s.posts, ...s.edits].filter((p) => p.url === PUBLIC_WEBHOOK).map((p) => p.content);
    const expectedMessages = publicText(without);
    await truncateAll(db);

    const t = testContext(db, SHORT);
    await tickAt(t, times);
    expect((await rowsByPhase()).filter((r) => r.phase === "sample")).toHaveLength(3);
    const shown = await pages(1);
    await deleteSamples();

    expect(shown).toEqual(await pages(1));
    expect(publicText(t)).toEqual(expectedMessages);
  });

  it("returns the event's Start, its samples and its End in time order from eventSamples", async () => {
    const t = testContext(db, SHORT);
    await tickAt(t, grid("12:00", "13:00"));

    const readings = (await eventSamples(db, 1)) ?? [];
    expect(readings.map((r) => r.kind)).toEqual(["before", "sample", "sample", "sample", "after"]);
    expect(readings.map((r) => r.at.toISOString().slice(11, 16))).toEqual(grid("12:00", "13:00"));
    const first = IDS[0] as number;
    const nse = readings[1]?.alliances.find((a) => a.unionId === first);
    expect(nse).toEqual({
      unionId: first,
      readAt: ago(utc("12:15"), minutes(1) - 20_000),
      isFresh: true,
      might: 6_000_000,
      kills: 300,
      members: 3,
      roster: [
        { uid: first * 10 + 1, might: 1_000_000, kills: 100 },
        { uid: first * 10 + 2, might: 2_000_000, kills: 200 },
        { uid: first * 10 + 3, might: 3_000_000, kills: null },
      ],
    });
    expect(readings[0]?.alliances.find((a) => a.unionId === first)?.roster).toHaveLength(3);
  });

  it("leaves a running sample and a failed alliance row out of eventSamples, and returns null for a rehearsal or an admin-only event", async () => {
    const t = testContext(db, SHORT);
    await tickAt(t, grid("12:00", "13:00"));
    const samples = (await rowsByPhase()).filter((r) => r.phase === "sample");
    const [running, failed] = samples.map((r) => r.id);
    await db
      .update(snapshots)
      .set({ status: "running" })
      .where(eq(snapshots.id, running as number));
    await db
      .update(allianceSnapshots)
      .set({ error: "timeout" })
      .where(
        and(
          eq(allianceSnapshots.snapshotId, failed as number),
          eq(allianceSnapshots.unionId, IDS[0] as number),
        ),
      );

    const readings = (await eventSamples(db, 1)) ?? [];
    expect(readings.map((r) => r.at.toISOString().slice(11, 16))).toEqual([
      "12:00",
      "12:30",
      "12:45",
      "13:00",
    ]);
    const unionIds = (kind: number) => readings[kind]?.alliances.map((a) => a.unionId);
    expect(unionIds(1)).toEqual((unionIds(2) ?? []).filter((id) => id !== IDS[0]));

    await db.update(events).set({ visibility: "admin" }).where(eq(events.id, 1));
    expect(await eventSamples(db, 1)).toBeNull();
    await db.update(events).set({ visibility: "standalone", isTest: true }).where(eq(events.id, 1));
    expect(await eventSamples(db, 1)).toBeNull();
  });

  it("samples a rehearsal between its Before and After, and the rehearsal verdict ignores the sample", async () => {
    const t = testContext(db, KVK);
    const day = "2026-11-04";
    t.clock.now = utc("14:50", day);
    // Before 15:05, After 15:35 (UTC): the 15:15 and 15:30 slots fall between them.
    const made = await createRehearsal(db, t.clock.now, t.ctx.env);
    expect(made.ok).toBe(true);
    const kinds = await tickAt(t, ["15:05", "15:15", "15:35"], day);

    expect(kinds.map(([, k]) => k)).toEqual(["run", "sample", "run"]);
    expect((await rowsByPhase()).map((r) => r.phase)).toEqual(["before", "sample", "after"]);
    const shown = await latestRehearsal(db, t.ctx.env.SNAPSHOT_WINDOW_MIN);
    expect(shown?.phases.map((p) => p.phase).sort()).toEqual(["after", "before"]);
    expect(shown?.verdict).not.toBeNull();
    await deleteSamples();
    expect(await latestRehearsal(db, t.ctx.env.SNAPSHOT_WINDOW_MIN)).toEqual(shown);
  });

  it("answers idle when another caller takes the slot between the tick's lookup and its claim", async () => {
    const t = testContext(db, KVK);
    await tickAt(t, ["12:00"]);
    t.clock.now = new Date(utc("12:15").getTime() + 20_000);
    const event = await dueSample(db, utc("12:15"));
    expect(event).not.toBeNull();
    // The other caller's claim lands after the tick's lookup found the slot free.
    await startSample(db, (event as { id: number }).id, utc("12:15"), t.clock.now);
    vi.mocked(dueSample).mockResolvedValueOnce(event);

    expect((await runTick(t.ctx, db, ORIGIN)).kind).toBe("idle");
    expect((await rowsByPhase()).map((r) => r.phase)).toEqual(["before", "sample"]);
  });
});
