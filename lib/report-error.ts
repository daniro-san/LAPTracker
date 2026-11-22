// An error as it leaves our code (D61, D115's 2026-11-21 amendment): its detail after redact() (secrets and,
// through redactPrivate, private roster values), and PostHog's `$exception`. Apart from lib/app-errors.ts,
// which adds the app_errors row and the admin alert, so lib/push.ts (and through it lib/private) can report a
// caught error without reaching lib/notify (D71). Imports only lib/analytics, lib/app-context and lib/redact.
import { analyticsKey } from "./analytics/events";
import { areaOf, scrubMessage } from "./analytics/sanitise";
import { captureServer, sendLater, type EventWorkspace } from "./analytics/server";
import { secretsOf, type AppContext } from "./app-context";
import { redact } from "./redact";

const MESSAGE_CHARS = 500;
/** How much of a message is redacted before it is cut to MESSAGE_CHARS; bounds the redactor's work. */
const REDACT_CHARS = 4 * MESSAGE_CHARS;
const STACK_LINES = 12;
/** A V8 frame: `at fn (file:line:col)`, `at file:line:col`, `at fn (native)`, `at fn (<anonymous>)`. */
const FRAME_LINE = /^at (?:async )?(?:[^()]+ \()?(?:[^()]+:\d+:\d+|native|<anonymous>)\)?$/;

export interface AppErrorDetail {
  name: string;
  message: string;
  stack?: string;
  cause?: string;
}

const line = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/**
 * The stack's first frames. The message opens the stack, and a failed query's message holds its parameters,
 * which may be an officer's lines ("at 8pm in the hall"): only what follows the message is read, and only
 * lines in a frame's shape are kept.
 */
function framesOf(e: Error): string | undefined {
  const stack = e.stack ?? "";
  const at = e.message ? stack.indexOf(e.message) : -1;
  return (at >= 0 ? stack.slice(at + e.message.length) : stack)
    .split("\n")
    .map((frame) => frame.trim())
    .filter((frame) => FRAME_LINE.test(frame))
    .slice(0, STACK_LINES)
    .join("\n");
}

/** The error as thrown (D61): name, message, the stack's first frames and the cause, redacted. */
export function appErrorDetail(error: unknown, secrets: readonly string[]): AppErrorDetail {
  const e = error instanceof Error ? error : null;
  const stack = e && framesOf(e);
  // Redacted before the cut: a value, a Zod issue or a `Key (…)=(…)` line cut in half would not be recognised.
  // INVARIANT app-errors.private-redacted: redact() passes every string through redactPrivate.
  const detail = redact(
    {
      name: e?.name ?? "unknown",
      message: (e?.message ?? String(error)).slice(0, REDACT_CHARS),
      ...(stack && { stack }),
      ...(e?.cause !== undefined && { cause: line(e.cause).slice(0, REDACT_CHARS) }),
    },
    secrets,
  ) as AppErrorDetail;
  return {
    ...detail,
    message: detail.message.slice(0, MESSAGE_CHARS),
    ...(detail.cause !== undefined && { cause: detail.cause.slice(0, MESSAGE_CHARS) }),
  };
}

/** The desk's or /admin's section a route pattern is in ("/(private)/w/[slug]/thefts/page" → thefts). */
function sectionOfRoute(route: string): string | undefined {
  const path = route
    .replace(/\/\([^/)]*\)/g, "")
    .replace(/^\/api(?=\/)/, "")
    .replace(/\/(?:page|route|layout)$/, "");
  return areaOf(path).section;
}

/**
 * PostHog's error tracking: the error's class, its message (after redact(), redactPrivate and scrubMessage)
 * and its redacted frames, `kind`, the route pattern and its section, and under a workspace its slug and tag
 * (issue 452), only for a slug a workspace has. No request body, query string or user text: only the error's
 * own. Sent after the response, so the error path never waits for it.
 */
export function sendException(
  ctx: Pick<AppContext, "env" | "fetch">,
  entry: { route: string; kind: string; handled: boolean },
  detail: AppErrorDetail,
  workspace?: () => Promise<EventWorkspace | null>,
): void {
  const section = sectionOfRoute(entry.route);
  const properties = {
    name: detail.name,
    kind: entry.kind,
    route: entry.route,
    message: scrubMessage(detail.message),
    ...(detail.stack && { stack: detail.stack }),
    handled: entry.handled,
    ...(section && { section }),
  };
  sendLater(async () => {
    const where = workspace && analyticsKey(ctx.env) ? await workspace() : null;
    await captureServer(ctx.env, ctx.fetch, [
      { event: "$exception", properties, ...(where && { where }) },
    ]);
  });
}

/**
 * An error our code caught and carried on from (a daily job, a run's crash, a notification's read, a push):
 * PostHog only, `handled: true`, no app_errors row and no alert, no await. `kind` is the code its log line
 * has. Never for an error that is thrown on, which reaches recordAppError through withContext or
 * onRequestError.
 */
export function reportError(
  ctx: Pick<AppContext, "env" | "fetch">,
  entry: { route: string; kind: string; error: unknown },
): void {
  sendException(ctx, { ...entry, handled: true }, appErrorDetail(entry.error, secretsOf(ctx.env)));
}
