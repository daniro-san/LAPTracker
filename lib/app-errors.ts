// app_errors (plan §6, Phase 6 "Observability"): errors outside a run, from instrumentation.ts's
// onRequestError and from route handlers that caught one. Never stores err.message (plan §12.3).
import type { AppContext } from "./app-context";
import { appErrorMessage, createNotifier } from "./notify";
import { insertAppError, lastAppErrorAt } from "./repo/app-errors";

const MIN_INSERT_GAP_MS = 1_000;
const ALERT_GAP_MS = 60 * 60_000;

// INVARIANT app-errors.one-per-second: per instance. Module scope is per instance by definition,
// which is exactly the plan's unit here (unlike the PIN limiter, which must hold across instances).
let lastInsertAt = Number.NEGATIVE_INFINITY;

export interface AppErrorEntry {
  /** The route pattern (e.g. /api/events/[id]), never the request path with its query string. */
  route: string;
  /** Where it happened: render, route, action, proxy. */
  kind: string;
  digest: string | null;
  error: unknown;
}

export async function recordAppError(ctx: AppContext, entry: AppErrorEntry): Promise<void> {
  const now = ctx.now();
  if (now.getTime() - lastInsertAt < MIN_INSERT_GAP_MS) return;
  lastInsertAt = now.getTime();
  const message = `${entry.kind} ${entry.error instanceof Error ? entry.error.name : "unknown"}`;
  console.error("app.error", { route: entry.route, message, digest: entry.digest });
  let opened: ReturnType<AppContext["openDb"]> | null = null;
  try {
    opened = ctx.openDb();
    const last = await lastAppErrorAt(opened.db);
    await insertAppError(opened.db, { at: now, route: entry.route, digest: entry.digest, message });
    // The first error in an hour pages the admins; the DB holds the last time, not this instance.
    if (last === null || now.getTime() - last.getTime() >= ALERT_GAP_MS) {
      await createNotifier(ctx.env, ctx.fetch).admin(
        appErrorMessage(entry.route, message, entry.digest),
      );
    }
  } catch {
    // The database is the likely cause; the console line above is the record.
  } finally {
    await opened?.close();
  }
}
