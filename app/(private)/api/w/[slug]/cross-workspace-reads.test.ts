// Issue 471: what the desk's pages read for Alpha's officer when the address names Bravo's records (a notice,
// its history, posts and reviews, a draft, a roll call, a garrison plan, a member card), Home's activity
// pages, the Insights page's read (issue 489) and Follow-up's ready messages (D140). Each finds nothing of
// Bravo's. The pages call these reads after requireWorkspace, with the id from the address. Invented names
// only.
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { followUpView } from "@/lib/private/follow-up";
import { garrisonView } from "@/lib/private/garrison";
import { draftView } from "@/lib/private/import-view";
import { insightsView } from "@/lib/private/insights";
import { memberCard } from "@/lib/private/member-card";
import { lastPublish } from "@/lib/private/notice-publish";
import { noticeReviews } from "@/lib/private/notice-reviews";
import { noticeDetail, noticeHistory } from "@/lib/private/notices";
import { prepView } from "@/lib/private/raid-prep";
import { addCall, openOccasion } from "@/lib/private/roll-call";
import { callView } from "@/lib/private/roll-call-view";
import { quotaDayRead } from "@/lib/schedule";
import { dailyReads, dailyRosters } from "@/lib/schema";
import { workspaceKeys } from "@/lib/schema-keys";
import { playerHistory, playerReads, squadQueue, squadReads } from "@/lib/schema-squads";
import { PRIVATE_MARKERS } from "@/lib/workspace-data.test-helpers";
import { masterFingerprint } from "@/lib/workspace-keys";

import {
  ALPHA,
  BRAVO,
  call,
  type Ids,
  idsOf,
  SEED_AT,
  seedTwo,
  type Two,
  WEEK,
} from "./cross-workspace.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ZONE = "Etc/GMT+2";
let db: Db;
let two: Two;
let b: Ids;
let a: WorkspaceAccess;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  two = await seedTwo(db, holder);
  b = await idsOf(db, "bravo");
  const found = await requireWorkspace(
    db,
    "alpha",
    { get: () => ({ value: two.token.alpha }) },
    SEED_AT,
  );
  if (!found.ok) throw new Error("no access");
  a = found;
});

describe("the desk's pages given Bravo's ids, for Alpha's officer (issue 471)", () => {
  it("find no notice, history, post or review of Bravo's, and offer only Alpha's officers as reviewers", async () => {
    for (const n of b.notices) {
      expect(await noticeDetail(db, a, n)).toBeNull();
      expect((await noticeHistory(db, a, n)).versions).toEqual([]);
      expect(await lastPublish(db, a, n)).toBeNull();
      expect((await noticeReviews(db, a, n)).list).toEqual([]);
    }
    const [ours = 0] = (await idsOf(db, "alpha")).notices;
    expect((await noticeReviews(db, a, ours)).officers.map((o) => o.id)).not.toContain(b.officer);
  });

  it("find no draft, roll call, garrison plan or member card of Bravo's", async () => {
    for (const d of b.drafts) expect(await draftView(db, a, d, SEED_AT)).toBeNull();
    for (const c of b.calls) expect(await callView(db, a, { id: c }, "en", ZONE)).toBeNull();
    for (const entry of b.entries) {
      expect(await callView(db, a, { entry, week: WEEK }, "en", ZONE)).toBeNull();
      expect(await garrisonView(db, a, entry, WEEK)).toBeNull();
    }
    const at = { now: SEED_AT, zone: ZONE, language: "en" as const, t: WORKSPACE_DICTIONARIES.en };
    expect(await memberCard(db, a, 202, at)).toBeNull();
    expect(await memberCard(db, a, 101, at)).not.toBeNull();
  });

  it("show Alpha's Raid prep with Alpha's tracker readings only (D137)", async () => {
    // Friday 23:31 ST: Bravo's member seen with a shield, Alpha's member not.
    const night = new Date("2026-11-21T01:31:00Z");
    await db.insert(playerReads).values([
      { unionId: BRAVO, uid: 202, readAt: night, shielding: 1, shieldType: 0, mapUpdatedAt: night },
      { unionId: ALPHA, uid: 101, readAt: night, shielding: 0, mapUpdatedAt: night },
    ]);
    const on = {
      ...a,
      features: { ...a.features, on: new Set([...a.features.on, "shield_check"]) },
    };
    const occasion = await addCall(
      db,
      on as WorkspaceAccess,
      { kind: "shield", day: "2026-11-21" },
      randomUUID(),
    );
    const opened = await openOccasion(db, on as WorkspaceAccess, occasion);
    const view = await prepView(db, on as WorkspaceAccess, opened as NonNullable<typeof opened>, {
      zone: ZONE,
      now: night,
    });
    expect(view.rows.has(202)).toBe(false);
    expect(view.night).toMatchObject({ read: 1, on: 0 });
  });

  it("write Alpha's Follow-up messages from Alpha's own reads only, never Bravo's (D140)", async () => {
    // Alpha's member 101 gave 400 Alliance Help coins on the four days before the seeded read: the tip.
    for (const day of ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"]) {
      const at = new Date(`${day}T23:37:00Z`);
      await db.insert(dailyReads).values({ day, startedAt: at, status: "complete" });
      await db.insert(dailyRosters).values({
        readDay: day,
        unionId: ALPHA,
        memberCount: 1,
        sourceUpdatedAt: at,
        isFresh: true,
        memberUids: [101],
        memberNames: ["Ana Example"],
        memberPower: [1000],
        memberKills: [10],
        rawJson: { members: [{ uid: 101, nick_name: "Ana Example", daily_honor: 400 }] },
      });
    }
    // Alpha's own read of 101 says English (seeded); Bravo's workspace read the same player later, in
    // French, and its own member 202.
    const later = new Date(SEED_AT.getTime() + 3_600_000);
    await db.insert(playerReads).values([
      { unionId: BRAVO, uid: 101, readAt: later, language: "fr" },
      { unionId: BRAVO, uid: 202, readAt: later, language: "fr" },
    ]);
    // The next week, so the seeded "Talked" of 101 no longer takes them off the list.
    const view = await followUpView(db, a, new Date("2026-11-25T12:00:00Z"), ZONE);
    expect(view.items.map((i) => [i.member.uid, i.tip, i.language])).toEqual([[101, true, "en"]]);
  });

  it("Home's activity pages carry Alpha's lines only", async () => {
    const page = await call(two, "activity", {
      query: `?before=${SEED_AT.getTime() + 86_400_000}`,
    });
    expect(page.status).toBe(200);
    const text = JSON.stringify(page.json);
    expect(text).toContain("Officer alpha");
    expect(text).not.toMatch(/Officer bravo|Bravo plan|Bravo rules|Bravo old|Bryn Later/);
  });

  it("the read status bar carries each workspace's own squads counts, and no uid (D135)", async () => {
    // Both keys sealed under the current master key, so both squads reads run on their own keys.
    const secret = Buffer.alloc(32, 7).toString("base64");
    const ctx = holder.ctx as AppContext;
    holder.ctx = { ...ctx, env: { ...ctx.env, WORKSPACE_KEYS_SECRET: secret } };
    await db.update(workspaceKeys).set({ masterFp: masterFingerprint(secret) });
    const day = quotaDayRead(SEED_AT, ctx.env);
    await db.insert(dailyReads).values({ day, startedAt: SEED_AT, status: "complete" });
    const queue = async (unionId: number, members: number, done: number) => {
      const base = { day, unionId };
      await db
        .insert(squadReads)
        .values({ ...base, status: "running", startedAt: SEED_AT, members });
      const uids = Array.from({ length: members }, (_, i) => 7000 + i);
      await db.insert(squadQueue).values(
        uids.map((uid, i) => ({
          ...base,
          uid,
          state: i < done ? ("done" as const) : ("waiting" as const),
          dueAt: SEED_AT,
        })),
      );
    };
    await queue(ALPHA, 3, 2);
    await queue(BRAVO, 9, 7);
    const ours = JSON.stringify((await call(two, "read-status", {})).json);
    expect(ours).toContain("Squads: 2 of 3 read");
    expect(ours).not.toMatch(/of 9|7000|Bea Invented|Ana Example/);
    const theirs = JSON.stringify((await call(two, "read-status", { who: "bravo" })).json);
    expect(theirs).toContain("Squads: 7 of 9 read");
    expect(theirs).not.toContain("of 3 read");
  });
  it("the Insights read counts Alpha's own alliance only, with none of the roster's private fields", async () => {
    // Bravo's roster as an end-of-day read, and a history row of Bravo's naming Alpha's member.
    await db
      .update(dailyRosters)
      .set({
        rawJson: { members: [{ uid: 202, nick_name: "Bea Invented", power: 2000, active: 700 }] },
      })
      .where(eq(dailyRosters.unionId, BRAVO));
    await db.insert(playerHistory).values({
      unionId: BRAVO,
      uid: 101,
      t: new Date(SEED_AT.getTime() - 3_600_000),
      playerUnionId: BRAVO,
      unionAbbr: "BRV",
    });
    const view = await insightsView(db, a, SEED_AT, ZONE);
    expect(view.roster).toEqual([{ uid: 101, name: "Ana Example" }]);
    const text = JSON.stringify(view);
    expect(text).not.toMatch(/Bea Invented|"uid":202|BRV/);
    for (const marker of PRIVATE_MARKERS) expect(text).not.toContain(marker);
    const bravo = await requireWorkspace(
      db,
      "bravo",
      { get: () => ({ value: two.token.bravo }) },
      SEED_AT,
    );
    if (!bravo.ok) throw new Error("no access");
    expect((await insightsView(db, bravo, SEED_AT, ZONE)).roster).toEqual([
      { uid: 202, name: "Bea Invented" },
    ]);
  });
});
