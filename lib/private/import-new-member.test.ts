import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { classifyScreen } from "../screenshot/classify";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createDrafts, saveDraft } from "./import";
import { factsOf, saveFacts, type FactChange } from "./member-facts";
import { addPending, pendingMembers, removePending } from "./pending-members";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");

let db: Db;
let ana: WorkspaceAccess;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // An invented roster; the new member is not in it yet.
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-15",
    unionId: OGS,
    memberCount: 2,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: [1, 2],
    memberNames: ["Ana", "Corvin"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "1", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  ana = access;
});

/** A chat page: the new member's message, then two welcomes (a chat needs three senders). */
const chat = (said: string) => [
  "Kingdom Alliance | Private Chat",
  "WA XX. 12 ¢ [0Gs] Zephyrine",
  said,
  "WA XX. 27 ¢ [0Gs] Ana",
  "Welcome!",
  "WA XX. 28 ¢ [0Gs] Corvin",
  "Glad you are here",
];

async function save(said: string, newName: string, version: number) {
  const lines = chat(said);
  const sent = { source: "desk" as const, sentBy: "Ana", pictureDay: "2026-11-16", now: NOW };
  const { drafts } = await createDrafts(
    db,
    ana,
    [{ lines, classified: classifyScreen(lines) }],
    sent,
  );
  expect(drafts[0]).toMatchObject({ kind: "member_update", rows: 1, notFound: 1 });
  const rows = [{ newName, value: 9_800_000, field: "squadMight" as const, version }];
  const input = { version: 1, scope: null, day: null, weekBefore: false, rows };
  return saveDraft(db, ana, drafts[0]?.id ?? 0, input, { now: NOW, zone: "Etc/GMT+2" });
}

describe("a row not found saved to a new member (D106)", () => {
  it("makes the pending member on Save, and the next save under the same name key reuses it", async () => {
    expect(await save("Main squad 9.8 M", " Zephyrine ", 0)).toEqual({ ok: true });
    // The officer typed the name differently the second time; its key is the same.
    expect(await save("Main squad 9.8M", "ZEPHYRINE", 0)).toEqual({ ok: true });

    const pending = await pendingMembers(db, ana);
    expect(pending.map((p) => p.name)).toEqual(["Zephyrine"]);
    expect((await factsOf(db, ana)).get(pending[0]?.uid ?? 0)?.squadMight).toMatchObject({
      value: 9_800_000,
      version: 1,
      source: "message",
    });
  });

  it("saves to a reopened member at its current version: a new value appends, never a conflict", async () => {
    const made = await addPending(
      db,
      ana,
      { requestId: randomUUID(), name: "Zephyrine", changes: [] },
      { now: NOW, zone: "Etc/GMT+2" },
    );
    const uid = made?.uid ?? 0;
    const first: FactChange = {
      field: "squadMight",
      version: 0,
      value: 9_000_000,
      source: "officer",
    };
    await saveFacts(db, ana, uid, [first], NOW);
    expect(await removePending(db, ana, -uid, NOW)).toBe(true);

    // The import sends version 0: the officer saw no facts for a member not found.
    expect(await save("Main squad 9.8 M", "Zephyrine", 0)).toEqual({ ok: true });
    expect(await save("Main squad 9.8 M", "Zephyrine", 0)).toEqual({ ok: true });
    expect((await factsOf(db, ana)).get(uid)?.squadMight).toMatchObject({
      value: 9_800_000,
      version: 2,
    });
    expect((await pendingMembers(db, ana)).map((p) => p.uid)).toEqual([uid]);
  });
});
