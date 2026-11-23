// The tick's catalog posts (#713 part C, D159), after its answer. No new cron and no extra wake of the
// database (D141): the route calls this only on a tick that opened it anyway, and the clock comes first, so
// on a day no catalog post is due nothing is scheduled. On a Monday (server day) that is the first tick after
// Sunday's end-of-day read: the squads queue's, or at the latest the 3-hourly heartbeat. The posts are made
// and sent by lib/private/catalog-posts.ts, the one lib/private module this file may import (D159), on its
// own connection: the request's is closed with the response.
import { after } from "next/server";

import type { AppContext } from "./app-context";
import { postsMayBeDue } from "./post-catalog";
import { sendDuePosts } from "./private/catalog-posts";
import { reportError } from "./report-error";

/** After a tick that opened the database: the catalog posts due now; true when they were scheduled. */
export function schedulePostsTick(ctx: AppContext): boolean {
  if (!postsMayBeDue(ctx.now(), ctx.env)) return false;
  after(async () => {
    const { db, close } = ctx.openDb();
    try {
      await sendDuePosts(db, { env: ctx.env, fetch: ctx.fetch, now: ctx.now, report: ctx.report });
    } catch (error: unknown) {
      console.error("posts.failed", { code: error instanceof Error ? error.name : "unknown" });
      reportError(ctx, { route: "/api/tick", kind: "posts.failed", error });
    } finally {
      await close();
    }
  });
  return true;
}
