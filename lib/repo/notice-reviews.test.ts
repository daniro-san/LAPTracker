// insertOutcome checks the request inside its own insert (D123 phase 2): an outcome sent after a withdraw
// is refused even when the answerer read the request before the withdraw. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { T0 } from "../collector.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { workspaces, workspaceUsers } from "../schema";
import { noticeReviewOutcomes, noticeReviews, notices } from "../schema-notices";
import { insertOutcome } from "./notice-reviews";

let db: Db;
let review = 0;
let rook = 0;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const workspaceId = ws?.id ?? 0;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: "id-Rook", displayName: "Rook" })
    .returning({ id: workspaceUsers.id });
  rook = user?.id ?? 0;
  const [notice] = await db
    .insert(notices)
    .values({ workspaceId, createdAt: T0, updatedAt: T0 })
    .returning({ id: notices.id });
  const [row] = await db
    .insert(noticeReviews)
    .values({ workspaceId, noticeId: notice?.id ?? 0, requestId: "ask-1", askedAt: T0 })
    .returning({ id: noticeReviews.id });
  review = row?.id ?? 0;
});

const outcome = () => ({
  workspaceId: 1,
  reviewId: review,
  requestId: "approve-1",
  outcome: "approved" as const,
  by: rook,
  at: T0,
});

describe("insertOutcome (D113, D123 phase 2)", () => {
  it("stores an outcome on an open request, and refuses one on a withdrawn request", async () => {
    expect(await insertOutcome(db, outcome())).toBe("ok");
    await db.delete(noticeReviewOutcomes);
    await db.update(noticeReviews).set({ deletedAt: T0, deletedBy: rook, deleteRequestId: "w-1" });
    expect(await insertOutcome(db, outcome())).toBe("not_found");
    expect(await db.select().from(noticeReviewOutcomes)).toEqual([]);
  });
});
