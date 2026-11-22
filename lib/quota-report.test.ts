import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { ADMIN_WEBHOOK, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { quotaReport } from "./run";
import { dailyReads, dailyRosters } from "./schema";

const DAY = 86_400_000;
const START = Date.UTC(2026, 10, 1, 8, 1);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

/** The one admin post the check sent. */
function adminPost(posts: { url: string; content: string }[]): string {
  const sent = posts.filter((p) => p.url === ADMIN_WEBHOOK);
  expect(sent).toHaveLength(1);
  return sent[0]?.content ?? "";
}

/** `n` daily reads of the site's own alliance: Zelda-Secret keeps 1,000 might, then drops to 900 on the last. */
async function reads(n: number) {
  for (let i = 0; i < n; i++) {
    const at = new Date(START + i * DAY);
    const day = at.toISOString().slice(0, 10);
    await db.insert(dailyReads).values({ day, startedAt: at, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: day,
      unionId: OWN_ALLIANCE_ID,
      memberCount: 1,
      sourceUpdatedAt: at,
      isFresh: true,
      memberUids: [7],
      memberNames: ["Zelda-Secret"],
      memberPower: [i === n - 1 ? 900 : 1000],
      memberKills: [0],
    });
  }
}

describe("the Friday check's might line (D70)", () => {
  it("carries the two counts and the page's link, and no member name", async () => {
    await reads(7);
    const { ctx, posts } = testContext(db);

    await quotaReport(ctx, db, { always: true });

    const content = adminPost(posts);
    expect(content).toContain("Might unchanged ≥ 7 daily reads: 0 · Lost might ≥ 5 %: 1");
    expect(content).not.toContain("Zelda");
  });

  it("leaves the line out while the alliance has fewer than 7 daily reads", async () => {
    await reads(6);
    const { ctx, posts } = testContext(db);

    await quotaReport(ctx, db, { always: true });

    expect(adminPost(posts)).not.toContain("Might unchanged");
  });
});
