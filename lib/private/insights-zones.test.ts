// The Insights page's Time zones card (owner, 2026-11-22): the members' recorded time zones read from PGlite
// through insightsView and written by zonesWords, grouped by offset west to east, a summer-time change that
// splits a group, the members with none recorded, and the reset and KvK on a zone's own clock. Invented values.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFacts } from "../schema";
import { requireWorkspace } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { insightsView } from "./insights";
import { busiestHours, nextKvk, nextReset, type Moments } from "./insights-zones";
import { zonesWords } from "./insights-zones-words";
import { createSession } from "./session";

const OURS = 67111155;
const ZONE = "Etc/GMT+2";
/** Sunday 2026-11-22, 13:00 ST. */
const NOW = new Date("2026-11-22T15:00:00Z");
const TODAY = "2026-11-22";
const t = WORKSPACE_DICTIONARIES.en;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => truncateAll(db));

async function roster(day: string, uids: number[]) {
  await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OURS,
    tag: "OG",
    name: "Our Hall",
    memberCount: uids.length,
    sourceUpdatedAt: NOW,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map((u) => u * 100_000),
    memberKills: uids.map(() => 0),
    rawJson: { members: uids.map((uid) => ({ uid, nick_name: `P${uid}`, power: uid * 100_000 })) },
  });
}

/** An officer of "ogs", and a way to record a member's time zone as the card's editor does (D80). */
async function officer() {
  await saveWorkspace(db, {
    unionId: OURS,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const workspaceId = ws?.id ?? 0;
  const userId = await recordSignIn(db, workspaceId, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, workspaceId, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  const zone = (uid: number, value: string | null, version = 1) =>
    db.insert(memberFacts).values({
      workspaceId,
      uid,
      field: "timeZone",
      version,
      value,
      source: "officer",
      writtenBy: userId,
      writtenAt: NOW,
    });
  return { access, zone };
}

/** The card's words for the alliance as of `now`, the next reset and the next KvK (Saturday 12:00 ST). */
async function card(
  access: Parameters<typeof insightsView>[1],
  now: Date,
  today: string,
  m?: Moments,
) {
  const view = await insightsView(db, access, now, ZONE);
  const moments = m ?? {
    now,
    reset: nextReset(today, ZONE),
    kvk: nextKvk(now, today, ZONE, 6, "12:00"),
  };
  return zonesWords(view.zones, moments, { t, language: "en", serverZone: ZONE, today });
}

describe("the Insights Time zones card (owner, 2026-11-22)", () => {
  it("groups the zones that share an offset, west to east, cities most members first", async () => {
    await roster("2026-11-21", [101, 102, 103, 104, 105, 106, 107, 108, 109]);
    const { access, zone } = await officer();
    for (const uid of [101, 102, 103]) await zone(uid, "Europe/Zurich");
    for (const uid of [104, 105, 106]) await zone(uid, "Europe/Paris");
    await zone(107, "Europe/Berlin");
    await zone(108, "Asia/Manila");
    await zone(109, "America/New_York");
    const words = await card(access, NOW, TODAY);
    expect(words.details?.rows.map((r) => [r.label, r.value, r.share])).toEqual([
      ["New York · UTC−5", "1", 1 / 9],
      ["Paris, Zurich and 1 more · UTC+1", "7", 7 / 9],
      ["Manila · UTC+8", "1", 1 / 9],
    ]);
    expect(words.based[0]).toBe(
      "Largest group: Paris, Zurich and 1 more (UTC+1), 7 of the 9 members with a time zone. The 00:00 ST reset is 03:00 for them.",
    );
  });

  it("counts only the newest daily update's members, and a cleared or missing zone as not recorded", async () => {
    await roster("2026-11-20", [101, 102, 103, 104, 105, 199]);
    await roster("2026-11-21", [101, 102, 103, 104, 105]);
    const { access, zone } = await officer();
    for (const uid of [101, 102, 103]) await zone(uid, "Asia/Manila");
    await zone(104, "Asia/Manila");
    await zone(104, null, 2);
    await zone(199, "Europe/London");
    const words = await card(access, NOW, TODAY);
    expect(words.based[1]).toBe(
      "Time zone recorded for 3 of the 5 members in the newest daily update.",
    );
    expect(words.details?.missing).toBe("2");
    expect(words.details?.rows.map((r) => [r.label, r.share])).toEqual([["Manila · UTC+8", 1]]);
  });

  it("splits zones whose clocks change before the reset, each on its own clock, and joins them after", async () => {
    await roster("2026-11-21", [101, 102]);
    const { access, zone } = await officer();
    await zone(101, "Europe/Paris");
    await zone(102, "Africa/Lagos");
    // Saturday before the EU change (Sunday 01:00 UTC): both UTC+1 now, Paris UTC+2 at the reset.
    const now = new Date("2027-03-27T20:00:00Z");
    const split = await card(access, now, "2027-03-27", {
      now,
      reset: new Date("2027-03-28T02:00:00Z"),
      kvk: new Date("2027-04-03T14:00:00Z"),
    });
    expect(split.details?.rows.map((r) => [r.label, r.times, r.change])).toEqual([
      ["Lagos · UTC+1", "Now 21:00 · Reset 03:00 · KvK Sat 15:00", null],
      [
        "Paris · UTC+1",
        "Now 21:00 · Reset 04:00 · KvK Sat 16:00",
        "Clocks change before the reset",
      ],
    ]);
    expect(split.based[0]).toBe(
      "Largest groups, 1 member each: Lagos (UTC+1), Paris (UTC+1). The 00:00 ST reset is 03:00 and 04:00 for them.",
    );
    const joined = await card(access, new Date("2026-11-25T12:00:00Z"), "2026-11-25");
    expect(joined.details?.rows.map((r) => r.label)).toEqual(["Lagos, Paris · UTC+1"]);
    expect(joined.based[0]).toBe(
      "All 2 members with a time zone are in one group: Lagos, Paris (UTC+1). The 00:00 ST reset is 03:00 for them.",
    );
  });

  it("says the reset and KvK on each zone's clock, with its weekday when its date is not the server's", async () => {
    await roster("2026-11-21", [101, 102, 103, 104]);
    const { access, zone } = await officer();
    await zone(101, "America/New_York");
    await zone(102, "Asia/Manila");
    await zone(103, "Asia/Manila");
    await zone(104, "Pacific/Kiritimati");
    const words = await card(access, NOW, TODAY);
    expect(words.details?.rows.map((r) => r.times)).toEqual([
      "Now 10:00 · Reset Sun 21:00 · KvK Sat 09:00",
      "Now 23:00 · Reset 10:00 · KvK Sat 22:00",
      "Now Mon 05:00 · Reset 16:00 · KvK Sun 04:00",
    ]);
    expect(words.details?.legend).toBe(
      "Times on their own clock: now (13:00 ST), at the next 00:00 ST reset (the raid starts at the one before KvK) and at KvK (Sat, Nov 28, 12:00 ST). Bar: share of the 4 members with a time zone.",
    );
  });

  it("shows the next KvK start, never one already running", () => {
    const at = (iso: string) =>
      nextKvk(new Date(iso), "2026-11-28", ZONE, 6, "12:00").toISOString();
    // Saturday 11:00 ST: today's; 13:00 ST, an hour into it: next Saturday's.
    expect(at("2026-11-28T13:00:00Z")).toBe("2026-11-28T14:00:00.000Z");
    expect(at("2026-11-28T15:00:00Z")).toBe("2026-12-05T14:00:00.000Z");
  });

  it("gives the server hours most members are within their usual hours as ranges, through midnight", async () => {
    expect(
      busiestHours([3, 3, ...Array<number>(9).fill(1), 3, 3, ...Array<number>(9).fill(1), 3, 3]),
    ).toEqual([
      { from: 11, to: 12, n: 3 },
      { from: 22, to: 1, n: 3 },
    ]);
    await roster("2026-11-21", [101, 102, 103, 104]);
    const { access, zone } = await officer();
    await zone(101, "America/New_York");
    await zone(102, "Asia/Manila");
    await zone(103, "Asia/Manila");
    const words = await card(access, NOW, TODAY);
    expect(words.details?.usual).toEqual({
      line: "Within their usual hours for the most: 11:00–12:59 and 22:00–01:59 ST, 3 of the 3 members with a time zone (1 not recorded). A guess from their time zone, for times you set, like rallies.",
      hour: 11,
    });
  });

  it("says no time zone is recorded yet, with no rows, then names the one member's group", async () => {
    await roster("2026-11-21", [101, 102]);
    const { access, zone } = await officer();
    expect(await card(access, NOW, TODAY)).toEqual({
      based: ["No time zone recorded yet for the 2 members in the newest daily update."],
      details: null,
    });
    await zone(101, "Asia/Manila");
    expect((await card(access, NOW, TODAY)).based[0]).toBe(
      "The one member with a time zone is in Manila (UTC+8). The 00:00 ST reset is 10:00 for them.",
    );
  });
});
