// #678: every count on Insights that stands for a set of members opens exactly those members, from the
// function that counts them (one rule per set). Read from PGlite through insightsView and the words, on one
// alliance: nine members over six daily updates, one on a break, one who left and one who joined. The time
// zone counts that link to Members are checked against Members' own list on the same data. Invented values.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters, memberFacts } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { LANGUAGES } from "./fact-fields";
import { insightsView } from "./insights";
import type { MemberSet } from "./insights-sets";
import { insightsWords } from "./insights-words";
import { nextKvk, nextReset, NOT_RECORDED, usualAt, usualHours } from "./insights-zones";
import { zonesWords } from "./insights-zones-words";
import { membersView } from "./members";
import {
  clockAt,
  keepMembers,
  listMember,
  pickQuery,
  queryString,
  type MemberQuery,
} from "./members-list";
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

/** Member uid u is "P<u>" with might (u − 100) M and the same daily figures every day. */
async function roster(day: string, uids: number[]) {
  await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OURS,
    tag: "OG",
    name: "Our Hall",
    memberCount: uids.length,
    sourceUpdatedAt: new Date(`${day}T23:31:00-02:00`),
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map((u) => (u - 100) * 1_000_000),
    memberKills: uids.map(() => 0),
    rawJson: {
      members: uids.map((uid) => ({
        uid,
        nick_name: `P${uid}`,
        power: (uid - 100) * 1_000_000,
        active: 400,
        daily_honor: 1000,
        daily_tech: 3000,
      })),
    },
  });
}

/**
 * Mon 16 to Sat 21 Nov: 101–109 at the first update; 109 leaves after the 17th; 110 joins on the 19th
 * (new, so left out of the effort groups); 108 is on a break; 101–103 have a time zone.
 */
async function alliance(): Promise<WorkspaceAccess> {
  const first = [101, 102, 103, 104, 105, 106, 107, 108, 109];
  const stayed = first.filter((u) => u !== 109);
  for (const [day, uids] of [
    ["2026-11-16", first],
    ["2026-11-17", first],
    ["2026-11-18", stayed],
    ["2026-11-19", [...stayed, 110]],
    ["2026-11-20", [...stayed, 110]],
    ["2026-11-21", [...stayed, 110]],
  ] as const)
    await roster(day, [...uids]);
  await saveWorkspace(db, {
    unionId: OURS,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const workspaceId = ws?.id ?? 0;
  const userId = await recordSignIn(db, workspaceId, "ogs-ana", "Ana", NOW);
  const fact = (uid: number, field: string, value: unknown) => ({
    workspaceId,
    uid,
    field,
    version: 1,
    value,
    source: "officer" as const,
    writtenBy: userId,
    writtenAt: NOW,
  });
  await db
    .insert(memberFacts)
    .values([
      fact(108, "status", "break"),
      fact(101, "timeZone", "Europe/Paris"),
      fact(102, "timeZone", "Asia/Manila"),
      fact(103, "timeZone", "America/New_York"),
    ]);
  const { token } = await createSession(db, workspaceId, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

const names = (set: MemberSet | null | undefined) => set?.people.map((p) => p.name) ?? null;

/** Members' own list for `query` on the same data: the rows its page sends, filtered by its own rule. */
async function membersList(access: WorkspaceAccess, query: MemberQuery) {
  const view = await membersView(db, access, NOW, ZONE);
  const rows = view.members.map((m) => listMember({ ...m, pastNames: [] }));
  return keepMembers(rows, query, clockAt(TODAY, ZONE)).kept.map((m) => m.uid);
}

describe("Insights' counts open exactly the members they count (#678)", () => {
  it("names each might group's members, by name, its count that list's length", async () => {
    const view = await insightsView(db, await alliance(), NOW, ZONE);
    const ranges = insightsWords(view, t, "en").effort?.ranges ?? [];
    // 101–107 compared (108 on a break, 110 new): four groups by might, the highest first.
    expect(ranges.map((r) => names(r.set))).toEqual([
      ["P106", "P107"],
      ["P104", "P105"],
      ["P102", "P103"],
      ["P101"],
    ]);
    expect(ranges.map((r) => r.value)).toEqual(
      ranges.map((r) => `${r.set?.people.length} members`),
    );
  });

  it("names who is left out of the comparison, by kind, and nobody before there are groups", async () => {
    const access = await alliance();
    const effort = insightsWords(await insightsView(db, access, NOW, ZONE), t, "en").effort;
    expect(effort?.leftOut.map((k) => [k.label, names(k.set)])).toEqual([
      ["1 new", ["P110"]],
      ["1 on a break", ["P108"]],
    ]);
    // Two daily updates are too few for groups (D139): no names either.
    await db.delete(dailyRosters);
    await db.delete(dailyReads);
    for (const day of ["2026-11-20", "2026-11-21"])
      await roster(day, [101, 102, 103, 104, 105, 108]);
    const few = insightsWords(await insightsView(db, access, NOW, ZONE), t, "en").effort;
    expect(few?.based.join(" ")).toContain("1 on a break");
    expect(few?.leftOut).toEqual([]);
  });

  it("names who joined and who left in each week, a leaver as a former member", async () => {
    const view = await insightsView(db, await alliance(), NOW, ZONE);
    const weeks = insightsWords(view, t, "en").flow?.weeks ?? [];
    const week = weeks.at(-1);
    expect([week?.joined.value, week?.joined.set?.people]).toEqual([
      "+1",
      [{ uid: 110, name: "P110", current: true }],
    ]);
    expect([week?.left.value, week?.left.set?.people]).toEqual([
      "−1",
      [{ uid: 109, name: "P109", current: false }],
    ]);
    // The weeks before had nobody join or leave: nothing to open.
    expect(weeks.slice(0, -1).flatMap((w) => [w.joined.set, w.left.set])).toEqual(
      weeks.slice(0, -1).flatMap(() => [null, null]),
    );
  });

  it("names the members in each tenure band, its count that list's length", async () => {
    const view = await insightsView(db, await alliance(), NOW, ZONE);
    const tenure = insightsWords(view, t, "en").flow?.tenure ?? [];
    // The date's space is a no-break one, as the page writes it.
    expect(tenure.map((r) => [r.label.replace(/\s/gu, " "), r.value, names(r.set)])).toEqual([
      ["Under 2 weeks", "1", ["P110"]],
      [
        "Already here at our first daily update, Nov 16",
        "8",
        ["P101", "P102", "P103", "P104", "P105", "P106", "P107", "P108"],
      ],
    ]);
  });

  it("counts “Not recorded yet” as Members' Missing info: time zone lists on the same data", async () => {
    const access = await alliance();
    const view = await insightsView(db, access, NOW, ZONE);
    const moments = {
      now: NOW,
      reset: nextReset(TODAY, ZONE),
      kvk: nextKvk(NOW, TODAY, ZONE, 6, "12:00"),
    };
    const f = { t, language: "en" as const, serverZone: ZONE, today: TODAY, people: view.people };
    const listed = await membersList(access, NOT_RECORDED);
    expect(listed.sort()).toEqual([104, 105, 106, 107, 108, 110]);
    expect(zonesWords(view.zones, moments, f).details?.missing).toBe(String(listed.length));
  });

  it("counts the members in their usual hours at each server hour as Members' daytime filter lists them", async () => {
    const access = await alliance();
    const view = await insightsView(db, access, NOW, ZONE);
    const byHour = usualHours(view.zones, TODAY, ZONE);
    const listed = await Promise.all(
      Array.from({ length: 24 }, (_, hour) => membersList(access, usualAt(hour))),
    );
    expect(listed.flat().length).toBeGreaterThan(0);
    expect(byHour).toEqual(listed.map((l) => l.length));
  });

  it("links “Not recorded yet” and usual hours to Members with the very query they count with", () => {
    for (const query of [NOT_RECORDED, ...Array.from({ length: 24 }, (_, h) => usualAt(h))])
      expect(pickQuery(new URLSearchParams(queryString(query, "rank")), LANGUAGES)).toEqual(query);
    expect(queryString(NOT_RECORDED, "rank")).toBe("ask=timeZone");
    expect(queryString(usualAt(11), "rank")).toBe("day=11");
  });
});
