// The Insights page's Time zones card (owner, 2026-11-22): the members' recorded time zones read from PGlite
// through insightsView and written by zonesWords, grouped by offset west to east, a summer-time change that
// splits a group, the members with none recorded, and the reset and KvK on a zone's own clock. Invented values.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFacts } from "../schema";
import { requireWorkspace } from "./access";
import { WORKSPACE_DICTIONARIES, type WorkspaceLanguage } from "./dictionary";
import { insightsView } from "./insights";
import { busiestHours, nextKvk, nextReset, type Moments } from "./insights-zones";
import { zonesWords } from "./insights-zones-words";
import { createSession } from "./session";

const OURS = 67111155;
const ZONE = "Etc/GMT+2";
/** Sunday 2026-11-22, 13:00 ST. */
const NOW = new Date("2026-11-22T15:00:00Z");
const TODAY = "2026-11-22";

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
  language: WorkspaceLanguage = "en",
) {
  const view = await insightsView(db, access, now, ZONE);
  const moments = m ?? {
    now,
    reset: nextReset(today, ZONE),
    kvk: nextKvk(now, today, ZONE, 6, "12:00"),
  };
  const words = WORKSPACE_DICTIONARIES[language];
  return zonesWords(view.zones, moments, {
    t: words,
    language,
    serverZone: ZONE,
    today,
    people: view.people,
  });
}

describe("the Insights Time zones card (owner, 2026-11-22)", () => {
  it("groups the zones that share an offset, west to east, cities most members first, each row naming exactly the members it counts", async () => {
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
    // #678: a row's names are the members it counts, in name order, and its number is that list's length.
    const rows = words.details?.rows ?? [];
    expect(rows.map((r) => r.set?.people.map((p) => p.name))).toEqual([
      ["P109"],
      ["P101", "P102", "P103", "P104", "P105", "P106", "P107"],
      ["P108"],
    ]);
    expect(rows.map((r) => r.value)).toEqual(rows.map((r) => String(r.set?.people.length)));
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
    // Each bar is out of all 5 members (D158): Manila is 3 of 5, not 3 of the 3 with a time zone, and
    // "Not recorded yet" is 2 of 5 on the same scale.
    expect(words.details?.rows.map((r) => [r.label, r.share])).toEqual([["Manila · UTC+8", 3 / 5]]);
    expect(words.details?.missingShare).toBe(2 / 5);
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

  it("says the clocks change before KvK when KvK comes first, and names a tie west to east", async () => {
    await roster("2026-11-21", [101, 102]);
    const { access, zone } = await officer();
    await zone(101, "Europe/London");
    await zone(102, "America/New_York");
    // Sunday 2027-03-14 03:00 ST; a Sunday KvK at 12:00 ST comes before the reset, and New York's clocks
    // go forward at 07:00 UTC in between.
    const now = new Date("2027-03-14T05:00:00Z");
    const words = await card(access, now, "2027-03-14", {
      now,
      kvk: new Date("2027-03-14T14:00:00Z"),
      reset: new Date("2027-03-15T02:00:00Z"),
    });
    expect(words.details?.rows.map((r) => [r.label, r.times, r.change])).toEqual([
      [
        "New York · UTC−5",
        "Now 00:00 · Reset Sun 22:00 · KvK Sun 10:00",
        "Clocks change before KvK",
      ],
      ["London · UTC+0", "Now 05:00 · Reset 02:00 · KvK Sun 14:00", null],
    ]);
    expect(words.based[0]).toBe(
      "Largest groups, 1 member each: New York (UTC−5), London (UTC+0). The 00:00 ST reset is Sun 22:00 and 02:00 for them.",
    );
  });

  it("says the reset and KvK on each zone's clock, with its weekday when its date is not the server's", async () => {
    await roster("2026-11-21", [101, 102, 103, 104, 105]);
    const { access, zone } = await officer();
    await zone(101, "America/New_York");
    await zone(102, "Asia/Manila");
    await zone(103, "Asia/Manila");
    await zone(104, "Pacific/Kiritimati");
    await zone(105, "Asia/Kolkata");
    const words = await card(access, NOW, TODAY);
    expect(words.details?.rows.map((r) => [r.label, r.times])).toEqual([
      ["New York · UTC−5", "Now 10:00 · Reset Sun 21:00 · KvK Sat 09:00"],
      ["Kolkata · UTC+5:30", "Now 20:30 · Reset 07:30 · KvK Sat 19:30"],
      ["Manila · UTC+8", "Now 23:00 · Reset 10:00 · KvK Sat 22:00"],
      ["Kiritimati · UTC+14", "Now Mon 05:00 · Reset 16:00 · KvK Sun 04:00"],
    ]);
    expect(words.details?.legend).toBe(
      "Times on their own clock: now (13:00 ST), at the next 00:00 ST reset (the raid starts at the one before KvK) and at KvK (Sat, Nov 28, 12:00 ST). Bar: share of all 5 members.",
    );
  });

  it("counts fixed-offset zones with no city, and names a row's cities by name", async () => {
    await roster("2026-11-21", [101, 102, 103, 104, 105, 106, 107]);
    const { access, zone } = await officer();
    await zone(101, "Etc/GMT-1");
    await zone(102, "Etc/GMT-1");
    await zone(103, "Africa/Lagos");
    await zone(104, "Europe/Amsterdam");
    await zone(105, "Etc/GMT-5");
    const rows = async (language: WorkspaceLanguage = "en") =>
      (await card(access, NOW, TODAY, undefined, language)).details?.rows.map((r) => [
        r.label,
        r.value,
      ]);
    expect(await rows()).toEqual([
      ["Amsterdam, Lagos · UTC+1", "4"],
      ["UTC+5", "1"],
    ]);
    await zone(106, "Europe/Paris");
    expect((await rows("fr"))?.[0]).toEqual(["Amsterdam, Lagos et 1 autre · UTC+1", "5"]);
    await zone(107, "Europe/Berlin");
    expect((await rows())?.[0]).toEqual(["Amsterdam, Berlin and 2 more · UTC+1", "6"]);
    expect((await rows("fr"))?.[0]).toEqual(["Amsterdam, Berlin et 2 autres · UTC+1", "6"]);
  });

  it("joins the reset's times as each language does, with and without a weekday", async () => {
    await roster("2026-11-21", [101, 102, 103]);
    const { access, zone } = await officer();
    await zone(101, "America/New_York");
    await zone(102, "Asia/Manila");
    const pt = await card(access, NOW, TODAY, undefined, "pt-BR");
    const fr = await card(access, NOW, TODAY, undefined, "fr");
    expect(pt.based[0]).toBe(
      "Maiores grupos, 1 membro cada: New York (UTC−5), Manila (UTC+8). Para eles, o reset das 00:00 ST é dom. às 21:00 e às 10:00.",
    );
    expect(fr.based[0]).toBe(
      "Groupes les plus nombreux, 1 membre chacun : New York (UTC−5), Manila (UTC+8). Pour eux, le reset de 00:00 ST est dim. à 21:00 et à 10:00.",
    );
    // One member with no time zone: the singular.
    expect(fr.details?.usual?.line).toContain(
      "2 des 2 membres avec un fuseau horaire (1 non noté).",
    );
    expect(pt.details?.usual?.line).toContain("2 dos 2 membros com fuso horário (1 sem registro).");
  });

  it("gives no usual-hours line with a single group", async () => {
    await roster("2026-11-21", [101, 102]);
    const { access, zone } = await officer();
    await zone(101, "Asia/Manila");
    await zone(102, "Asia/Manila");
    const words = await card(access, NOW, TODAY);
    expect(words.details?.rows).toHaveLength(1);
    expect(words.details?.usual).toBeNull();
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
