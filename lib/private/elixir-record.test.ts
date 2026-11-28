import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createEntry } from "./calendar";
import type { NewEntry } from "./calendar-model";
import { addDays } from "./calendar-time";
import { cardElixir, elixirCard } from "./card-elixir";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { seatsOf, type Seat } from "./elixir-record";
import { markOne, markRest, setResult, type Occasion } from "./roll-call";
import { outcomeOf } from "./roll-call-rules";
import { setTeam } from "./roll-call-team";
import { callView } from "./roll-call-view";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-16T12:00:00Z");
const ZONE = "Etc/GMT+2";
const T = WORKSPACE_DICTIONARIES.en;

let db: Db;
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
    memberUids: [101, 102],
    memberNames: ["P101", "P102"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
  });
});

async function signedIn(slug: string, name: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `${slug}-${name}`, name, NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  return access;
}

/** Team A's Elixir Scramble of game week `k` after 2026-11-16, with members 101 and 102 on it. */
async function elixirWeek(access: WorkspaceAccess, k: number): Promise<Occasion> {
  const made = await createEntry(
    db,
    access,
    {
      kind: "elixir",
      variant: "A",
      day: addDays("2026-11-20", 7 * k),
      minute: 1080,
      notes: null,
      link: null,
      forMembers: false,
      notice: null,
      weekly: false,
    } as NewEntry,
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  const occasion = { entry: made.id, week: addDays("2026-11-16", 7 * k) };
  await setTeam(db, access, { occasion, uids: [101, 102], on: true }, NOW);
  return occasion;
}

describe("Elixir Scramble in more detail (issue 468)", () => {
  it("saves Registered, Sub and a Joined score for its own workspace only", async () => {
    const ana = await signedIn("ogs", "Ana");
    const week = await elixirWeek(ana, 0);
    const save = (uid: number, mark: "registered" | "sub" | "yes", score?: number) =>
      markOne(db, ana, { occasion: week, uid, mark, version: 0, score }, NOW);
    expect(await save(101, "registered")).toEqual({ ok: true, version: 1 });
    expect(await save(102, "yes", 1200)).toEqual({ ok: true, version: 1 });
    const view = await callView(db, ana, week, "en", ZONE);
    expect(view?.rows.map((r) => [r.uid, r.mark, r.score])).toEqual([
      [101, "registered", null],
      [102, "yes", 1200],
    ]);
    expect(view?.tally).toMatchObject({ yes: 1, other: 1, notSet: 0 });
    // Another workspace's officer reaches nothing of it, and the extra marks are the Elixir Scramble's only.
    await saveWorkspace(db, {
      unionId: 2,
      slug: "other",
      discordGuildId: "9",
      leaderRoleIds: ["3"],
    });
    const bo = await signedIn("other", "Bo");
    const call = view?.opened.call?.id ?? 0;
    expect(
      await markOne(db, bo, { occasion: { id: call }, uid: 101, mark: "sub", version: 1 }, NOW),
    ).toEqual({ ok: false, code: "not_found" });
    const kvk = await createEntry(
      db,
      ana,
      {
        kind: "kvk",
        day: "2026-11-21",
        minute: 720,
        notes: null,
        link: null,
        forMembers: false,
        notice: null,
        weekly: false,
      } as NewEntry,
      randomUUID(),
    );
    if (!kvk.ok) throw new Error(kvk.code);
    const shield = { entry: kvk.id, week: "2026-11-16" };
    expect(
      await markOne(db, ana, { occasion: shield, uid: 101, mark: "sub", version: 0 }, NOW),
    ).toEqual({ ok: false, code: "invalid" });
  });

  it("reads Won or Lost from the two saved scores", async () => {
    const ana = await signedIn("ogs", "Ana");
    const week = await elixirWeek(ana, 0);
    const input = (ourScore: number | null, theirScore: number | null) => ({
      occasion: week,
      opponent: "Foxes",
      ourScore,
      theirScore,
    });
    await setResult(db, ana, input(1200, 900), NOW);
    const saved = (await callView(db, ana, week, "en", ZONE))?.result;
    expect(saved).toMatchObject({ opponent: "Foxes", ourScore: 1200, theirScore: 900 });
    expect(outcomeOf(saved?.ourScore ?? null, saved?.theirScore ?? null)).toBe("won");
    expect(outcomeOf(800, 900)).toBe("lost");
    expect(outcomeOf(900, 900)).toBe("tie");
    // One score alone says nothing.
    expect(outcomeOf(900, null)).toBeNull();
  });

  it("shows the last 4 Elixir seats, newest first, with mark, score and result", async () => {
    const ana = await signedIn("ogs", "Ana");
    for (let k = 0; k < 3; k += 1) await elixirWeek(ana, k);
    const [w3, w4] = [await elixirWeek(ana, 3), await elixirWeek(ana, 4)];
    await markOne(db, ana, { occasion: w4, uid: 101, mark: "yes", version: 0, score: 1500 }, NOW);
    await setResult(db, ana, { occasion: w4, opponent: null, ourScore: 10, theirScore: 20 }, NOW);
    await markOne(db, ana, { occasion: w3, uid: 101, mark: "excused", version: 0 }, NOW);
    const card = await cardElixir(db, ana, 101, { language: "en", t: T });
    expect(card?.head).toBe("Last 4 Elixir");
    expect(card?.rows).toEqual([
      "Fri, Dec 18 · Joined · 1500 · Lost",
      "Fri, Dec 11 · Excused",
      "Fri, Dec 4 · Not set",
      "Fri, Nov 27 · Not set",
    ]);
    expect(card?.followUp).toBeNull();
  });

  it("suggests asking only from explicit Did not join marks; Sub, Excused, unmarked and the rest never count", async () => {
    const ana = await signedIn("ogs", "Ana");
    const [w0, w1, w2] = [
      await elixirWeek(ana, 0),
      await elixirWeek(ana, 1),
      await elixirWeek(ana, 2),
    ];
    // "The rest" fills a ✗ nobody tapped: an assumption, so it is not an explicit mark.
    await markRest(db, ana, { occasion: w0, uids: [101, 102] }, { now: NOW, zone: ZONE });
    await markOne(db, ana, { occasion: w1, uid: 101, mark: "no", version: 0 }, NOW);
    await markOne(db, ana, { occasion: w2, uid: 101, mark: "sub", version: 0 }, NOW);
    const seats = await seatsOf(db, ana, 101);
    expect(seats.map((s) => [s.mark, s.explicit])).toEqual([
      ["sub", true],
      ["no", true],
      ["no", false],
    ]);
    expect(elixirCard(seats, T, "en")?.followUp).toBeNull();
    // A second explicit ✗ among the last 4 shows the line, in the owner's words.
    const seat = (mark: Seat["mark"], explicit: boolean): Seat => ({
      day: "2026-11-20",
      variant: "A",
      mark,
      score: null,
      explicit,
      outcome: null,
    });
    const said = (...marks: [Seat["mark"], boolean][]) =>
      elixirCard(
        marks.map(([m, e], i) => ({ ...seat(m, e), day: `2026-11-${10 + i}` })),
        T,
        "en",
      )?.followUp;
    expect(said(["no", true], ["no", true], ["excused", true], [null, false])).toBe(
      "Missed an assigned seat twice in the last 4. Maybe ask if the time suits them.",
    );
    expect(said(["no", true], ["sub", true], ["excused", true], [null, false])).toBeNull();
    expect(said(["no", false], ["no", false], ["no", true])).toBeNull();
  });
});
