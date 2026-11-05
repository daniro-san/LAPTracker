import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_WEBHOOK, testContext } from "./app-context.test-helpers";
import { recordAppError } from "./app-errors";
import { minutes, T0 } from "./collector.test-helpers";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { claimAppErrorAlert } from "./repo/app-errors";

const db = await openTestDb();
const HOUR = 60 * 60_000;

beforeEach(async () => {
  await truncateAll(db);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

describe("app-error alert", () => {
  it("alerts once per hour while errors continue", async () => {
    const { ctx, clock, posts } = testContext(db);
    // An error every 5 minutes for 3 hours (36 errors, ≥ 1 s apart so the per-instance limiter
    // lets each one through): alerts at 0, 60 and 120 minutes.
    for (let i = 0; i < 36; i++) {
      clock.now = new Date(T0.getTime() + i * minutes(5));
      await recordAppError(ctx, {
        route: "/api/x",
        kind: "route",
        digest: null,
        error: new Error(),
      });
    }
    expect(posts.filter((p) => p.url === ADMIN_WEBHOOK)).toHaveLength(3);
  });

  it("gives the claim to exactly one of two concurrent callers", async () => {
    await claimAppErrorAlert(db, T0, HOUR);
    const later = new Date(T0.getTime() + HOUR);
    const claims = await Promise.all([
      claimAppErrorAlert(db, later, HOUR),
      claimAppErrorAlert(db, later, HOUR),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
});
