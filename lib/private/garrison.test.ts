// The garrison plan against the database (issue 423, D121): an officer's edited plan is stored per siege
// and read back, a save over an older version is refused, and the Discord post carries names and squad
// might only, never the activity it was ordered by.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { memberSquads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createEntry } from "./calendar";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { garrisonView, saveGarrison } from "./garrison";
import { postGarrison } from "./garrison-post";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const WEEK = "2026-11-16";
/** Bramble lends; Quillon and Wynnie need help. Activity 4242 orders them and must never be shared. */
const ROSTER = [
  { uid: 101, nick_name: "Bramble", power: 90e6, active: 10 },
  { uid: 102, nick_name: "Quillon", power: 30e6, active: 4242 },
  { uid: 103, nick_name: "Wynnie", power: 20e6, active: 0 },
];

let db: Db;
let access: WorkspaceAccess;
let entry: number;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-15",
    unionId: OGS,
    memberCount: ROSTER.length,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: ROSTER.map((m) => m.uid),
    memberNames: ROSTER.map((m) => m.nick_name),
    memberPower: ROSTER.map((m) => m.power),
    memberKills: ROSTER.map(() => 0),
    rawJson: { members: ROSTER },
  });
  const squad = (uid: number, n: number, power: number) => ({
    unionId: OGS,
    uid,
    squad: n,
    power,
    heroes: [],
    readAt: NOW,
  });
  await db
    .insert(memberSquads)
    .values([
      squad(101, 1, 15e6),
      squad(101, 2, 12e6),
      squad(101, 3, 11e6),
      squad(102, 1, 6e6),
      squad(103, 1, 7e6),
    ]);
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const signed = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!signed.ok) throw new Error("no access");
  access = signed;
  const made = await createEntry(
    db,
    access,
    {
      kind: "undead",
      level: 6,
      enemyMight: 8_000_000,
      day: "2026-11-21",
      minute: 720,
      notes: null,
      link: null,
      forMembers: false,
      notice: null,
      weekly: false,
    },
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  entry = made.id;
});

describe("the garrison plan", () => {
  it("keeps the officer's edited pairs and refuses a save over an older version", async () => {
    const first = await garrisonView(db, access, entry, WEEK);
    // The suggestion: Quillon (active) first gets the strongest spare, squad 2.
    expect(first?.view.pairs).toEqual([
      { helper: 101, squad: 2, member: 102 },
      { helper: 101, squad: 3, member: 103 },
    ]);
    expect(first?.view.rev).toBe(0);
    const moved = [{ helper: 101, squad: 2, member: 103 }];
    const pairs = { action: "save", entry, week: WEEK, pairs: moved } as const;
    expect(await saveGarrison(db, access, { ...pairs, rev: 0 }, NOW)).toEqual({ ok: true, rev: 1 });
    const again = await garrisonView(db, access, entry, WEEK);
    expect(again?.view.pairs).toEqual(moved);
    expect(again?.view.rev).toBe(1);
    expect(await saveGarrison(db, access, { ...pairs, rev: 0 }, NOW)).toEqual({
      ok: false,
      code: "stale",
    });
  });

  it("posts names and squad might to Discord, and nothing it was ordered by", async () => {
    const sent: string[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      return Response.json({ id: "1" });
    }) as typeof globalThis.fetch;
    const channel = { url: "https://discord.test/hook", name: "members", forum: false };
    const result = await postGarrison(
      db,
      access,
      { action: "post", entry, week: WEEK, requestId: randomUUID() },
      {
        fetch,
        now: NOW,
        channels: { members: channel, leaders: null },
        t: WORKSPACE_DICTIONARIES.en,
        language: "en",
      },
    );
    expect(result.ok).toBe(true);
    const content = (JSON.parse(sent.join("")) as { content: string }).content;
    expect(content).toContain("Enemy might 8.00M");
    expect(content).toContain("Bramble → Quillon: squad 2, 12.0M");
    expect(content).toContain("Bramble → Wynnie: squad 3, 11.0M");
    expect(content).not.toMatch(/4242|activ|grow|took part|90\.0M|30\.0M/i);
  });
});
