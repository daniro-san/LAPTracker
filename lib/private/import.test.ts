import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { allianceDuelPoints, screenshotDrafts } from "../schema-import";
import { classifyScreen } from "../screenshot/classify";
import { ogsCandidates, recorded } from "../screenshot/test-helpers";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createDrafts, saveDraft, type SaveInput } from "./import";
import { toReview } from "./import-view";
import { factsOf, saveFacts } from "./member-facts";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const DAY = 86_400_000;
const sent = (now = NOW) => ({
  source: "desk" as const,
  sentBy: "Ana",
  pictureDay: "2026-11-16",
  now,
});
const pictures = (...names: string[]) =>
  names.map((name) => ({ lines: recorded(name), classified: classifyScreen(recorded(name)) }));

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  // The OGs roster of 2026-11-16 (public names), plus an invented member "Ana" for the chat tests.
  const members = [...ogsCandidates(), { uid: 1, names: ["Ana"] }];
  await db.insert(dailyReads).values({ day: "2026-11-15", startedAt: NOW, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-15",
    unionId: OGS,
    memberCount: members.length,
    isFresh: true,
    sourceUpdatedAt: NOW,
    memberUids: members.map((m) => m.uid),
    memberNames: members.map((m) => m.names[0] ?? ""),
    memberPower: members.map(() => 1000),
    memberKills: members.map(() => 0),
  });
});

async function officer(id: string, name: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, id, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

describe("drafts from pictures (issue 299)", () => {
  it("merges two pages of one ranking into one draft, matched to members, and saves nothing yet", async () => {
    const ana = await officer("1", "Ana");
    const { drafts, outcomes } = await createDrafts(
      db,
      ana,
      pictures("27-alliance-duel-weekly-mine", "28-alliance-duel-weekly-mine"),
      sent(),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ kind: "alliance_duel", scope: "weekly", rows: 16 });
    expect(outcomes).toEqual([
      { status: "draft", draft: 0 },
      { status: "draft", draft: 0 },
    ]);
    const [draft] = await db.select().from(screenshotDrafts);
    const sure = draft?.rows.filter((r) => r.match.status === "sure") ?? [];
    // Measured: 9 of 16 names read on these 358 px pages match one member for sure.
    expect(sure.length).toBeGreaterThanOrEqual(8);
    expect(draft?.rows.map((r) => r.rank)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    // D75: nothing counts before Save.
    expect(await db.select().from(allianceDuelPoints)).toEqual([]);
  });

  it("leaves out the rows of other alliances on a server-wide page and counts them", async () => {
    const { drafts } = await createDrafts(
      db,
      await officer("1", "Ana"),
      pictures("26-alliance-duel-weekly-server"),
      sent(),
    );
    // Row 3 is Derek-Tom of [Ratz].
    expect(drafts[0]?.leftOut).toBe(1);
    expect(drafts[0]?.rows).toBe(7);
  });

  it("makes no draft from a map, even when the officer picks a type", async () => {
    const map = ["0/s 15 8 12 0/s", "#325 [OGs] MissJackson", "#325 [OGs] meonDoc", "Map"];
    const result = await createDrafts(
      db,
      await officer("1", "Ana"),
      [{ lines: map, classified: classifyScreen(map) }],
      sent(),
      { kind: "might", scope: null },
    );
    expect(result).toEqual({ drafts: [], outcomes: [{ status: "map" }] });
  });
});

describe("saving a draft", () => {
  it("lets the first save win and tells the second officer who saved it", async () => {
    const [ana, bo] = [await officer("1", "Ana"), await officer("2", "Bo")];
    const { drafts } = await createDrafts(
      db,
      ana,
      pictures("98-alliance-duel-weekly-phone"),
      sent(),
    );
    const id = drafts[0]?.id ?? 0;
    const [draft] = await db.select().from(screenshotDrafts);
    const rows = (draft?.rows ?? []).flatMap((r) =>
      r.match.status === "sure" && r.value !== null ? [{ uid: r.match.uid, value: r.value }] : [],
    );
    const input: SaveInput = { version: 1, scope: "weekly", day: null, weekBefore: false, rows };
    // Both officers opened version 1 and press Save.
    expect(await saveDraft(db, ana, id, input, { now: NOW, zone: "Etc/GMT+2" })).toEqual({
      ok: true,
    });
    expect(await saveDraft(db, bo, id, input, { now: NOW, zone: "Etc/GMT+2" })).toEqual({
      ok: false,
      code: "already_saved",
      by: "Ana",
    });
    const saved = await db.select().from(allianceDuelPoints);
    expect(saved).toHaveLength(rows.length);
    expect(saved.every((p) => p.week === "2026-11-16" && p.day === "week")).toBe(true);
  });
});

describe("the hooks of other sessions' destinations", () => {
  it("saves a Secret Ops report into the thefts log for the member it belongs to", async () => {
    const ana = await officer("1", "Ana");
    const { drafts } = await createDrafts(db, ana, pictures("53-secret-ops-report"), sent());
    const id = drafts[0]?.id ?? 0;
    const [draft] = await db.select().from(screenshotDrafts);
    // Attackers are not members: their rows carry no member match.
    expect(draft?.rows.every((r) => r.match.status === "none" && r.entry)).toBe(true);
    const victim = ogsCandidates()[0]?.uid ?? 0;
    const entries = (draft?.rows ?? []).map((r, row) => ({ row, name: r.name || "Someone" }));
    const input: SaveInput = {
      ...{ version: 1, scope: null, day: null, weekBefore: false, rows: [] },
      report: { victimUid: victim, entries },
    };
    const result = await saveDraft(db, ana, id, input, { now: NOW, zone: "Etc/GMT+2" });
    // Picture 53: two thefts by other alliances, four help lines from members.
    expect(result).toMatchObject({ ok: true, thefts: { saved: 2, left: { help: 4 } } });
    const stored = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from thefts where victim_uid = ${victim} and source = 'photo'`,
    );
    expect(stored.rows[0]?.n).toBe(2);
  });

  it("appends member facts from a chat, refuses a stale fact with the newer value, then saves", async () => {
    const [ana, bo] = [await officer("1", "Ana"), await officer("2", "Bo")];
    // Invented sender and messages in the shape of a chat (the member "Ana" is added to the roster).
    const chat = [
      "Kingdom Alliance | Private Chat",
      "WA XX. 27 ¢ [0Gs] Ana",
      "Main squad 12.3 M",
      "WA XX. 27 ¢ [0Gs] Ana",
      "AD Tech 55%",
      "WA XX. 28 ¢ [0Gs] Bo",
      "Hello everyone",
    ];
    const { drafts } = await createDrafts(
      db,
      ana,
      [{ lines: chat, classified: classifyScreen(chat) }],
      sent(),
    );
    expect(drafts[0]).toMatchObject({ kind: "member_update", rows: 2 });
    const [draft] = await db.select().from(screenshotDrafts);
    const uid = draft?.rows[0]?.match.status === "sure" ? draft.rows[0].match.uid : 0;
    // Bo saves AD Tech from the member card first.
    await saveFacts(
      db,
      bo,
      uid,
      [{ field: "adTech", version: 0, value: 60, source: "officer" }],
      NOW,
    );
    const rows = [
      { uid, value: 12_300_000, field: "squadMight" as const, version: 0 },
      { uid, value: 55, field: "adTech" as const, version: 0 },
    ];
    const base = { version: 1, scope: null, day: null, weekBefore: false };
    const clock = { now: NOW, zone: "Etc/GMT+2" };
    const stale = await saveDraft(db, ana, drafts[0]?.id ?? 0, { ...base, rows }, clock);
    expect(stale).toMatchObject({ ok: false, code: "conflict" });
    expect(stale.ok === false && stale.detail).toEqual([
      expect.objectContaining({ uid, field: "adTech", value: 60, version: 1 }),
    ]);
    // Nothing was written, and the draft is still open: "Use mine" saves on the newer version.
    expect((await factsOf(db, ana)).get(uid)?.squadMight).toBeUndefined();
    const mine = [rows[0], { ...rows[1], version: 1 }] as typeof rows;
    expect(await saveDraft(db, ana, drafts[0]?.id ?? 0, { ...base, rows: mine }, clock)).toEqual({
      ok: true,
    });
    const facts = (await factsOf(db, ana)).get(uid);
    expect(facts?.adTech).toMatchObject({ value: 55, version: 2, source: "message" });
    expect(facts?.squadMight).toMatchObject({ value: 12_300_000, version: 1 });
  });
});

describe("saving, kind by kind", () => {
  const clock = { now: NOW, zone: "Etc/GMT+2" };
  const base = { version: 1, scope: null, day: null, weekBefore: false } as const;

  it("makes no draft from a notice it does not recognise, nor from a kind that saves later", async () => {
    const notice = ["SCHEDULE | MONDAY", "Good morning", "See you later"];
    const damage = ["Reward Details", "Damage Phase: 5", "MVP Bonus: Reward x10"];
    const result = await createDrafts(
      db,
      await officer("1", "Ana"),
      [notice, damage].map((lines) => ({ lines, classified: classifyScreen(lines) })),
      sent(),
    );
    expect(result).toEqual({
      drafts: [],
      outcomes: [{ status: "unrecognised" }, { status: "soon", kind: "damage_event" }],
    });
  });

  it("does not write AD Tech again for a member already at 100%, and still saves the squad might", async () => {
    const ana = await officer("1", "Ana");
    await saveFacts(
      db,
      ana,
      1,
      [{ field: "adTech", version: 0, value: 100, source: "officer" }],
      NOW,
    );
    const chat = [
      "WA XX. 27 ¢ [0Gs] Ana",
      "Main squad 12.3 M",
      "WA XX. 27 ¢ [0Gs] Ana",
      "AD Tech 55%",
      "WA XX. 28 ¢ [0Gs] Bo",
      "Hello everyone",
    ];
    const { drafts } = await createDrafts(
      db,
      ana,
      [{ lines: chat, classified: classifyScreen(chat) }],
      sent(),
    );
    const rows = [
      { uid: 1, value: 12_300_000, field: "squadMight" as const, version: 0 },
      { uid: 1, value: 55, field: "adTech" as const, version: 1 },
    ];
    expect(await saveDraft(db, ana, drafts[0]?.id ?? 0, { ...base, rows }, clock)).toEqual({
      ok: true,
    });
    const facts = (await factsOf(db, ana)).get(1);
    expect(facts?.adTech).toMatchObject({ value: 100, version: 1 });
    expect(facts?.squadMight).toMatchObject({ value: 12_300_000, version: 1 });
  });

  it("keeps a Kills check as counts only", async () => {
    const ana = await officer("1", "Ana");
    const { drafts } = await createDrafts(db, ana, pictures("89-kills-phone"), sent());
    const [draft] = await db.select().from(screenshotDrafts);
    const rows = (draft?.rows ?? []).flatMap((r) =>
      r.match.status === "sure" && r.value !== null ? [{ uid: r.match.uid, value: r.value }] : [],
    );
    await saveDraft(db, ana, drafts[0]?.id ?? 0, { ...base, rows }, clock);
    const checks = await db.execute<{ kind: string; rows: number; compared: number }>(
      sql`select kind, rows, compared from screenshot_checks`,
    );
    // The test roster's kills are 0, so every compared row differs; only the counts are stored.
    expect(checks.rows).toEqual([{ kind: "kills", rows: rows.length, compared: rows.length }]);
  });

  it("stores an Alliance Duel daily page under the day tab and the week the officer picked", async () => {
    const ana = await officer("1", "Ana");
    const { drafts } = await createDrafts(
      db,
      ana,
      pictures("99-alliance-duel-daily-phone"),
      sent(),
    );
    const [draft] = await db.select().from(screenshotDrafts);
    const rows = (draft?.rows ?? []).flatMap((r) =>
      r.match.status === "sure" && r.value !== null ? [{ uid: r.match.uid, value: r.value }] : [],
    );
    const input: SaveInput = { version: 1, scope: "daily", day: "tue", weekBefore: true, rows };
    expect(await saveDraft(db, ana, drafts[0]?.id ?? 0, input, clock)).toEqual({ ok: true });
    const saved = await db
      .selectDistinct({ week: allianceDuelPoints.week, day: allianceDuelPoints.day })
      .from(allianceDuelPoints);
    // The picture's day is Monday 2026-11-16; the week before starts on Monday 2026-11-09.
    expect(saved).toEqual([{ week: "2026-11-09", day: "tue" }]);
  });
});

describe("expiry", () => {
  it("drops a draft 7 days after it was made, from the list and from the table", async () => {
    const ana = await officer("1", "Ana");
    const old = new Date(NOW.getTime() - 8 * DAY);
    await createDrafts(db, ana, pictures("89-kills-phone"), sent(old));
    await createDrafts(db, ana, pictures("90-might-phone"), sent());
    expect((await toReview(db, ana, NOW)).map((d) => d.kind)).toEqual(["might"]);
    const left = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from screenshot_drafts`,
    );
    expect(left.rows[0]?.n).toBe(1);
  });
});
