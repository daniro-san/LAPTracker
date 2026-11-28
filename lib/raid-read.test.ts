// The raid opponent's reads (issue 861, D165) against PGlite with a stubbed /v1: the opponent and our own
// alliance are read once each on the tick of Saturday 00:00 ST and Sunday 00:00 ST, on the alliance's own
// key; a moved time reads on its own tick only and a missed tick is not caught up; a workspace with no key
// of its own is never read on LAP_API_KEY; the tick's gate opens only on a tick where a read is due.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { raidSide } from "./raid-opponent";
import { raidRead, type RaidDeps } from "./raid-read";
import { readsOf, setOpponent } from "./repo/raid-opponents";
import { setAllianceSwitch, setSwitch } from "./repo/workspace-features";
import { storeKey } from "./repo/workspace-keys";
import { findWorkspaceBySlug, saveWorkspace } from "./repo/workspaces";
import { dailyReads } from "./schema";
import { shieldSettings } from "./schema-shield";
import { squadReads } from "./schema-squads";
import type { AllianceSnapshotInput } from "./sources/types";
import { tickMayBeDue } from "./tick-gate";
import { sealKey } from "./workspace-keys";

const SAT = new Date("2026-12-12T02:00:00Z"); // Sat 00:00 ST, a KvK week
const SUN = new Date("2026-12-13T02:00:00Z"); // Sun 00:00 ST
const FRIDAY = "2026-12-11";
const SATURDAY = "2026-12-12";
/** Invented, low-entropy values: never real keys. */
const SECRET = Buffer.alloc(32, 7).toString("base64");
const THEIR_KEY = `lap_${"their-alliance-test-".repeat(2)}key`;
const OTHER = 67109944;
const ENEMY = 67190001;

let db: Db;
let ogs = 0;
let other = 0;

beforeAll(async () => {
  db = await openTestDb();
});

async function workspace(unionId: number, slug: string) {
  await saveWorkspace(db, { unionId, slug, discordGuildId: slug, leaderRoleIds: ["2"] });
  return (await findWorkspaceBySlug(db, slug))?.id ?? 0;
}

beforeEach(async () => {
  await truncateAll(db);
  ogs = await workspace(OWN_ALLIANCE_ID, "ogs");
  other = await workspace(OTHER, "other");
  await setSwitch(db, other, "shield_check", true, new Date(0));
  await setAllianceSwitch(db, other, "shield_check", true, new Date(0));
  for (const day of [FRIDAY, SATURDAY]) {
    await db.insert(dailyReads).values({
      day,
      startedAt: new Date(`${day}T23:30:00-02:00`),
      status: "complete",
      callsUsed: 21,
      quotaRemainingBefore: 900,
    });
    // The day's squads read is over: the gate has nothing else to open for.
    await db.insert(squadReads).values({
      day,
      unionId: OWN_ALLIANCE_ID,
      status: "done",
      startedAt: new Date(`${day}T23:31:00-02:00`),
      members: 3,
      quotaRemaining: 800,
    });
  }
});

const opponent = (workspaceId: number) =>
  setOpponent(db, {
    workspaceId,
    saturday: SATURDAY,
    server: 328,
    unionId: ENEMY,
    tag: "ZZZ",
    name: "Zeta",
    setBy: null,
    setAt: new Date("2026-12-11T12:00:00Z"),
  });

const saveTheirKey = () =>
  storeKey(
    db,
    other,
    sealKey(SECRET, other, THEIR_KEY),
    { status: "ok", quotaRemaining: 900 },
    new Date(0),
  );

/** An alliance's answer: members 1–3 of the alliance, kills growing with the clock. */
function answer(unionId: number, now: Date): AllianceSnapshotInput {
  const uids = [1, 2, 3].map((n) => unionId * 10 + n);
  const kills =
    Math.round((now.getTime() - SAT.getTime()) / 3_600_000) * (unionId === ENEMY ? 5 : 10);
  return {
    unionId,
    tag: unionId === ENEMY ? "ZZZ" : "OWN",
    name: "Example",
    memberCount: uids.length,
    totalPower: 3000,
    totalKills: 3 * kills,
    members: uids.map((uid) => ({ uid, name: `Wren${uid}`, power: 1000, kills, lv: 20 })),
    serverRank: null,
    level: null,
    sourceUpdatedAt: new Date(now.getTime() - 60_000),
    cached: false,
    sid: 328,
    quota: { limit: 1000, used: 100, remaining: 900 },
    raw: {},
  };
}

/** A /v1 stand-in: `keys` records each call (undefined: LAP_API_KEY). */
function deps(now: Date) {
  const keys: { call: number | "quota"; key: string | undefined }[] = [];
  const d: RaidDeps & { keys: typeof keys } = {
    keys,
    now: () => now,
    env: { ...TEST_ENV, WORKSPACE_KEYS_SECRET: SECRET },
    paceMs: 0,
    fetch: async () => Response.json({}),
    v1: {
      fetchAlliance: async (id, onAttempt, _signal, options) => {
        onAttempt?.(0);
        keys.push({ call: id, key: options?.apiKey });
        return answer(id, now);
      },
      fetchPlayer: async () => {
        throw new Error("no player call");
      },
      fetchQuota: async (onAttempt, _signal, options) => {
        if (!options?.apiKey) throw new Error("no quota call on LAP_API_KEY");
        onAttempt?.(0);
        keys.push({ call: "quota", key: options.apiKey });
        return { limit: 1000, used: 100, remaining: 900 };
      },
    },
  };
  return d;
}

const run = async (now: Date) => {
  const d = deps(now);
  await raidRead(d, db, now.getTime() + 180_000);
  return d.keys;
};

describe("the raid opponent's reads (issue 861)", () => {
  it("reads the opponent and our alliance once each at Saturday 00:00 ST and Sunday 00:00 ST, on the alliance's own key", async () => {
    await saveTheirKey();
    await opponent(other);
    const start = [
      { call: "quota", key: THEIR_KEY },
      { call: ENEMY, key: THEIR_KEY },
      { call: OTHER, key: THEIR_KEY },
    ];
    expect(await run(SAT)).toEqual(start);
    // A second tick inside the same 15 minutes sends nothing: each read's row is claimed.
    expect(await run(new Date("2026-12-12T02:07:00Z"))).toEqual([]);
    expect(await run(SUN)).toEqual(start);
    const reads = await readsOf(db, other, [SATURDAY]);
    expect(reads.map((r) => [r.phase, r.side, r.error, r.isFresh]).toSorted()).toEqual([
      ["end", "them", null, true],
      ["end", "us", null, true],
      ["start", "them", null, true],
      ["start", "us", null, true],
    ]);
    // 24 h of kills: +240 a member for us, +120 for them.
    expect(raidSide(reads, "us", OTHER).change).toEqual({ might: 0, kills: 720, members: 3 });
    expect(raidSide(reads, "them", ENEMY).change).toEqual({ might: 0, kills: 360, members: 3 });
  });

  it("reads a moved Start on its own tick only, and never catches up a tick that was missed", async () => {
    await opponent(ogs);
    await db
      .insert(shieldSettings)
      .values({ workspaceId: ogs, raidStartMinute: 30, updatedAt: SAT });
    expect(await run(SAT)).toEqual([]); // 00:00 ST: not this alliance's time
    const late = new Date("2026-12-12T02:30:00Z"); // 00:30 ST, on LAP_API_KEY: the own alliance
    expect(await run(late)).toEqual([
      { call: ENEMY, key: undefined },
      { call: OWN_ALLIANCE_ID, key: undefined },
    ]);
    // The End's tick (Sunday 00:00 ST) never came: at 00:15 ST nothing is read, and the End stays missing.
    expect(await run(new Date("2026-12-13T02:15:00Z"))).toEqual([]);
    const reads = await readsOf(db, ogs, [SATURDAY]);
    expect(raidSide(reads, "them", ENEMY)).toMatchObject({ end: null, change: null });
  });

  it("never reads a workspace with no key of its own on LAP_API_KEY", async () => {
    await opponent(other);
    expect(await run(SAT)).toEqual([]);
    expect(await readsOf(db, other, [SATURDAY])).toEqual([]);
  });

  it("opens the tick's gate only on the tick of a read that is due, once a save forgets", async () => {
    const { ctx, clock } = testContext(db);
    const at = (iso: string) => ((clock.now = new Date(iso)), tickMayBeDue(ctx, db));
    // No opponent: Saturday 00:00 ST asks nothing more once the workspaces were read.
    expect(await at("2026-12-12T02:00:00Z")).toBe(false);
    await opponent(ogs);
    expect(await at("2026-12-12T02:00:00Z")).toBe(false); // kept until a save forgets
    ctx.wakeCache.forget(); // what POST /api/w/[slug]/raid-opponent does
    expect(await at("2026-12-12T02:00:00Z")).toBe(true);
    expect(await at("2026-12-12T02:15:00Z")).toBe(false); // 00:15 ST: its tick is over
    expect(await at("2026-12-13T02:00:00Z")).toBe(true); // Sun 00:00 ST: the End
    expect(await at("2026-12-13T02:15:00Z")).toBe(false); // Sun 00:15 ST: the End's tick is over
  });
});
