// app_errors (plan §6, Phase 6 "Observability"): errors outside a run, from instrumentation.ts's
// onRequestError and from route handlers that caught one. `message` is our own words (kind and error
// name, plan §12.3) and groups the rows; `detail` (D61) keeps the error's own message, stack start and
// cause, for /admin/errors only, after redact(): secrets and, through redactPrivate, private roster values
// (D115's 2026-11-21 amendment). The admin alert adds the message's first line. Rows go after 30 days.
import { analyticsKey } from "./analytics/events";
import { areaOf, scrubMessage } from "./analytics/sanitise";
import { captureServer, eventWorkspace, sendLater, type EventWorkspace } from "./analytics/server";
import { secretsOf, type AppContext } from "./app-context";
import { appErrorMessage, createNotifier } from "./notify";
import { redact } from "./redact";
import { allianceLabelOf } from "./repo/alliances";
import { claimAppErrorAlert, insertAppError } from "./repo/app-errors";
import { findWorkspaceBySlug, WORKSPACE_SLUG } from "./repo/workspaces";

const MESSAGE_CHARS = 500;
/** How much of a message is redacted before it is cut to MESSAGE_CHARS; bounds the redactor's work. */
const REDACT_CHARS = 4 * MESSAGE_CHARS;
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
  // Redacted before the cut: a value, a Zod issue or a `Key (…)=(…)` line cut in half would not be recognised.
  const detail = redact(
    {
      name: e?.name ?? "unknown",
      message: (e?.message ?? String(error)).slice(0, REDACT_CHARS),
      ...(stack && { stack }),
      ...(e?.cause !== undefined && { cause: line(e.cause).slice(0, REDACT_CHARS) }),
    },
    secrets,
  ) as AppErrorDetail; // INVARIANT app-errors.private-redacted: redact() passes every string through redactPrivate.
  return {
    ...detail,
    message: detail.message.slice(0, MESSAGE_CHARS),
    ...(detail.cause !== undefined && { cause: detail.cause.slice(0, MESSAGE_CHARS) }),
  };
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
  /** Under /w/[slug] or /api/w/[slug]: the slug from the request, for PostHog (issue 452) and the row's
   * `workspace_slug` (D144). */
  slug?: string;
  /** True when our code caught it and answered (withContext's 500 code); false (the default) for Next's
   * onRequestError. PostHog's `mechanism.handled`. */
  handled?: boolean;
}

/** The workspace a slug names, for analytics; null when none does or the database does not answer. */
async function workspaceOf(ctx: AppContext, slug: string): Promise<EventWorkspace | null> {
  let opened: ReturnType<AppContext["openDb"]> | null = null;
  try {
    opened = ctx.openDb();
    const workspace = await findWorkspaceBySlug(opened.db, slug);
    if (!workspace) return null;
    const alliance = await allianceLabelOf(opened.db, workspace.unionId);
    return eventWorkspace({ slug: workspace.slug, alliance });
  } catch {
    return null;
  } finally {
    await opened?.close();
  }
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
 * PostHog's error tracking (D115's 2026-11-21 amendment): the error's class, its message (after redact(),
 * redactPrivate and scrubMessage) and its redacted frames, `kind`, the route pattern and its section, and
 * under a workspace its slug and tag (issue 452), only for a slug a workspace has. No request body, query
 * string or user text: only the error's own. Sent after the response, so the error path never waits for it.
 */
function sendException(
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
 * An error our code caught and carried on from (a daily job, a run's crash, a notification's read): PostHog
 * only, `handled: true`, no app_errors row and no alert, no await. `kind` is the code its log line has.
 * Never for an error that is thrown on, which reaches recordAppError through withContext or onRequestError.
 */
export function reportError(
  ctx: Pick<AppContext, "env" | "fetch">,
  entry: { route: string; kind: string; error: unknown },
): void {
  sendException(ctx, { ...entry, handled: true }, appErrorDetail(entry.error, secretsOf(ctx.env)));
}

export async function recordAppError(ctx: AppContext, entry: AppErrorEntry): Promise<void> {
  const now = ctx.now();
  const name = entry.error instanceof Error ? entry.error.name : "unknown";
  const slug = entry.slug;
  const detail = appErrorDetail(entry.error, secretsOf(ctx.env));
  // Every error goes to PostHog, before the per-second gate below, which only spares the database.
  sendException(
    ctx,
    { route: entry.route, kind: entry.kind, handled: entry.handled ?? false },
    detail,
    slug ? () => workspaceOf(ctx, slug) : undefined,
  );
  if (now.getTime() - lastInsertAt < MIN_INSERT_GAP_MS) return;
  lastInsertAt = now.getTime();
  const message = `${entry.kind} ${name}`;
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
      // D144: the slug as the request named it, only in a slug's shape (it comes from the path).
      workspaceSlug: slug && WORKSPACE_SLUG.test(slug) ? slug : null,
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
