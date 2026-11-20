// INVARIANT squads.key-rule (D135, review of PR 515): `squadsKey`, which the desk's progress lines read,
// and `squadTargets`, which the squads read runs on, agree on a key spent today: neither reads it until the
// 00:00 UTC reset. Invented, low-entropy values: never real keys.
import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { setAllianceSwitch, setSwitch } from "./repo/workspace-features";
import { keyFacts, storeKey } from "./repo/workspace-keys";
import { seedWorkspace } from "./workspace-data.test-helpers";
import { sealKey, squadsKey, squadTargets } from "./workspace-keys";

const SECRET = Buffer.alloc(32, 7).toString("base64");
const KEY = `lap_${"spent-today-test-key-".repeat(2)}x`;
const UNION = 67109944;
/** Thursday 23:39 server time (UTC−2), and the next day after the 00:00 UTC reset. */
const THU = new Date("2026-11-20T01:39:00Z");
const FRI = new Date("2026-11-21T01:39:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  await truncateAll(db);
});

describe("one rule for whose key reads the squads (D135)", () => {
  it("a key spent today: neither squadsKey nor squadTargets reads it until the reset", async () => {
    const { workspaceId } = await seedWorkspace(db, "spent", UNION);
    await setSwitch(db, workspaceId, "squads", true, THU);
    await setAllianceSwitch(db, workspaceId, "squads", true, THU);
    const sealed = sealKey(SECRET, workspaceId, KEY);
    await storeKey(db, workspaceId, sealed, { status: "out_of_quota", quotaRemaining: 0 }, THU);
    const facts = { ...(await keyFacts(db, workspaceId)), unionId: UNION };
    const read = async (now: Date) =>
      (await squadTargets(db, SECRET, now)).some((t) => t.unionId === UNION);
    expect(squadsKey(facts, SECRET, THU)).toBeNull();
    expect(await read(THU)).toBe(false);
    expect(squadsKey(facts, SECRET, FRI)).toBe("own");
    expect(await read(FRI)).toBe(true);
  });
});
