// The tick's catalog posts (#713, D159), after its answer. No new cron and no extra wake of the database
// (D141): the route calls this only on a tick that opened it anyway, and the clock comes first, so when no
// catalog post is due nothing is scheduled. Each post's own clock: the week on Monday from 00:00 ST (the
// first tick after Sunday's end-of-day read, at the latest the 3-hourly heartbeat); the shield-up reminder on
// Friday from 20:30 ST (the Friday check's tick); the welcome every day from the daily read (its own ticks,
// 23:30 and 23:45 ST); the weekly members summary on Monday from 00:00 ST, like the week; the KvK recap on
// the KvK's day from SNAPSHOT_AFTER (the End's own ticks). The posts are made and sent by
// lib/private/catalog-posts.ts, the one lib/private module this file may import (D159), on its own
// connection: the request's is closed with the response.
import { after } from "next/server";

import type { AppContext } from "./app-context";
import { postsMayBeDue } from "./post-catalog";
import { sendDuePosts } from "./private/catalog-posts";
import { reportError } from "./report-error";

/**
 * What the posts may spend from the tick's answer: they run beside the squads batch's `after` (180 s,
 * AFTER_BUDGET_MS) in the function's 300 s, so a workspace whose turn has not come waits for the next tick.
 */
export const POSTS_BUDGET_MS = 120_000;

/** After a tick that opened the database: the catalog posts due now; true when they were scheduled. */
export function schedulePostsTick(ctx: AppContext): boolean {
  if (!postsMayBeDue(ctx.now(), ctx.env)) return false;
  const deadline = Date.now() + POSTS_BUDGET_MS;
  after(async () => {
    const { db, close } = ctx.openDb();
    try {
      const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now, report: ctx.report };
      await sendDuePosts(db, deps, deadline);
    } catch (error: unknown) {
      console.error("posts.failed", { code: error instanceof Error ? error.name : "unknown" });
      reportError(ctx, { route: "/api/tick", kind: "posts.failed", error });
    } finally {
      await close();
    }
  });
  return true;
}
