// "Steady effort" in the Members view's thanks (issue 465): who helped and did quests every day, from the
// workspace's own reads only. The day rule itself is tested in steady.test.ts. Invented data only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace } from "./access";
import { saveFacts } from "./member-facts";
import { membersView } from "./members";
import { createSession } from "./session";

const OGS = 67111155;
const NSE = 67109944;
// Monday 2026-11-16: the thanks cover Nov 9-15. Reads on Mon-Thu, Sat and Sun; Friday has none.
const NOW = new Date("2026-11-16T12:00:00Z");
const ZONE = "Etc/GMT+2";
const DAYS = [0, 1, 2, 3, 5, 6].map((n) =>
  new Date(Date.UTC(2026, 10, 9 + n)).toISOString().slice(0, 10),
);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: NSE, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] });
});

/** A member's raw roster entry: `honor` coins and `active`, the quest points total since Monday. */
type Raw = { honor: number; active: number };
/** All 1,000 coins, and 100 more quest points in the running total on every read. */
const steady = (read: number): Raw => ({ honor: 1000, active: 100 * (read + 1) });

/** One end-of-day read per day of DAYS for the alliance: uid → what `who` gives for read number n. */
async function reads(unionId: number, who: (n: number) => Record<number, Raw>) {
  for (const [n, day] of DAYS.entries()) {
    const at = new Date(`${day}T23:37:00-02:00`);
    const uids = Object.keys(who(n)).map(Number);
    await db
      .insert(dailyReads)
      .values({ day, startedAt: at, status: "complete" })
      .onConflictDoNothing();
    await db.insert(dailyRosters).values({
      readDay: day,
      unionId,
      memberCount: uids.length,
      sourceUpdatedAt: at,
      isFresh: true,
      memberUids: uids,
      memberNames: uids.map((u) => `P${u}`),
      memberPower: uids.map(() => 1000),
      memberKills: uids.map(() => 0),
      rawJson: {
        members: uids.map((uid) => ({
          uid,
          nick_name: `P${uid}`,
          power: 1000,
          lv: 25,
          rank_code: 103,
          rank_label: "R3",
          daily_tech: null,
          daily_honor: who(n)[uid]?.honor,
          active: who(n)[uid]?.active,
        })),
      },
    });
  }
}

async function signedIn(slug: string) {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `officer-${slug}`, "Officer", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

describe("the Members view's steady thanks (issue 465)", () => {
  it("names who helped and who did quests every day, in name order, skipping a day with no read", async () => {
    await reads(OGS, (n) => ({
      // P12 sorts before P2, though uid 12 is the larger.
      2: steady(n),
      12: steady(n),
      // Coins short on Wednesday: quests only.
      3: { ...steady(n), honor: n === 2 ? 999 : 1000 },
      // No quest points after Tuesday: coins only.
      4: { ...steady(n), active: n < 2 ? 100 * (n + 1) : 200 },
    }));

    const { steady: names } = (await membersView(db, await signedIn("ogs"), NOW, ZONE)).thanks;

    expect(names.help.map((x) => x.name)).toEqual(["P12", "P2", "P4"]);
    expect(names.quests.map((x) => x.name)).toEqual(["P12", "P2", "P3"]);
  });

  it("leaves a member on a break out, as the other thanks do (D75)", async () => {
    await reads(OGS, (n) => ({ 1: steady(n), 2: steady(n) }));
    const ogs = await signedIn("ogs");
    await saveFacts(
      db,
      ogs,
      2,
      [{ field: "status", version: 0, value: "break", source: "officer" }],
      NOW,
    );

    const { steady: names } = (await membersView(db, ogs, NOW, ZONE)).thanks;

    expect([names.help, names.quests].map((g) => g.map((x) => x.uid))).toEqual([[1], [1]]);
  });

  it("never reads another workspace's reads", async () => {
    await reads(OGS, (n) => ({ 1: steady(n) }));
    await reads(NSE, (n) => ({ 99: steady(n) }));

    const { steady: names } = (await membersView(db, await signedIn("ogs"), NOW, ZONE)).thanks;

    expect([names.help, names.quests].map((g) => g.map((x) => x.uid))).toEqual([[1], [1]]);
  });
});
