// A KvK plan (issue 790, D161) against a real Postgres (PGlite): an officer's saved plan comes back, a save
// over an old version is refused, the picker offers the members not away that day, and "Make the message"
// makes a notice draft that names people by public name only. Names are invented.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { notices } from "../schema-notices";
import { requireWorkspace } from "./access";
import { createEntry } from "./calendar";
import { calendarDates } from "./calendar-words";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { kvkPlanView, makeKvkMessage, saveKvkPlan } from "./kvk-plan";
import { saveFacts } from "./member-facts";
import { noticeDetail } from "./notices";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-24T12:00:00Z");
const WEEK = "2026-11-23";
const KVK_DAY = "2026-11-28";
const ZONE = "Etc/GMT+2";
const UIDS = [101, 102, 103];
const NAMES = ["Wren Hollow", "Bramble Fox", "Quillon Ash"];
/** The private fields the upstream sends, with marker values that must never reach a message (D71). */
const PRIVATE = { x: 98765, y: 54321, last_online_at: 1763337600 };
const words = { t: WORKSPACE_DICTIONARIES.en, language: "en" as const };

let db: Db;
let entry = 0;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await db.insert(dailyReads).values({ day: "2026-11-23", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-23",
    unionId: OGS,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: UIDS,
    memberNames: NAMES,
    memberPower: UIDS.map(() => 1000),
    memberKills: UIDS.map(() => 0),
    rawJson: {
      members: UIDS.map((uid, i) => ({ uid, nick_name: NAMES[i], online: true, ...PRIVATE })),
    },
  });
  const made = await createEntry(
    db,
    await officer(),
    {
      kind: "kvk",
      day: KVK_DAY,
      minute: 720,
      weekly: false,
      notes: null,
      link: null,
      forMembers: false,
      notice: null,
    },
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  entry = made.id;
});

async function officer() {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ogs-ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

const save = async (rev: number, roles: { name: string; uids: number[] }[], note = "") =>
  saveKvkPlan(db, await officer(), { action: "save", entry, rev, roles, note }, NOW);

const message = async () => {
  const ana = await officer();
  const input = { action: "message", entry, week: WEEK, requestId: randomUUID() } as const;
  const made = await makeKvkMessage(db, ana, input, NOW, words);
  if (!made.ok) throw new Error(made.code);
  return noticeDetail(db, ana, made.id);
};

describe("a KvK plan (issue 790)", () => {
  it("comes back as the officer saved it, and a save over an old version is refused", async () => {
    const ana = await officer();
    expect((await kvkPlanView(db, ana, entry, WEEK, ZONE))?.roles).toBeNull();
    const roles = [{ name: "Rally lead", uids: [102, 103] }];
    expect(await save(0, roles, "Meet at the castle")).toEqual({ ok: true, rev: 1 });
    const view = await kvkPlanView(db, ana, entry, WEEK, ZONE);
    expect([view?.roles, view?.note, view?.rev]).toEqual([roles, "Meet at the castle", 1]);
    expect(await save(0, [])).toEqual({ ok: false, code: "stale" });
    expect(await save(1, [{ name: "Scout", uids: [999] }])).toEqual({ ok: false, code: "invalid" });
  });

  it("offers the members the roll call asks: someone away on the KvK day is left out", async () => {
    const ana = await officer();
    const away = { text: "family trip", from: "2026-11-27", until: "2026-11-29" };
    await saveFacts(
      db,
      ana,
      101,
      [{ field: "away", version: 0, value: away, source: "officer" }],
      NOW,
    );
    const view = await kvkPlanView(db, ana, entry, WEEK, ZONE);
    expect(view?.members.filter((m) => !m.away).map((m) => m.name)).toEqual([
      "Bramble Fox",
      "Quillon Ash",
    ]);
    expect(await save(0, [{ name: "Garrison", uids: [102] }])).toEqual({ ok: true, rev: 1 });
  });

  it("makes a message with the server time and each role's people by name, leaving out empty roles", async () => {
    await save(
      0,
      [
        { name: "Rally lead", uids: [103, 102] },
        { name: "Scout", uids: [] },
        { name: "Garrison", uids: [101] },
      ],
      "Shield up by 11:30 ST",
    );
    const notice = await message();
    expect(notice?.fields.title.value).toBe(`KvK plan · ${calendarDates("en").short(KVK_DAY)}`);
    expect(notice?.fields.en.value.split("\n")).toEqual([
      `KvK · ${calendarDates("en").short(KVK_DAY)} · 12:00 ST`,
      "Rally lead: Bramble Fox, Quillon Ash",
      "Garrison: Wren Hollow",
      "",
      "Shield up by 11:30 ST",
    ]);
  });

  it("makes a message with no roles filled: the heading and the note", async () => {
    await save(0, [{ name: "Rally lead", uids: [] }], "Everyone online at 12:00 ST");
    const notice = await message();
    expect(notice?.fields.en.value).toBe(
      `KvK · ${calendarDates("en").short(KVK_DAY)} · 12:00 ST\n\nEveryone online at 12:00 ST`,
    );
  });

  it("puts no private field, away note or uid in the notice the translation is asked for (D71)", async () => {
    const ana = await officer();
    const away = { text: "hospital visit", from: "2026-11-27", until: "2026-11-29" };
    await saveFacts(
      db,
      ana,
      101,
      [{ field: "away", version: 0, value: away, source: "officer" }],
      NOW,
    );
    await save(0, [{ name: "Rally lead", uids: [101, 102, 103] }]);
    // The notice editor's Translate sends the notice's own text, and nothing else (D81).
    const sent = JSON.stringify((await message())?.fields);
    for (const leak of [...Object.values(PRIVATE).map(String), "hospital", "101", "102", "103"]) {
      expect(sent).not.toContain(leak);
    }
    expect(sent).toContain("Wren Hollow");
  });

  it("makes one notice for a repeat of the same request (D100)", async () => {
    const ana = await officer();
    await save(0, [{ name: "Scout", uids: [102] }]);
    const input = { action: "message", entry, week: WEEK, requestId: randomUUID() } as const;
    const first = await makeKvkMessage(db, ana, input, NOW, words);
    const again = await makeKvkMessage(db, ana, input, NOW, words);
    expect(again).toEqual(first);
    expect(await db.select({ id: notices.id }).from(notices)).toHaveLength(1);
  });

  it("drops someone who left the alliance from the plan shown and from the message", async () => {
    await save(0, [{ name: "Rally lead", uids: [101, 102] }]);
    // The next day's roster no longer lists 102 (Bramble Fox).
    await db.insert(dailyReads).values({ day: "2026-11-24", startedAt: NOW, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: "2026-11-24",
      unionId: OGS,
      memberCount: 2,
      isFresh: true,
      sourceUpdatedAt: new Date("2026-11-24T23:30:00Z"),
      memberUids: [101, 103],
      memberNames: ["Wren Hollow", "Quillon Ash"],
      memberPower: [1000, 1000],
      memberKills: [0, 0],
    });
    const view = await kvkPlanView(db, await officer(), entry, WEEK, ZONE);
    expect(view?.roles).toEqual([{ name: "Rally lead", uids: [101] }]);
    expect((await message())?.fields.en.value.split("\n")[1]).toBe("Rally lead: Wren Hollow");
  });
});
