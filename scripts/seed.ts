// `pnpm db:seed`: three fake past Saturdays built from fixtures/ rosters, so every UI state renders
// locally (plan Phase 5): a renamed alliance, a renamed member, a member who changes alliance, a
// stale row, a failed row (the "B" fallback), shrinking kills, a rehearsal, run logs and app errors.
// Refuses to touch a database that already has events; `--reset` empties the app's tables first.
// Never run it against production: it writes invented numbers (the events are named "Seed …").
import { pathToFileURL } from "node:url";

import { sql } from "drizzle-orm";

import { loadBase, rosterAt, type BaseAlliance, type BaseMember, type Phase } from "./seed-data";
import type { Db } from "../lib/db";
import {
  allianceSnapshots,
  appErrors,
  events,
  memberSnapshots,
  runLogs,
  snapshots,
} from "../lib/schema";

const HOUR = 3_600_000;
const SATURDAYS = ["2026-10-17", "2026-10-24", "2026-10-31"];

async function insertAlliance(
  db: Db,
  snapshotId: number,
  row: Omit<typeof allianceSnapshots.$inferInsert, "snapshotId">,
  members: BaseMember[],
) {
  const [inserted] = await db
    .insert(allianceSnapshots)
    .values({ ...row, snapshotId })
    .returning({ id: allianceSnapshots.id });
  const id = (inserted as { id: number }).id;
  for (let i = 0; i < members.length; i += 200) {
    await db.insert(memberSnapshots).values(
      members.slice(i, i + 200).map((m) => ({
        allianceSnapshotId: id,
        uid: m.uid,
        name: m.name,
        power: m.power,
        kills: m.kills,
        lv: m.lv,
        avatarUrl: m.avatarUrl,
      })),
    );
  }
}

interface Scenario {
  event: number;
  phase: Phase;
  at: Date;
}

/** One alliance's row for one snapshot; scripted: alliance 11 fails in event 0's after, alliance 9 is stale in event 2's after. */
function allianceValues(base: BaseAlliance[], i: number, { event, phase, at }: Scenario) {
  const a = base[i] as BaseAlliance;
  const r = rosterAt(base, i, event, phase);
  const common = {
    unionId: a.unionId,
    source: "v1" as const,
    rawJson: { seed: true },
    tag: r.tag,
    name: r.name,
    badgeId: i === 4 ? null : a.badgeId, // alliance 4 without a badge; fake on purpose
  };
  if (event === 0 && phase === "after" && i === 11) {
    return { row: { ...common, isFresh: false, error: "503 after 3 retries" }, members: [] };
  }
  const power = r.members.reduce((s, m) => s + m.power, 0);
  const kills = r.members.reduce((s, m) => s + m.kills, 0);
  const ranked = base.map((_, k) =>
    rosterAt(base, k, event, phase).members.reduce((s, m) => s + m.power, 0),
  );
  const stale = event === 2 && phase === "after" && i === 9;
  return {
    row: {
      ...common,
      memberCount: r.members.length,
      totalPower: power,
      totalKills: kills,
      serverRank: 1 + ranked.filter((p) => p > power).length,
      level: a.level + (i === 2 && event >= 1 ? 1 : 0),
      powerBoard: Math.round(power * 0.995),
      killsBoard: Math.round(kills * 0.99),
      sourceUpdatedAt: new Date(at.getTime() + 60_000 - (stale ? 45 * 60_000 : 30_000)),
      cached: false,
      isFresh: !stale,
    },
    members: r.members,
  };
}

async function seedPhase(
  db: Db,
  base: BaseAlliance[],
  eventId: number,
  s: Scenario,
): Promise<void> {
  const { event, phase, at } = s;
  const partial = (event === 2 || event === 0) && phase === "after";
  const quota = 900 - event * 40 - (phase === "after" ? 21 : 0);
  const [snap] = await db
    .insert(snapshots)
    .values({
      eventId,
      phase,
      startedAt: new Date(at.getTime() + 60_000),
      finishedAt: new Date(at.getTime() + 113_000),
      status: partial ? "partial" : "complete",
      callsUsed: 21,
      quotaRemainingBefore: quota,
      quotaRemainingAfter: quota - 20,
      boardPulledAt: new Date(at.getTime() - 12 * HOUR),
      durationMs: 52_000,
    })
    .returning({ id: snapshots.id });
  const snapshotId = (snap as { id: number }).id;
  for (const i of base.keys()) {
    const { row, members } = allianceValues(base, i, s);
    await insertAlliance(db, snapshotId, row, members);
  }
  if (event === 2 && phase === "before") await seedRunLogs(db, snapshotId, base);
}

async function seedEvent(db: Db, base: BaseAlliance[], event: number): Promise<void> {
  const day = new Date(`${SATURDAYS[event]}T12:00:00Z`);
  const afterAt = new Date(day.getTime() + 4 * HOUR);
  const [ev] = await db
    .insert(events)
    .values({
      name: `Seed Saturday Event ${SATURDAYS[event]}`,
      eventAtUtc: new Date(day.getTime() + 2 * HOUR),
      allianceIds: base.map((a) => a.unionId),
      beforeAt: day,
      afterAt,
    })
    .returning({ id: events.id });
  const eventId = (ev as { id: number }).id;
  await seedPhase(db, base, eventId, { event, phase: "before", at: day });
  await seedPhase(db, base, eventId, { event, phase: "after", at: afterAt });
}

async function seedRunLogs(db: Db, snapshotId: number, base: BaseAlliance[]): Promise<void> {
  const at = new Date("2026-10-31T12:01:00Z");
  const line = (
    i: number,
    level: "info" | "warn" | "error",
    code: string,
    unionId: number | null,
    data: object,
  ) => ({
    snapshotId,
    at: new Date(at.getTime() + i * 2_000),
    level,
    code,
    unionId,
    data,
  });
  await db.insert(runLogs).values([
    line(0, "info", "run.start", null, { phase: "before", alliances: base.length }),
    line(1, "info", "v1.fetch", (base[0] as BaseAlliance).unionId, {
      endpoint: "alliance",
      http_status: 200,
      cached: false,
      duration_ms: 1900,
      quota_remaining: 880,
    }),
    line(2, "warn", "v1.retry", (base[1] as BaseAlliance).unionId, {
      endpoint: "alliance",
      http_status: 502,
      retry_n: 1,
    }),
    line(3, "info", "v1.fetch", (base[1] as BaseAlliance).unionId, {
      endpoint: "alliance",
      http_status: 200,
      cached: false,
      duration_ms: 2200,
      quota_remaining: 878,
    }),
    line(4, "error", "v1.fetch", (base[11] as BaseAlliance).unionId, {
      endpoint: "alliance",
      http_status: 503,
      retry_n: 3,
    }),
    line(5, "info", "run.done", null, { status: "complete", calls_used: 21 }),
  ]);
}

async function seedRehearsal(db: Db, base: BaseAlliance[]): Promise<void> {
  const start = new Date("2026-10-30T16:00:00Z");
  const [ev] = await db
    .insert(events)
    .values({
      name: `REHEARSAL ${start.toISOString()}`,
      eventAtUtc: new Date(start.getTime() + 30 * 60_000),
      allianceIds: [],
      isTest: true,
      beforeAt: new Date(start.getTime() + 15 * 60_000),
      afterAt: new Date(start.getTime() + 45 * 60_000),
    })
    .returning({ id: events.id });
  const eventId = (ev as { id: number }).id;
  for (const phase of ["before", "after"] as const) {
    const at = new Date(start.getTime() + (phase === "before" ? 15 : 45) * 60_000);
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId,
        phase,
        startedAt: new Date(at.getTime() + 30_000),
        finishedAt: new Date(at.getTime() + 80_000),
        status: "complete",
        callsUsed: 21,
        quotaRemainingBefore: 950,
        quotaRemainingAfter: 930,
        durationMs: 50_000,
      })
      .returning({ id: snapshots.id });
    const snapshotId = (snap as { id: number }).id;
    for (const [i, a] of base.slice(0, 3).entries()) {
      const r = rosterAt(base, i, 1, phase);
      await insertAlliance(
        db,
        snapshotId,
        {
          unionId: a.unionId,
          tag: r.tag,
          name: r.name,
          memberCount: r.members.length,
          totalPower: r.members.reduce((s, m) => s + m.power, 0),
          totalKills: r.members.reduce((s, m) => s + m.kills, 0),
          source: "v1",
          sourceUpdatedAt: new Date(at.getTime() + 20_000),
          cached: false,
          isFresh: true,
        },
        [],
      );
    }
  }
}

export async function seed(db: Db, { reset = false }: { reset?: boolean } = {}): Promise<string> {
  if (reset) {
    await db.execute(
      sql`truncate run_logs, member_snapshots, alliance_snapshots, snapshots, rehearsal_slots, events, auth_attempts, app_errors restart identity cascade`,
    );
  }
  const existing = await db.select({ id: events.id }).from(events).limit(1);
  if (existing.length > 0)
    throw new Error("the database already has events; pass --reset to empty it first");
  const base = loadBase();
  for (const event of [0, 1, 2]) await seedEvent(db, base, event);
  await seedRehearsal(db, base);
  const when = new Date("2026-11-01T09:00:00Z");
  await db.insert(appErrors).values([
    { at: when, route: "/events/[id]", digest: "seed-1234", message: "render failed" },
    {
      at: new Date(when.getTime() + 60_000),
      route: "/events/[id]",
      digest: "seed-1234",
      message: "render failed",
    },
    {
      at: new Date(when.getTime() + 3_600_000),
      route: "/api/snapshot",
      digest: null,
      message: "route failed",
    },
  ]);
  return `seeded ${base.length} alliances × 3 events, 1 rehearsal`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (run via `pnpm db:seed`, which reads .env.local)");
    process.exit(2);
  }
  const { openDb } = await import("../lib/db");
  const { db, close } = openDb(url);
  try {
    console.log(await seed(db, { reset: process.argv.includes("--reset") }));
  } catch (e) {
    console.error(e instanceof Error ? e.message : "seed failed");
    process.exitCode = 1;
  } finally {
    await close();
  }
}
