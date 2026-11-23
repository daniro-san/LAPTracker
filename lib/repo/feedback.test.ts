// D157: the daily job deletes feedback older than 180 days and keeps everything at or after that edge; a
// row's picture goes with it.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { feedback, feedbackPictures } from "../schema-feedback";
import { insertFeedback, purgeOldFeedback } from "./feedback";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const DAY_MS = 86_400_000;

describe("the feedback purge (D157)", () => {
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

describe("a send's picture and the purge (D157 amended 2026-11-22)", () => {
  it("deletes the picture of a row past 180 days with it and keeps a newer row's", async () => {
    const data = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]);
    for (const [text, ms] of [
      ["old", 181 * DAY_MS],
      ["new", DAY_MS],
    ] as const)
      await insertFeedback(
        db,
        {
          area: "board",
          kind: "problem",
          text,
          path: "/w/alpha/board",
          language: "en",
          tier: "member",
          createdAt: new Date(T0.getTime() - ms),
        },
        { data, type: "image/png", width: 1, height: 1, bytes: data.length, hash: text },
      );
    expect(await purgeOldFeedback(db, T0)).toBe(1);
    expect(await db.select({ hash: feedbackPictures.hash }).from(feedbackPictures)).toEqual([
      { hash: "new" },
    ]);
  });
});
