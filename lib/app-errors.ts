// app_errors (plan §6, Phase 6 "Observability"): errors outside a run, from instrumentation.ts's
// onRequestError and from route handlers that caught one. `message` is our own words (kind and error
// name, plan §12.3) and groups the rows; `detail` (D61) keeps the error's own message, stack start and
// cause, for /admin/errors only, after redact(): secrets and, through redactPrivate, private roster values
// (D115's 2026-11-21 amendment). Rows go after 30 days. No Discord alert: PostHog's error tracking posts new and spiking issues (D115).
// The detail and PostHog's `$exception` are built in lib/report-error.ts.
import { eventWorkspace, type EventWorkspace } from "./analytics/server";
import { secretsOf, type AppContext } from "./app-context";
import { allianceLabelOf } from "./repo/alliances";
import { insertAppError } from "./repo/app-errors";
import { findWorkspaceBySlug, WORKSPACE_SLUG } from "./repo/workspaces";
import { appErrorDetail, sendException } from "./report-error";

const MIN_INSERT_GAP_MS = 1_000;

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
  } catch {
    // The database is the likely cause; the console line above is the record.
  } finally {
    await opened?.close();
  }
}
