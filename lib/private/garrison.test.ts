// The garrison plan against the database (issue 423, D121): each siege keeps its own enemy might and its
// history, and the next one starts from the last; an officer's edited plan is stored per siege and read
// back, a save over an older version is refused; and the post goes to the chosen Discord channel with names
// and squad might only, never the activity it was ordered by.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { memberSquads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createEntry } from "./calendar";
import { removeEntry } from "./calendar-delete";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { garrisonView, saveEnemyMight, saveGarrison } from "./garrison";
import { postGarrison } from "./garrison-post";
import { saveCalloutFor } from "./post-callouts";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const WEEK = "2026-11-16";
/**
 * Bramble lends; Quillon needs help and Wynnie (8.2M) is close at 8M, fine at 7M. Activity 4242 orders
 * them and must never be shared.
 */
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
      squad(103, 1, 8.2e6),
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
      day: "2026-11-21",
      minute: 720,
      notes: null,
      link: null,
      forMembers: false,
      notice: null,
      weekly: true,
    },
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  entry = made.id;
  const set = await saveEnemyMight(db, access, enemy(WEEK, 0, 8_000_000), NOW);
  if (!set.ok) throw new Error(set.code);
});

const enemy = (week: string, version: number, value: number) =>
  ({ action: "enemy", entry, week, version, value }) as const;

describe("the garrison plan", () => {
  it("never carries over the enemy might of a deleted siege (D123)", async () => {
    const gone = { entry, scope: "all", week: WEEK, requestId: randomUUID() } as const;
    expect(await removeEntry(db, access, gone, NOW)).toBe("deleted");
    const siege = {
      kind: "undead",
      level: 6,
      day: "2026-11-28",
      minute: 720,
      notes: null,
    } as const;
    const made = await createEntry(
      db,
      access,
      { ...siege, link: null, forMembers: false, notice: null, weekly: true },
      randomUUID(),
    );
    if (!made.ok) throw new Error(made.code);
    const next = await garrisonView(db, access, made.id, "2026-11-23");
    expect(next?.view).toMatchObject({ enemyMight: null, carriedFrom: null });
  });

  it("keeps each siege's own enemy might and history, and starts the next siege from the last", async () => {
    const NEXT = "2026-11-23";
    const next = await garrisonView(db, access, entry, NEXT);
    expect(next?.view).toMatchObject({ enemyMight: 8_000_000, carriedFrom: WEEK, version: 0 });
    expect(await saveEnemyMight(db, access, enemy(NEXT, 0, 9_500_000), NOW)).toEqual({
      ok: true,
      version: 1,
    });
    expect(await saveEnemyMight(db, access, enemy(WEEK, 1, 11_500_000), NOW)).toEqual({
      ok: true,
      version: 2,
    });
    // An officer who saw version 1 is refused, with the newer value.
    expect(await saveEnemyMight(db, access, enemy(WEEK, 1, 7_000_000), NOW)).toEqual({
      ok: false,
      code: "stale",
      value: 11_500_000,
    });
    const [week, later] = await Promise.all([
      garrisonView(db, access, entry, WEEK),
      garrisonView(db, access, entry, NEXT),
    ]);
    expect(week?.view).toMatchObject({ enemyMight: 11_500_000, carriedFrom: null });
    expect(later?.view).toMatchObject({ enemyMight: 9_500_000, carriedFrom: null });
    expect(week?.row?.enemyHistory.map((s) => s.value)).toEqual([8_000_000, 11_500_000]);
  });

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

  it("follows a new enemy might: an unedited plan is the new suggestion, an edited one says what it was made for", async () => {
    const at8 = await garrisonView(db, access, entry, WEEK);
    expect(at8?.view.pairs).toHaveLength(2);
    expect(await saveEnemyMight(db, access, enemy(WEEK, 1, 7_000_000), NOW)).toMatchObject({
      ok: true,
    });
    // Unedited: Wynnie (8.2M) no longer needs help at 7M, so the 7M suggestion is the plan.
    const at7 = await garrisonView(db, access, entry, WEEK);
    expect(at7?.view.pairs).toEqual([{ helper: 101, squad: 2, member: 102 }]);
    expect(at7?.view.madeFor).toBeNull();
    // Edited at 7M, then the enemy might goes back to 8M: the plan says so, and keeps its pairs.
    const pairs = [{ helper: 101, squad: 3, member: 102 }];
    await saveGarrison(db, access, { action: "save", entry, week: WEEK, rev: 0, pairs }, NOW);
    await saveEnemyMight(db, access, enemy(WEEK, 2, 8_000_000), NOW);
    const back = await garrisonView(db, access, entry, WEEK);
    expect(back?.view).toMatchObject({ madeFor: 7_000_000, pairs });
    // Edited at 8M, then 7M: Wynnie's pair goes, as she no longer needs help.
    const both = [...pairs, { helper: 101, squad: 2, member: 103 }];
    await saveGarrison(db, access, { action: "save", entry, week: WEEK, rev: 1, pairs: both }, NOW);
    await saveEnemyMight(db, access, enemy(WEEK, 3, 7_000_000), NOW);
    const dropped = await garrisonView(db, access, entry, WEEK);
    expect(dropped?.view).toMatchObject({ madeFor: 8_000_000, pairs });
  });

  it("posts names and squad might to the chosen channel once per request id, and nothing it was ordered by", async () => {
    const sent: { url: string; body: string }[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: String(init.body) });
      return Response.json({ id: "1" });
    }) as typeof globalThis.fetch;
    const hook = (name: string) => ({ url: `https://discord.test/${name}`, name, forum: false });
    const post = (week: string, requestId: string) =>
      postGarrison(
        db,
        access,
        { action: "post", entry, week, channel: "leaders", requestId },
        {
          fetch,
          now: NOW,
          channels: { members: hook("members"), leaders: hook("leaders") },
          t: WORKSPACE_DICTIONARIES.en,
          language: "en",
        },
      );
    const id = randomUUID();
    expect((await post(WEEK, id)).ok).toBe(true);
    expect((await post(WEEK, id)).ok).toBe(true);
    expect(sent.map((s) => s.url.split("?")[0])).toEqual(["https://discord.test/leaders"]);
    const content = (JSON.parse(sent[0]?.body ?? "{}") as { content: string }).content;
    expect(content).toContain("Enemy might 8.00M");
    expect(content).toContain("Bramble → Quillon: squad 2, 12.0M");
    expect(content).toContain("Bramble → Wynnie: squad 3, 11.0M");
    expect(content).not.toMatch(/4242|activ|grow|took part|90\.0M|30\.0M/i);
    // Next week's enemy might is only carried over: nothing is posted until it is saved.
    expect(await post("2026-11-23", randomUUID())).toEqual({ ok: false, code: "not_saved" });
    expect(sent).toHaveLength(1);
  });

  it("opens the post with the alliance's own line above the title, pinging no one (D155)", async () => {
    const callout = "Help each other @here <@42> discord.gg/abc";
    expect((await saveCalloutFor(db, access, { post: "garrison", callout }, NOW)).ok).toBe(true);
    const bodies: { content: string; allowed_mentions: unknown }[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return Response.json({ id: "1" });
    }) as typeof globalThis.fetch;
    const leaders = { url: "https://discord.test/leaders", name: "leaders", forum: false };
    const posted = await postGarrison(
      db,
      access,
      { action: "post", entry, week: WEEK, channel: "leaders", requestId: randomUUID() },
      {
        fetch,
        now: NOW,
        channels: { members: null, leaders },
        t: WORKSPACE_DICTIONARIES.en,
        language: "en",
      },
    );
    expect(posted.ok).toBe(true);
    expect(bodies[0]?.allowed_mentions).toEqual({ parse: [] });
    const [line, title] = String(bodies[0]?.content).split("\n");
    expect(line?.replace(/[\u200b\\]/g, "")).toBe(callout);
    expect(line).not.toMatch(/@here|<@4|discord\.gg/);
    expect(title).toBe("**Garrison plan · Undead Siege · Lv.6 · Sat, Nov 21**");
  });
});
