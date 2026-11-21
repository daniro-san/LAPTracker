import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  appErrors,
  calendarEntries,
  dailyReads,
  garrisonPlans,
  workspaces,
  workspaceSessions,
  workspaceUsers,
} from "../schema";
import { thanksShares } from "../schema-board";
import { noticePublishes, notices } from "../schema-notices";
import { shieldChecks } from "../schema-shield";
import { squadReads } from "../schema-squads";
import { allianceUsage } from "./admin-alliances";

// 21:00 server time (UTC-2) on Nov 20 is 23:00 UTC: still the UTC day of Nov 20, read day Nov 20.
const NOW = new Date("2026-11-20T23:00:00Z");
const DAY = "2026-11-20";
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

let db: Db;
let a: number;
let b: number;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const rows = await db
    .insert(workspaces)
    .values([
      { unionId: 101, slug: "amber", discordGuildId: "1", leaderRoleIds: ["9"] },
      { unionId: 202, slug: "birch", discordGuildId: "2", leaderRoleIds: ["9"] },
    ])
    .returning({ id: workspaces.id });
  [a, b] = rows.map((r) => r.id) as [number, number];
});

const days = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const d = new Date(`${DAY}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - from - i);
    return d.toISOString().slice(0, 10);
  });

describe("allianceUsage (issue 485, D144)", () => {
  it("adds the squads read's and the Raid Shield morning read's calls of the quota day and the 6 before", async () => {
    // Today, 6 days ago (in) and 7 days ago (out).
    const [today, sixAgo, sevenAgo] = [DAY, ...days(6, 7)] as [string, string, string];
    await db.insert(dailyReads).values(
      [today, sixAgo, sevenAgo].map((day) => ({
        day,
        startedAt: NOW,
        status: "complete" as const,
      })),
    );
    const read = { status: "done" as const, startedAt: NOW, members: 10 };
    await db.insert(squadReads).values([
      { ...read, day: today, unionId: 101, callsUsed: 40 },
      { ...read, day: sixAgo, unionId: 101, callsUsed: 100 },
      { ...read, day: sevenAgo, unionId: 101, callsUsed: 999 },
      { ...read, day: today, unionId: 202, callsUsed: 5 },
    ]);
    await db.insert(shieldChecks).values({ day: today, unionId: 101, morningCalls: 12 });

    const usage = await allianceUsage(db, DAY, NOW);
    expect(usage.get(a)).toMatchObject({ callsToday: 52, calls7d: 152 });
    expect(usage.get(b)).toMatchObject({ callsToday: 5, calls7d: 5 });
  });

  it("counts the webhook posts that went through since 00:00 UTC: notices, garrison plans, thanks and the shield summary", async () => {
    const [notice] = await db
      .insert(notices)
      .values({ workspaceId: a, createdAt: NOW, updatedAt: NOW })
      .returning({ id: notices.id });
    const publish = {
      workspaceId: a,
      noticeId: (notice as { id: number }).id,
      audience: "members",
      languages: "en",
    };
    await db.insert(noticePublishes).values([
      { ...publish, requestId: "r1", status: "posted", messages: 2, publishedAt: ago(1) },
      { ...publish, requestId: "r2", status: "failed", publishedAt: ago(1) },
      // Yesterday (UTC), though the same server day.
      { ...publish, requestId: "r3", status: "posted", publishedAt: ago(23.5) },
    ]);
    const [entry] = await db
      .insert(calendarEntries)
      .values({ workspaceId: a, kind: "undead", day: DAY, minute: 600 })
      .returning({ id: calendarEntries.id });
    await db.insert(garrisonPlans).values({
      workspaceId: a,
      entryId: (entry as { id: number }).id,
      week: "2026-11-16",
      postStatus: "posted",
      postedAt: ago(2),
    });
    const share = { workspaceId: a, week: "2026-11-16", texts: {}, names: [], status: "posted" };
    await db.insert(thanksShares).values([
      { ...share, requestId: "t1", target: "discord", sharedAt: ago(3) },
      { ...share, requestId: "t2", target: "board", sharedAt: ago(3) },
    ]);
    await db.insert(dailyReads).values({ day: DAY, startedAt: NOW, status: "complete" });
    await db.insert(shieldChecks).values({ day: DAY, unionId: 202, postedAt: ago(4) });

    const usage = await allianceUsage(db, DAY, NOW);
    expect(usage.get(a)?.postsToday).toBe(3);
    expect(usage.get(b)?.postsToday).toBe(1);
  });

  it("counts the errors under each workspace's address in the last 24 h", async () => {
    const error = { route: "/w/[slug]/thefts", message: "render Error", digest: null };
    await db.insert(appErrors).values([
      { ...error, at: ago(1), workspaceSlug: "amber" },
      { ...error, at: ago(23), workspaceSlug: "amber" },
      { ...error, at: ago(25), workspaceSlug: "amber" },
      { ...error, at: ago(1), workspaceSlug: "nobody" },
      { ...error, at: ago(1), workspaceSlug: null },
    ]);

    const usage = await allianceUsage(db, DAY, NOW);
    expect(usage.get(a)?.errors24h).toBe(2);
    expect(usage.get(b)?.errors24h).toBe(0);
  });

  it("gives the newest desk request of an officer's session, never a member's", async () => {
    const users = await db
      .insert(workspaceUsers)
      .values([
        { workspaceId: a, discordUserId: "11" },
        { workspaceId: a, discordUserId: "12" },
      ])
      .returning({ id: workspaceUsers.id });
    const [officer, member] = users.map((u) => u.id) as [number, number];
    const session = { workspaceId: a, createdAt: ago(48), expiresAt: ago(-100) };
    await db.insert(workspaceSessions).values([
      { ...session, tokenHash: "h1", workspaceUserId: officer, seenAt: ago(30) },
      { ...session, tokenHash: "h2", workspaceUserId: officer, seenAt: ago(5) },
      { ...session, tokenHash: "h3", workspaceUserId: member, tier: "member", seenAt: ago(1) },
    ]);

    const usage = await allianceUsage(db, DAY, NOW);
    expect(usage.get(a)?.officerSeenAt).toEqual(ago(5));
    expect(usage.get(b)?.officerSeenAt).toBeNull();
  });
});
