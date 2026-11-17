import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { formerMembers } from "./former-members";
import { saveFacts, type FactChange } from "./member-facts";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
const NOW = new Date("2026-11-17T12:00:00Z");

let db: Db;
let ana: WorkspaceAccess;

/** One end-of-day read: invented members, with the private keys in raw_json as the upstream sends them. */
async function read(day: string, members: [number, string, number][]) {
  await db.insert(dailyReads).values({ day, startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: members.length,
    sourceUpdatedAt: new Date(`${day}T01:30:00Z`),
    isFresh: true,
    memberUids: members.map(([uid]) => uid),
    memberNames: members.map(([, name]) => name),
    memberPower: members.map(([, , power]) => power),
    memberKills: members.map(() => 5000),
    rawJson: {
      members: members.map(([uid, nick_name]) => ({
        uid,
        nick_name,
        x: 412,
        y: 977,
        online: true,
        last_online_at: 1763337600,
        joined_at: 1760000000,
        daily_tech: 321,
        daily_honor: 45,
        active: 6789,
        avatar_url: "https://example.test/avatar.png",
      })),
    },
  });
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "ana", "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null);
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  ana = access;
});

describe("former members (D107)", () => {
  it("lists who left, newest leavers first, with facts still writable and no private field", async () => {
    await read("2026-11-14", [
      [21, "Wren", 40_000_000],
      [22, "Ilsa", 30_000_000],
      [23, "Tobiah", 20_000_000],
    ]);
    await read("2026-11-15", [
      [21, "Wren", 41_000_000],
      [22, "Ilsa", 31_000_000],
    ]);
    await read("2026-11-16", [[21, "Wren", 42_000_000]]);
    // Facts stay writable for someone who left; a uid no roster ever listed gets none.
    const why: FactChange = {
      field: "notes",
      version: 0,
      value: "moved server",
      source: "officer",
    };
    expect(await saveFacts(db, ana, 22, [why], NOW)).toMatchObject([{ status: "saved" }]);
    expect(await saveFacts(db, ana, 99, [why], NOW)).toBeNull();

    const former = await formerMembers(db, ana, ZONE);

    expect(former.map((m) => [m.uid, m.name, m.lastSeen, m.might])).toEqual([
      [22, "Ilsa", "2026-11-14", 31_000_000],
      [23, "Tobiah", "2026-11-13", 20_000_000],
    ]);
    expect(former[0]?.facts.notes?.value).toBe("moved server");
    // Only the name, public might and kills, the last day seen and the facts (CLAUDE.md, D71).
    for (const m of former) {
      expect(Object.keys(m).sort()).toEqual(["facts", "kills", "lastSeen", "might", "name", "uid"]);
    }
    const sent = JSON.stringify(former);
    for (const leak of [
      "412",
      "977",
      "online",
      "avatar",
      "321",
      "6789",
      "1763337600",
      "1760000000",
    ])
      expect(sent).not.toContain(leak);
  });
});
