// The tracked set (D133): the ranks board read once a server day, its top 20 by might the day's set, with who
// came in and who went out; a board that fails keeps the newest set; the daily read adds each workspace's
// alliance outside the set, on its own key when it saved one, and never on ours when that key cannot be used.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { BOARD_EXTRA, fakeInternal, IDS, T0 } from "./collector.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { allianceList } from "./queries/alliance-list";
import { claimTrackedSet } from "./repo/alliances";
import { storeKey } from "./repo/workspace-keys";
import { saveWorkspace } from "./repo/workspaces";
import { UpstreamError } from "./sources/types";
import { dayTargets, trackedChangeMessage, trackedSetFor } from "./tracked";
import { sealKey } from "./workspace-keys";

const DAY = "2026-11-19";
const YESTERDAY = "2026-11-18";
const ORIGIN = "https://laptracker.test";
/** Invented, low-entropy values: never real keys. */
const SECRET = Buffer.alloc(32, 7).toString("base64");
const THEIR_KEY = `lap_${"their-alliance-test-".repeat(2)}key`;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** The fake board (IDS first by might, then BOARD_EXTRA), counting its reads. */
function board(fail = false) {
  const real = fakeInternal();
  const reads = { n: 0 };
  const internal = {
    fetchRanks: async (server: number) => {
      reads.n++;
      if (fail) throw new UpstreamError(503);
      return real.fetchRanks(server);
    },
  };
  return { deps: { internal, now: () => T0 }, reads };
}

describe("the day's tracked set (D133)", () => {
  it("reads the board once a day, takes its top 20 by might, and names who came in and who went out", async () => {
    const before = [...IDS.slice(0, 19), BOARD_EXTRA[0] ?? 0];
    await claimTrackedSet(db, { day: YESTERDAY, allianceIds: before, source: "board" }, T0);
    const { deps, reads } = board();

    const set = await trackedSetFor(deps, db, DAY);
    const again = await trackedSetFor(deps, db, DAY);

    expect(set).toMatchObject({ allianceIds: IDS, source: "board", created: true });
    expect([set?.entered, set?.left]).toEqual([[IDS[19]], [BOARD_EXTRA[0]]]);
    expect(again).toMatchObject({ allianceIds: IDS, created: false, entered: [], left: [] });
    expect(reads.n).toBe(1);
    const message = set && (await trackedChangeMessage(db, set, ORIGIN));
    expect(message?.split("\n")).toHaveLength(3);
    expect((await allianceList(db, 1)).total).toBe(IDS.length + BOARD_EXTRA.length);
  });

  it("keeps the newest set when the board cannot be read, and says so on the admin line", async () => {
    const kept = IDS.slice(0, 5);
    await claimTrackedSet(db, { day: YESTERDAY, allianceIds: kept, source: "board" }, T0);

    const set = await trackedSetFor(board(true).deps, db, DAY);

    expect(set).toMatchObject({ allianceIds: kept, source: "previous", entered: [], left: [] });
    expect(set && (await trackedChangeMessage(db, set, ORIGIN))).toContain("unreadable");
  });

  it("adds each workspace's alliance outside the set: on its own key, on ours without one, never with an unusable one", async () => {
    const [own = 0, none = 0, broken = 0] = BOARD_EXTRA;
    for (const unionId of [own, none, broken, IDS[0] ?? 0])
      await saveWorkspace(db, {
        unionId,
        slug: `w${unionId}`,
        discordGuildId: String(unionId),
        leaderRoleIds: ["2"],
      });
    const ids = new Map((await db.query.workspaces.findMany()).map((w) => [w.unionId, w.id]));
    for (const [unionId, status] of [
      [own, "ok"],
      [broken, "invalid"],
    ] as const) {
      const id = ids.get(unionId) ?? 0;
      await storeKey(db, id, sealKey(SECRET, id, THEIR_KEY), { status, quotaRemaining: 900 }, T0);
    }
    const deps = { ...board().deps, secret: SECRET };

    const { targets } = await dayTargets(deps, db, DAY);

    expect(targets.slice(0, IDS.length).every((t) => t.key === null)).toBe(true);
    expect(targets.slice(IDS.length).map((t) => [t.unionId, t.key?.apiKey ?? null])).toEqual([
      [own, THEIR_KEY],
      [none, null],
    ]);
  });
});
