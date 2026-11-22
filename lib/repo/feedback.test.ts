// D155: the daily job deletes feedback older than 180 days and keeps everything at or after that edge.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { feedback } from "../schema-feedback";
import { purgeOldFeedback } from "./feedback";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const DAY_MS = 86_400_000;

describe("the feedback purge (D155)", () => {
  it("deletes rows created more than 180 days ago and keeps the one at the edge and newer ones", async () => {
    const ages = { justOver: 180 * DAY_MS + 60_000, edge: 180 * DAY_MS, month: 30 * DAY_MS };
    await db.insert(feedback).values(
      Object.entries(ages).map(([text, ms]) => ({
        area: "desk" as const,
        kind: "idea" as const,
        text,
        path: "/w/alpha",
        language: "en",
        tier: "officer" as const,
        createdAt: new Date(T0.getTime() - ms),
      })),
    );
    expect(await purgeOldFeedback(db, T0)).toBe(1);
    expect((await db.select({ text: feedback.text }).from(feedback)).map((r) => r.text)).toEqual([
      "edge",
      "month",
    ]);
  });
});
