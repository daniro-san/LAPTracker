// notice_publishes (D102): a publish is claimed under its request id before anything is posted, then
// marked posted or failed; the notice page shows the newest one that was posted.
import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { noticePublishes } from "../schema-notices";

export interface PublishClaim {
  workspaceId: number;
  noticeId: number;
  requestId: string;
  audience: "members" | "leaders";
  languages: string[];
  userId: number;
  now: Date;
}

export interface PublishRow {
  id: number;
  noticeId: number;
  audience: string;
  languages: string[];
  status: string;
  at: Date;
  by: string | null;
}

const columns = {
  id: noticePublishes.id,
  noticeId: noticePublishes.noticeId,
  audience: noticePublishes.audience,
  languages: noticePublishes.languages,
  status: noticePublishes.status,
  at: noticePublishes.publishedAt,
  by: workspaceUsers.displayName,
};

const rowOf = (r: Omit<PublishRow, "languages"> & { languages: string }): PublishRow => ({
  ...r,
  languages: r.languages.split(","),
});

/**
 * The claim: a new row ("posting") and `claimed: true`, or the row this request id already made (a double
 * tap, a retry, or one at the same moment, which lost on the unique index) and `claimed: false`.
 */
export async function claimPublish(
  db: Db,
  c: PublishClaim,
): Promise<{ claimed: boolean; row: PublishRow }> {
  const [made] = await db
    .insert(noticePublishes)
    .values({
      workspaceId: c.workspaceId,
      noticeId: c.noticeId,
      requestId: c.requestId,
      audience: c.audience,
      languages: c.languages.join(","),
      status: "posting",
      publishedBy: c.userId,
      publishedAt: c.now,
    })
    .onConflictDoNothing({ target: [noticePublishes.workspaceId, noticePublishes.requestId] })
    .returning({ id: noticePublishes.id });
  const [row] = await db
    .select(columns)
    .from(noticePublishes)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, noticePublishes.publishedBy))
    .where(
      and(
        eq(noticePublishes.workspaceId, c.workspaceId),
        eq(noticePublishes.requestId, c.requestId),
      ),
    );
  if (!row) throw new Error("publish_claim_lost");
  return { claimed: made !== undefined, row: rowOf(row) };
}

export async function finishPublish(
  db: Db,
  id: number,
  status: "posted" | "failed",
  messages: number,
): Promise<void> {
  await db.update(noticePublishes).set({ status, messages }).where(eq(noticePublishes.id, id));
}

/** The newest publish of the notice that reached Discord, if any. */
export async function lastPosted(
  db: Db,
  workspaceId: number,
  noticeId: number,
): Promise<PublishRow | null> {
  const [row] = await db
    .select(columns)
    .from(noticePublishes)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, noticePublishes.publishedBy))
    .where(
      and(
        eq(noticePublishes.workspaceId, workspaceId),
        eq(noticePublishes.noticeId, noticeId),
        eq(noticePublishes.status, "posted"),
      ),
    )
    .orderBy(desc(noticePublishes.id))
    .limit(1);
  return row ? rowOf(row) : null;
}
