// app_errors (plan §6, Phase 6 "Observability"): errors outside a run, from instrumentation.ts's
// onRequestError and from route handlers that caught one. `message` is our own words (kind and error
// name, plan §12.3) and groups the rows; `detail` (D61) keeps the error's own message, stack start and
// cause, redacted, for /admin/errors only. The admin alert adds the message's first line.
import { analyticsKey } from "./analytics/events";
import { captureServer, eventWorkspace, sendLater, type EventWorkspace } from "./analytics/server";
import { secretsOf, type AppContext } from "./app-context";
import { appErrorMessage, createNotifier } from "./notify";
import { redact } from "./redact";
import { claimAppErrorAlert, insertAppError } from "./repo/app-errors";
import { findWorkspaceBySlug } from "./repo/workspaces";

const MESSAGE_CHARS = 500;
const STACK_LINES = 12;
const ALERT_REASON_CHARS = 160;

export interface AppErrorDetail {
  name: string;
  message: string;
  stack?: string;
  cause?: string;
}

const line = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/** The error as thrown (D61): name, message, the stack's first frames and the cause, redacted. */
export function appErrorDetail(error: unknown, secrets: readonly string[]): AppErrorDetail {
  const e = error instanceof Error ? error : null;
  // Only the frames: a message of several lines also opens the stack, before the first "at ".
  const stack = e?.stack
    ?.split("\n")
    .map((frame) => frame.trim())
    .filter((frame) => frame.startsWith("at "))
    .slice(0, STACK_LINES)
    .join("\n");
  const detail = {
    name: e?.name ?? "unknown",
    message: (e?.message ?? String(error)).slice(0, MESSAGE_CHARS),
    ...(stack && { stack }),
    ...(e?.cause !== undefined && { cause: line(e.cause).slice(0, MESSAGE_CHARS) }),
  };
  return redact(detail, secrets) as AppErrorDetail;
}

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
  /** Under /w/[slug] or /api/w/[slug]: the slug from the request, for PostHog only (issue 452). */
  slug?: string;
}

/** The workspace a slug names, for analytics; null when none does or the database does not answer. */
async function workspaceOf(ctx: AppContext, slug: string): Promise<EventWorkspace | null> {
  let opened: ReturnType<AppContext["openDb"]> | null = null;
  try {
    opened = ctx.openDb();
    const workspace = await findWorkspaceBySlug(opened.db, slug);
    return workspace && eventWorkspace(workspace);
  } catch {
    return null;
  } finally {
    await opened?.close();
  }
}

export async function recordAppError(ctx: AppContext, entry: AppErrorEntry): Promise<void> {
  const now = ctx.now();
  const name = entry.error instanceof Error ? entry.error.name : "unknown";
  // PostHog's error tracking (D115), every error, before the per-second gate below, which only spares the
  // database: codes only, the error's class name, where and the route pattern, and under a workspace its
  // slug and tag (issue 452), only for a slug a workspace has. Never `detail`, which may hold a message built
  // from private data (D71). Sent after the response, so the error path never waits for it.
  const slug = entry.slug;
  sendLater(async () => {
    const where = slug && analyticsKey(ctx.env) ? await workspaceOf(ctx, slug) : null;
    const properties = { name, kind: entry.kind, route: entry.route };
    await captureServer(ctx.env, ctx.fetch, [
      { event: "$exception", properties, ...(where && { where }) },
    ]);
  });
  if (now.getTime() - lastInsertAt < MIN_INSERT_GAP_MS) return;
  lastInsertAt = now.getTime();
  const message = `${entry.kind} ${name}`;
  const detail = appErrorDetail(entry.error, secretsOf(ctx.env));
  console.error("app.error", { route: entry.route, message, digest: entry.digest, detail });
  let opened: ReturnType<AppContext["openDb"]> | null = null;
  try {
    opened = ctx.openDb();
    await insertAppError(opened.db, {
      at: now,
      route: entry.route,
      digest: entry.digest,
      message,
      detail,
    });
    // At most one alert per hour while errors continue; the DB holds the last alert time, and the
    // claim decides which instance posts.
    if (await claimAppErrorAlert(opened.db, now, ALERT_GAP_MS)) {
      await createNotifier(ctx.env, ctx.fetch).admin(
        appErrorMessage(entry.route, alertReason(message, detail), entry.digest),
      );
    }
  } catch {
    // The database is the likely cause; the console line above is the record.
  } finally {
    await opened?.close();
  }
}

/** "render TypeError — Cannot read properties of undefined (reading 'x')": the message's first line. */
function alertReason(message: string, detail: AppErrorDetail): string {
  const first = detail.message.split("\n")[0]?.trim().slice(0, ALERT_REASON_CHARS);
  return first ? `${message} — ${first}` : message;
}
