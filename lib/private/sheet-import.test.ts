// Invented names and rows (issue #297); never the real sheets.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { factsOf, saveFacts } from "./member-facts";
import { createSession } from "./session";
import { applyImport, previewImport } from "./sheet-import";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const WHERE = { now: NOW, serverZone: "Etc/GMT+2" };

let db: Db;
let access: WorkspaceAccess;

/** One OGs daily roster: uid → the name it had that day. */
async function roster(day: string, names: Record<number, string>) {
  const uids = Object.keys(names).map(Number);
  await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: uids.length,
    sourceUpdatedAt: new Date(`${day}T10:00:00Z`),
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => names[u] as string),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
  });
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // Marigold was called Goldie a week ago.
  await roster("2026-11-08", {
    11: "Goldie",
    12: "Thistle",
    13: "Rowen",
    14: "Rowin",
    15: "Bramble",
  });
  await roster("2026-11-15", {
    11: "Marigold",
    12: "Thistle",
    13: "Rowen",
    14: "Rowin",
    15: "Bramble",
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const got = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!got.ok) throw new Error("no access");
  access = got;
});

const CSV = [
  "#,Name,Troops,First Squad,AD%,Timezone",
  "1,R4 Thistle++,T9,10.7,0.83,US - CST",
  "2,⚜️💙 Marigold 💙⚜️,T8,9.9,1,",
  "3,Goldie,,,,",
  "4,Rowan,T7,8.4,0.5,ST +3",
  "5,Stranger,T9,12,0.9,",
  "6,Bramble,T10,,,",
].join("\n");

describe("the one-time sheet import (#297)", () => {
  it("matches rows by current and past names, and leaves doubtful and unknown rows to a person", async () => {
    const preview = await previewImport(db, access, CSV, WHERE);

    expect(preview?.rows.map((r) => [r.line, r.match])).toEqual([
      [1, { status: "matched", uid: 12, via: "current" }],
      [2, { status: "matched", uid: 11, via: "current" }],
      [3, { status: "matched", uid: 11, via: "past" }],
      [4, { status: "unsure", suggestions: [13, 14] }],
      [5, { status: "none" }],
      [6, { status: "matched", uid: 15, via: "current" }],
    ]);
  });

  it("writes only once every row is decided, into empty fields, and remembers the person's answers", async () => {
    // An officer already typed Bramble's troops: the sheet must not overwrite them.
    await saveFacts(
      db,
      access,
      15,
      [{ field: "troopTier", version: 0, value: 11, source: "officer" }],
      NOW,
    );

    expect(await applyImport(db, access, CSV, [{ line: 4, uid: 13 }], WHERE)).toBe("undecided");
    const decided = [
      { line: 4, uid: 13 },
      { line: 5, uid: null },
    ];
    const result = await applyImport(db, access, CSV, decided, WHERE);
    const facts = await factsOf(db, access);

    // Thistle 4 values, Marigold 3, Rowen 4; Bramble's troops kept.
    expect(result).toEqual({ matched: 5, dismissed: 1, members: 3, saved: 11, kept: 1 });
    expect(facts.get(12)).toMatchObject({
      squadMight: { value: 10_700_000, source: "sheet", version: 1 },
      adTech: { value: 83, source: "sheet" },
      troopTier: { value: 9, source: "sheet" },
      timeZone: { value: "America/Chicago", source: "sheet" },
    });
    expect(facts.get(13)?.timeZone?.value).toBe("Etc/GMT-1");
    expect(facts.get(15)?.troopTier).toMatchObject({ value: 11, source: "officer" });
    // The next sheet asks nothing about these names, and importing again writes nothing.
    const again = await previewImport(db, access, CSV, WHERE);
    expect(again?.rows.filter((r) => r.line >= 4).map((r) => r.match)).toEqual([
      { status: "matched", uid: 13, via: "alias" },
      { status: "dismissed" },
      { status: "matched", uid: 15, via: "current" },
    ]);
    expect(await applyImport(db, access, CSV, [], WHERE)).toMatchObject({ saved: 0 });
  });
});
