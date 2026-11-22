// The member card's Follow-up block (issue 516) against a real Postgres (PGlite): this week's note from
// Monday 00:00 ST, "no follow-up note yet" only for a member on the week's list (D75), Follow-up's own ready
// message in the member's language that stays after a Talked (D140), and nothing while the tab is off.
// Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { workspaceFeatures } from "../schema-features";
import { playerReads } from "../schema-squads";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { followUpView, recordFollowUp } from "./follow-up";
import { memberCard } from "./member-card";
import { inputOf, readyTexts, readyWords } from "./ready-message";
import { createSession } from "./session";

const OGS = 67111155;
const ZONE = "Etc/GMT+2";
/** Friday 20 Nov 10:00 ST: the game week is Mon 16 – Sun 22 Nov. */
const NOW = new Date("2026-11-20T12:00:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** An end-of-day read: 101 lists no daily quests (the offline proxy, D127), 102 lists 30. */
async function endOfDay(day: string) {
  const at = new Date(`${day}T23:37:00-02:00`);
  const members = [
    { uid: 101, nick_name: "Wren Example", active: null },
    { uid: 102, nick_name: "Moss Example", active: 30 },
  ];
  await db.insert(dailyReads).values({ day, startedAt: at, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OGS,
    memberCount: 2,
    sourceUpdatedAt: at,
    isFresh: true,
    memberUids: [101, 102],
    memberNames: ["Wren Example", "Moss Example"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
    rawJson: { members: members.map((m) => ({ ...m, power: 1000, lv: 25, rank_code: 103 })) },
  });
}

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  for (const day of ["2026-11-17", "2026-11-18", "2026-11-19"]) await endOfDay(day);
});

async function signedIn(name: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, `ogs-${name}`, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

const talked = (uid: number, note = "") => ({
  uid,
  action: "talked" as const,
  note,
  until: null,
  version: 0,
  requestId: randomUUID(),
});

const blockOf = async (access: WorkspaceAccess, uid: number) =>
  (
    await memberCard(db, access, uid, {
      now: NOW,
      zone: ZONE,
      language: "en",
      t: WORKSPACE_DICTIONARIES.en,
    })
  )?.followUp;

describe("the member card's Follow-up block (issue 516)", () => {
  it("says this week's newest note from Monday 00:00 ST, never one from Sunday 23:59 ST", async () => {
    const ana = await signedIn("Ana");
    const sunday = new Date("2026-11-16T01:59:00Z"); // Sun 15 Nov 23:59 ST
    await recordFollowUp(db, ana, talked(101, "Last week's chat"), { now: sunday, zone: ZONE });
    expect(await blockOf(ana, 101)).toMatchObject({
      week: "This week: no follow-up note yet.",
      note: null,
      onList: true,
    });
    const monday = new Date("2026-11-16T02:00:00Z"); // Mon 16 Nov 00:00 ST
    await recordFollowUp(db, ana, talked(101, "Back after exams"), { now: monday, zone: ZONE });
    expect(await blockOf(ana, 101)).toMatchObject({
      week: "This week: Talked Mon, Nov 16 · ⁨Ana⁩",
      note: "Back after exams",
      onList: false,
    });
  });

  it("gives a member off the week's list with nothing noted no week line (D75)", async () => {
    const ana = await signedIn("Ana");
    expect(await blockOf(ana, 102)).toMatchObject({ week: null, note: null, onList: false });
  });

  it("offers Follow-up's own message in the member's game language, the same after a Talked (D140)", async () => {
    await db
      .insert(playerReads)
      .values({ unionId: OGS, uid: 101, readAt: new Date("2026-11-19T23:40:00Z"), language: "pt" });
    const ana = await signedIn("Ana");
    const listed = (await followUpView(db, ana, NOW, ZONE)).items.find((i) => i.member.uid === 101);
    if (!listed) throw new Error("101 is not on the list");
    const before = (await blockOf(ana, 101))?.message;
    expect(before).toEqual({ language: listed.language, texts: readyTexts(inputOf(listed)) });
    expect(before?.language).toBe("pt-BR");
    expect(before?.texts["pt-BR"]).toContain(readyWords("pt-BR").idle);
    await recordFollowUp(db, ana, talked(101), { now: NOW, zone: ZONE });
    expect((await blockOf(ana, 101))?.message).toEqual(before);
  });

  it("shows none of it while the alliance turned the Follow-up tab off (D126)", async () => {
    const ws = await findWorkspaceBySlug(db, "ogs");
    await db.insert(workspaceFeatures).values({
      workspaceId: ws?.id ?? 0,
      switches: {},
      allianceSwitches: { follow_up: false },
    });
    expect(await blockOf(await signedIn("Ana"), 101)).toBeNull();
  });
});
