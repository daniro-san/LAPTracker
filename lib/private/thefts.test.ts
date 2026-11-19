import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { listThefts } from "../repo/thefts";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { parseSecretOpsReport } from "../screenshot/parse-secret-ops";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createSession } from "./session";
import { addTheft, findAttackers, removeTheft, setFollowUp, theftsView } from "./thefts";
import { reportInstant, saveSecretOpsDraft } from "./thefts-import";

const OGS = 67111155;
const NSE = 67109944;
const URSA = 67110320;
/** A tracked alliance (TmS's id) whose newest roster reads RPD, the tag the committed report (image 54) names. */
const RPD = 67110584;
const NOW = new Date("2026-11-16T12:00:00Z");
const CLOCK = { now: NOW, zone: "Etc/GMT+2" };

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: NSE, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] });
  await roster(OGS, "OGs", "2026-11-15", { 11: "Seesky", 12: "DoctorHouse1387", 13: "Grimbald" });
  await roster(NSE, "NSE", "2026-11-14", { 21: "Grimm", 22: "Gremlin" });
  await roster(NSE, "NSE", "2026-11-15", { 21: "Grimmer", 22: "Gremlin" });
  await roster(URSA, "URSA", "2026-11-15", { 31: "Agrim" });
  await roster(RPD, "RPD", "2026-11-15", { 41: "Golgsunny" });
});

/** One alliance's daily roster: uid → name (D60). */
async function roster(unionId: number, tag: string, day: string, names: Record<number, string>) {
  const uids = Object.keys(names).map(Number);
  await db
    .insert(dailyReads)
    .values({ day, startedAt: NOW, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag,
    memberCount: uids.length,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => names[u] ?? ""),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
  });
}

async function signedIn(slug: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `officer-${slug}`, "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

const typed = (attacker: { uid: number } | { name: string; tag: string }, victimUid: number) => ({
  attacker,
  victimUid,
  day: "2026-11-15",
  time: "13:46",
  kind: "caravan" as const,
  note: "",
  requestId: randomUUID(),
});

describe("the attacker search (issue 321)", () => {
  it("finds players of the other tracked alliances by their newest names, exact first", async () => {
    const ogs = await signedIn("ogs");
    const names = async (q: string) => (await findAttackers(db, ogs, q)).map((p) => p.name);
    // NSE's newest roster says Grimmer (Grimm was the day before); OGs' own Grimbald is left out.
    expect(await names("grim")).toEqual(["Grimmer", "Agrim"]);
    expect(await names("agrim")).toEqual(["Agrim"]);
    expect(await findAttackers(db, ogs, "[NSE] GREMLIN")).toEqual([
      { uid: 22, name: "Gremlin", tag: "NSE" },
    ]);
    expect(await names("🙂")).toEqual([]);
    // From NSE's workspace, OGs' players are attackers and NSE's own are not.
    expect(await findAttackers(db, await signedIn("nse"), "grim")).toEqual([
      { uid: 13, name: "Grimbald", tag: "OGs" },
      { uid: 31, name: "Agrim", tag: "URSA" },
    ]);
  });
});

describe("the Secret Ops report save hook (issues 299, 321)", () => {
  // Image 54's recorded text, then two entries cut off at the picture's edge: no sentence, kind null.
  const lines = readFileSync(
    `${import.meta.dirname}/../../fixtures/screenshots/54-secret-ops-report.txt`,
    "utf8",
  ).split("\n");
  const entries = parseSecretOpsReport([
    ...lines,
    "[RPD]Golgsunny 11-14 09:00",
    "[OGs]Grimbald 11-14 08:00",
  ]);
  const draft = { victimUid: 11, readAt: NOW, entries };

  it("saves the thefts as Ops, unread sentences too, and leaves out help and our own members", async () => {
    const ogs = await signedIn("ogs");
    expect(entries.filter((e) => e.kind === null)).toHaveLength(4);
    expect(await saveSecretOpsDraft(db, ogs, draft, CLOCK)).toEqual({
      saved: 6,
      // 11k re-recorded image 54: a stray `[lel` and the second help line (sentence and time misread)
      // come back with kind null; the first is saved, the second is our own member.
      left: { help: 1, own: 2, duplicate: 0 },
    });
    const rows = await listThefts(db, ogs.workspaceId);
    expect(
      rows.map((r) => [r.attackerKey, r.attackerTag, r.at?.toISOString() ?? null, r.kind]),
    ).toEqual([
      ["name:stene", "1b8R", "2026-11-15T13:48:00.000Z", "ops"],
      // The stray `[lel`: kind null and no time, saved for the officer to remove.
      ["name:lel", "", null, "ops"],
      ["uid:41", "RPD", "2026-11-15T13:47:00.000Z", "ops"],
      ["uid:41", "RPD", "2026-11-15T13:47:00.000Z", "ops"],
      ["name:cinalice", "ANM", "2026-11-14T19:34:00.000Z", "ops"],
      // kind null: a theft whose sentence was not read; still from a Secret Ops report.
      ["uid:41", "RPD", "2026-11-14T11:00:00.000Z", "ops"],
    ]);
    expect(rows.every((r) => r.source === "photo" && r.victimName === "Seesky")).toBe(true);
  });

  it("adds nothing when the same report is saved again", async () => {
    const ogs = await signedIn("ogs");
    await saveSecretOpsDraft(db, ogs, draft, CLOCK);
    expect(await saveSecretOpsDraft(db, ogs, draft, CLOCK)).toMatchObject({
      saved: 0,
      left: { duplicate: 6 },
    });
    expect(await listThefts(db, ogs.workspaceId)).toHaveLength(6);
  });

  it("refuses a member who is not in the alliance", async () => {
    const ogs = await signedIn("ogs");
    expect(await saveSecretOpsDraft(db, ogs, { ...draft, victimUid: 21 }, CLOCK)).toBe(
      "not_in_alliance",
    );
    expect(await listThefts(db, ogs.workspaceId)).toEqual([]);
  });

  it("refuses an entry whose attacker name was not read", async () => {
    const ogs = await signedIn("ogs");
    // A name the OCR did not read ("") must be filled in or the entry dropped before saving.
    const noName = {
      kind: "theft" as const,
      tag: "VNC",
      name: "",
      at: "11-14 08:00",
      raw: "[VNC]",
    };
    const unnamed = { ...draft, entries: [...entries, noName] };
    expect(await saveSecretOpsDraft(db, ogs, unnamed, CLOCK)).toBe("attacker_missing");
    expect(await listThefts(db, ogs.workspaceId)).toEqual([]);
  });

  it("dates December's entries of a report read in early January in the year before", () => {
    expect(reportInstant("12-31 23:50", new Date("2027-01-02T12:00:00Z"), "Etc/GMT+2")).toEqual(
      new Date("2027-01-01T01:50:00Z"),
    );
  });
});

describe("a typed theft sent twice (D100)", () => {
  it("is stored once when the retry carries the same request id", async () => {
    const ogs = await signedIn("ogs");
    const add = typed({ uid: 21 }, 11);
    expect(await addTheft(db, ogs, add, CLOCK)).toBe("ok");
    expect(await addTheft(db, ogs, add, CLOCK)).toBe("ok");
    expect(await listThefts(db, ogs.workspaceId)).toHaveLength(1);
    expect(await addTheft(db, ogs, typed({ uid: 21 }, 11), CLOCK)).toBe("ok");
    expect(await listThefts(db, ogs.workspaceId)).toHaveLength(2);
  });

  it("is stored once when two sends with one request id arrive at the same moment", async () => {
    const ogs = await signedIn("ogs");
    const add = typed({ uid: 21 }, 11);
    const both = await Promise.all([addTheft(db, ogs, add, CLOCK), addTheft(db, ogs, add, CLOCK)]);
    expect(both).toEqual(["ok", "ok"]);
    expect(await listThefts(db, ogs.workspaceId)).toHaveLength(1);
  });
});

describe("thefts between two workspaces (D71)", () => {
  it("are seen, removed and followed up only in their own workspace", async () => {
    const [ogs, nse] = [await signedIn("ogs"), await signedIn("nse")];
    expect(await addTheft(db, ogs, typed({ uid: 21 }, 11), CLOCK)).toBe("ok");
    // A member of another alliance is not one of ours; our own players are not attackers.
    expect(await addTheft(db, ogs, typed({ uid: 21 }, 22), CLOCK)).toBe("not_in_alliance");
    expect(await addTheft(db, ogs, typed({ uid: 13 }, 11), CLOCK)).toBe("unknown_player");
    const later = { ...typed({ name: "Stene", tag: "1b8R" }, 11), day: "2026-11-17" };
    expect(await addTheft(db, ogs, later, CLOCK)).toBe("bad_time");
    const [row] = await listThefts(db, ogs.workspaceId);
    expect(row?.attackerKey).toBe("uid:21");
    expect((await theftsView(db, nse, CLOCK)).groups).toEqual([]);
    expect(await removeTheft(db, nse, { id: row?.id ?? 0, requestId: randomUUID() }, NOW)).toBe(
      "not_found",
    );
    const follow = { attacker: "uid:21", state: "talked" as const, note: "" };
    expect(await setFollowUp(db, nse, follow, NOW)).toBe("not_found");
    expect(await setFollowUp(db, ogs, follow, NOW)).toBe("ok");
    const [group] = (await theftsView(db, ogs, CLOCK)).groups;
    expect(group?.attackers[0]).toMatchObject({
      name: "Grimmer",
      tag: "NSE",
      total: 1,
      followUp: { state: "talked", last: { by: "Ana" } },
    });
    expect(await removeTheft(db, ogs, { id: row?.id ?? 0, requestId: randomUUID() }, NOW)).toBe(
      "ok",
    );
    expect(await listThefts(db, ogs.workspaceId)).toEqual([]);
  });
});

describe("the thefts_kind migration (D97, amended 2026-11-17)", () => {
  it("turns quest rewards into Ops and keeps an unknown as null", async () => {
    const dir = `${import.meta.dirname}/../../drizzle`;
    const journal = JSON.parse(readFileSync(`${dir}/meta/_journal.json`, "utf8")) as {
      entries: { tag: string }[];
    };
    const at = journal.entries.findIndex((e) => e.tag.endsWith("_thefts_kind"));
    const pg = new PGlite();
    const apply = async (tag: string) => {
      for (const statement of readFileSync(`${dir}/${tag}.sql`, "utf8").split(
        "--> statement-breakpoint",
      ))
        await pg.exec(statement);
    };
    for (const e of journal.entries.slice(0, at)) await apply(e.tag);
    await pg.exec(`
      insert into workspaces (slug, union_id, discord_guild_id, leader_role_ids) values ('ogs', 1, '1', '{}');
      insert into thefts (workspace_id, attacker_key, attacker_name, attacker_tag, stolen, source, created_at)
      values (1, 'name:a', 'A', '', 'quest_rewards', 'photo', now()), (1, 'name:b', 'B', '', null, 'typed', now());
    `);
    await apply(journal.entries[at]?.tag ?? "");
    const { rows } = await pg.query("select attacker_key, kind from thefts order by id");
    expect(rows).toEqual([
      { attacker_key: "name:a", kind: "ops" },
      { attacker_key: "name:b", kind: null },
    ]);
    await pg.close();
  }, 60_000); // Replays the migrations up to thefts_kind on PGlite; slow when the machine is busy.
});
