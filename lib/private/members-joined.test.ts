// A member who joined in the last 7 days is worth a hello in Follow-up, with the join date as evidence (issue
// 828): still New on the Members tab, no reason to check in and no count of members to look at; left out once
// the 7 days have passed and while the member is on a break. Invented data only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace } from "./access";
import { followUpCounts, followUpView } from "./follow-up";
import { helloOnly, worklist } from "./follow-up-rules";
import { saveFacts, type FactChange } from "./member-facts";
import { membersView, type MemberRow } from "./members";
import { statusOf } from "./members-sheet";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const ZONE = "Etc/GMT+2";
/** The newest read: Saturday 2026-11-14 23:37 ST, 2026-11-15T01:37Z. */
const JOINED = new Map([
  [1, "2026-11-11T12:00:00Z"],
  [2, "2026-11-07T12:00:00Z"],
  [3, "2026-11-12T12:00:00Z"],
  // After the read: no join date to say (the e2e seed's sentinels).
  [4, "2086-05-21T06:07:08Z"],
]);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // An earlier read without them, so they were first seen on the newest one and are New.
  await roster("2026-11-13", [9]);
  await roster("2026-11-14", [...JOINED.keys()]);
});

async function roster(day: string, uids: number[]) {
  const at = new Date(`${day}T23:37:00-02:00`);
  await db.insert(dailyReads).values({ day, startedAt: at, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: uids.length,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
    rawJson: {
      members: uids.map((uid) => ({
        uid,
        nick_name: `P${uid}`,
        power: 1000,
        lv: 25,
        rank_code: 103,
        rank_label: "R3",
        joined_at: JOINED.get(uid),
      })),
    },
  });
}

async function signIn() {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "officer-ogs", "Officer", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/** Every fact Follow-up asks a new member for, recorded for `uids`. */
async function recordAllFacts(access: Awaited<ReturnType<typeof signIn>>, uids: number[]) {
  const changes: Omit<FactChange, "version" | "source">[] = [
    { field: "squadMight", value: 1_000_000 },
    { field: "troopTier", value: 8 },
    { field: "adTech", value: 50 },
    { field: "timeZone", value: "Europe/Paris" },
    { field: "languages", value: ["en"] },
  ];
  for (const uid of uids)
    await saveFacts(
      db,
      access,
      uid,
      changes.map((c) => ({ ...c, version: 0, source: "officer" }) as FactChange),
      NOW,
    );
}

async function read(onBreak = false) {
  const access = await signIn();
  if (onBreak)
    await saveFacts(
      db,
      access,
      3,
      [{ field: "status", version: 0, value: "break", source: "officer" }],
      NOW,
    );
  const view = await membersView(db, access, NOW, ZONE);
  return (uid: number) => view.members.find((m) => m.uid === uid) as MemberRow;
}

describe("a member who joined this week (issue 828)", () => {
  it("is worth a hello with the join date when joined_at is within 7 days of the newest read", async () => {
    expect((await read())(1).joinedHello).toEqual(new Date("2026-11-11T12:00:00Z"));
  });

  it("stays New on the Members tab, with no reason to check in", async () => {
    const m = (await read())(1);
    expect(m.reasons).toEqual([]);
    expect(statusOf(m)).toBe("new");
  });

  it("is on Follow-up's list for a hello alone, which adds to no count of members to look at", async () => {
    const [item] = worklist([(await read())(1)], new Set());
    expect(item).toMatchObject({ hello: true, checkIn: false });
    // A new member's facts still to ask put them among those to look at anyway (D104); a hello adds none.
    const none = { ...(item as NonNullable<typeof item>), toAsk: [] };
    expect(helloOnly(none)).toBe(true);
  });

  it("counts a hello among the members to look at only with a fact still to ask", async () => {
    const access = await signIn();
    const week = async () => {
      const view = await membersView(db, access, NOW, ZONE);
      const counts = await followUpCounts(db, access, view, NOW, ZONE);
      const page = await followUpView(db, access, NOW, ZONE);
      return { toLook: counts?.toLook, listed: page.items.map((i) => i.member.uid) };
    };
    // 1 to 4 are new, 1 and 3 with a hello; all have facts to ask: all counted.
    expect(await week()).toEqual({ toLook: 4, listed: [1, 2, 3, 4] });
    // With every fact recorded the hello alone is listed, and counted for no one.
    await recordAllFacts(access, [1, 2, 3, 4]);
    expect(await week()).toEqual({ toLook: 0, listed: [1, 3] });
  });

  it("is not worth a hello once 7 days have passed since joined_at, nor with a join date after the read", async () => {
    const m = await read();
    expect([m(2).joinedHello, m(4).joinedHello]).toEqual([null, null]);
  });

  it("is never worth a hello while the member is on a break", async () => {
    const m = (await read(true))(3);
    expect(m.joinedHello).toBeNull();
    expect(worklist([m], new Set())).toEqual([]);
  });
});
