// app_errors (plan §6, Phase 6 "Observability"): errors outside a run, from instrumentation.ts's
// onRequestError and from route handlers that caught one. `message` is our own words (kind and error
// name, plan §12.3) and groups the rows; `detail` (D61) keeps the error's own message, stack start and
// cause, redacted, for /admin/errors only. The admin alert adds the message's first line.
import { secretsOf, type AppContext } from "./app-context";
import { appErrorMessage, createNotifier } from "./notify";
import { redact } from "./redact";
import { claimAppErrorAlert, insertAppError } from "./repo/app-errors";

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
}

export async function recordAppError(ctx: AppContext, entry: AppErrorEntry): Promise<void> {
  const now = ctx.now();
  if (now.getTime() - lastInsertAt < MIN_INSERT_GAP_MS) return;
  lastInsertAt = now.getTime();
  const message = `${entry.kind} ${entry.error instanceof Error ? entry.error.name : "unknown"}`;
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
