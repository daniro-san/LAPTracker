// "Paste updates" on Members (issue 347, D109): one member per line becomes a member update draft, matched
// like a chat screenshot, and its save appends new versions for members who already have values; typed
// lines and a picture's chat can share one paste, and a picture alone reads as before. Invented names.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { screenshotDrafts } from "../schema-import";
import { classifyScreen } from "../screenshot/classify";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createDrafts, saveDraft } from "./import";
import { memberUpdate } from "./import-photo-hooks";
import { factsOf, saveFacts } from "./member-facts";
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

describe("Paste updates (D109)", () => {
  it("reads one member per line in any order and saves new versions for registered members", async () => {
    await saveFacts(
      db,
      ana,
      1,
      [
        { field: "squadMight", version: 0, value: 12_300_000, source: "officer" },
        { field: "adTech", version: 0, value: 60, source: "officer" },
      ],
      NOW,
    );
    const lines = ["Corvin: AD 80", "Ana 12.9M 74%", "Zzyzx 5M", "thanks all"];
    const sent = { source: "pasted" as const, sentBy: "Ana", pictureDay: "2026-11-16", now: NOW };
    const { drafts } = await createDrafts(
      db,
      ana,
      [{ lines, classified: classifyScreen(lines) }],
      sent,
      { kind: "member_update", scope: null },
    );
    expect(drafts[0]).toMatchObject({ kind: "member_update", rows: 4, notFound: 1 });
    const [draft] = await db.select().from(screenshotDrafts);
    expect(draft?.rows.map((r) => [r.name, r.field, r.value, r.match.status])).toEqual([
      ["Corvin", "adTech", 80, "sure"],
      ["Ana", "squadMight", 12_900_000, "sure"],
      ["Ana", "adTech", 74, "sure"],
      ["Zzyzx", "squadMight", 5_000_000, "none"],
    ]);
    const rows = [
      { uid: 2, value: 80, field: "adTech" as const, version: 0 },
      { uid: 1, value: 12_900_000, field: "squadMight" as const, version: 1 },
      { uid: 1, value: 74, field: "adTech" as const, version: 1 },
    ];
    const input = { version: 1, scope: null, day: null, weekBefore: false, rows };
    const clock = { now: NOW, zone: "Etc/GMT+2" };
    expect(await saveDraft(db, ana, drafts[0]?.id ?? 0, input, clock)).toEqual({ ok: true });
    const facts = await factsOf(db, ana);
    expect(facts.get(1)?.squadMight).toMatchObject({ value: 12_900_000, version: 2 });
    expect(facts.get(1)?.adTech).toMatchObject({ value: 74, version: 2, source: "message" });
    expect(facts.get(2)?.adTech).toMatchObject({ value: 80, version: 1 });
  });

  it("reads typed lines then a picture's chat in one paste, each its own way", () => {
    const text = [
      "Corvin 9.1M",
      "Lv.27 [OGs] Ana",
      "Main squad 12.3 M",
      "Lv.30 [OGs] Corvin",
      "Welcome!",
    ];
    const { rows } = memberUpdate.read([text], null, "OGs", true);
    expect(rows.map((r) => [r.name, r.field, r.value])).toEqual([
      ["Corvin", "squadMight", 9_100_000],
      ["Ana", "squadMight", 12_300_000],
    ]);
  });

  it("keeps a picture with no chat sender line read as nothing, as before Paste updates", () => {
    const page = ["Main squad 12.3 M", "AD Tech 55%", "Ana 10M"];
    expect(memberUpdate.read([page], null, "OGs", false).rows).toEqual([]);
  });
});
