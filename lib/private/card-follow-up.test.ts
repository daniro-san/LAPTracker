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
import { followUpView, recordFollowUp, undoFollowUp } from "./follow-up";
import { memberCard } from "./member-card";
import { saveFacts } from "./member-facts";
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

/**
 * An end-of-day read: 101 lists no daily quests (the offline proxy, D127); 102 earns 30 a day, so `active`,
 * the week's running total since Monday's reset (#739), is `total` (30 times the days since Monday).
 */
async function endOfDay(day: string, total: number) {
  const at = new Date(`${day}T23:37:00-02:00`);
  const members = [
    { uid: 101, nick_name: "Wren Example", active: null },
    { uid: 102, nick_name: "Moss Example", active: total },
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
  // Tuesday to Thursday: 102's total holds Monday's 30 too.
  for (const [day, total] of [
    ["2026-11-17", 60],
    ["2026-11-18", 90],
    ["2026-11-19", 120],
  ] as const)
    await endOfDay(day, total);
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
    const mondays = { week: "This week: Talked Mon, Nov 16 · ⁨Ana⁩", note: "Back after exams" };
    expect(await blockOf(ana, 101)).toMatchObject({ ...mondays, onList: false });
    // The newest counts: Thursday's Talked; its Undo gives Monday's back.
    const thursday = { now: new Date("2026-11-19T20:00:00Z"), zone: ZONE }; // Thu 19 Nov 18:00 ST
    const later = talked(101, "Said hello again");
    await recordFollowUp(db, ana, later, thursday);
    expect(await blockOf(ana, 101)).toMatchObject({
      week: "This week: Talked Thu, Nov 19 · ⁨Ana⁩",
      note: "Said hello again",
    });
    const undo = { uid: 101, target: later.requestId, requestId: randomUUID() };
    await undoFollowUp(db, ana, undo, thursday);
    expect(await blockOf(ana, 101)).toMatchObject(mondays);
  });

  it("gives a member off the week's list with nothing noted no week line, and a plain hello (D75)", async () => {
    const ana = await signedIn("Ana");
    const block = await blockOf(ana, 102);
    expect(block).toMatchObject({ week: null, note: null, onList: false });
    // No language known: the officer's; no reason, tip or fact to ask: the hello and the warm end only.
    const plain = { name: "Moss Example", isNew: false, reasons: [], tip: false, toAsk: [] };
    expect(block?.message).toEqual({ language: "en", texts: readyTexts(plain) });
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

  it("writes the message in the language officers recorded, over the game's (D140)", async () => {
    await db
      .insert(playerReads)
      .values({ unionId: OGS, uid: 101, readAt: new Date("2026-11-19T23:40:00Z"), language: "en" });
    const ana = await signedIn("Ana");
    const languages = { field: "languages", version: 0, value: ["fr"], source: "officer" } as const;
    await saveFacts(db, ana, 101, [{ ...languages, value: [...languages.value] }], NOW, ZONE);
    expect((await blockOf(ana, 101))?.message.language).toBe("fr");
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

describe("the member card's game language (issue 814)", () => {
  const languageOf = async (access: WorkspaceAccess, uid: number) =>
    (
      await memberCard(db, access, uid, {
        now: NOW,
        zone: ZONE,
        language: "en",
        t: WORKSPACE_DICTIONARIES.en,
      })
    )?.gameLanguage;
  const read = (unionId: number, iso: string, language: string) => ({
    unionId,
    uid: 101,
    readAt: new Date(iso),
    language,
  });

  it("shows the newest read's language and the day it was read", async () => {
    await db
      .insert(playerReads)
      .values([read(OGS, "2026-11-10T12:00:00Z", "fr"), read(OGS, "2026-11-19T12:00:00Z", "pt")]);
    expect(await languageOf(await signedIn("Ana"), 101)).toEqual({
      line: "Game language: {name} (read {date})",
      language: "pt-BR",
      other: "Other",
      date: "Thu, Nov 19",
    });
  });

  it("has no line without a read (D75), and a code the notices are not written in is Other", async () => {
    const ana = await signedIn("Ana");
    expect(await languageOf(ana, 101)).toBeNull();
    await db.insert(playerReads).values(read(OGS, "2026-11-19T12:00:00Z", "es"));
    expect(await languageOf(ana, 101)).toMatchObject({ language: null, other: "Other" });
  });

  it("never uses another alliance's read", async () => {
    await db.insert(playerReads).values(read(99999999, "2026-11-19T12:00:00Z", "fr"));
    expect(await languageOf(await signedIn("Ana"), 101)).toBeNull();
  });
});
