// /admin/errors and the admin nav's count (issue 585, F34): app_errors grouped by digest with the workspace
// addresses they happened under, one workspace's only, and the count of the last 24 h. Owner only (PIN).
// `detail` was redacted before it was stored (D115); no roster field, no name.
import { count, desc, eq, gte } from "drizzle-orm";

import type { Db } from "../db";
import { WORKSPACE_SLUG } from "../repo/workspaces";
import type { AppErrorDetail } from "../report-error";
import { appErrors } from "../schema";

/** `?w=` as a workspace address, or undefined for anything else (an array, an invalid string): every error. */
export function errorsSlug(w: string | string[] | undefined): string | undefined {
  return typeof w === "string" && WORKSPACE_SLUG.test(w) ? w : undefined;
}

export interface ErrorGroup {
  key: string;
  digest: string | null;
  route: string;
  message: string;
  /** The newest row's detail (D61); null for rows recorded before it existed. */
  detail: AppErrorDetail | null;
  count: number;
  firstAt: Date;
  lastAt: Date;
  /** The workspace addresses its rows were recorded under (D144), newest first; empty when none. */
  workspaces: string[];
}

/** app_errors rows since `since`: the nav's App errors count and "Needs you" (issue 585), from `app_errors_at_idx`. */
export async function countErrorsSince(db: Db, since: Date): Promise<number> {
  const [row] = await db.select({ n: count() }).from(appErrors).where(gte(appErrors.at, since));
  return row?.n ?? 0;
}

/** app_errors grouped by Next's digest (route + message when it has none), newest first; with `slug`, only
 * the rows recorded under that workspace's address (F34: /admin/errors?w=<slug>). */
export async function listErrorGroups(db: Db, slug?: string): Promise<ErrorGroup[]> {
  const rows = await db
    .select()
    .from(appErrors)
    .where(slug === undefined ? undefined : eq(appErrors.workspaceSlug, slug))
    .orderBy(desc(appErrors.at));
  const groups = new Map<string, ErrorGroup>();
  for (const r of rows) {
    const key = r.digest ?? `${r.route}\n${r.message}`;
    const group = groups.get(key);
    const at = r.workspaceSlug ? [r.workspaceSlug] : [];
    if (!group) {
      const detail = r.detail as AppErrorDetail | null;
      groups.set(key, { key, ...r, detail, count: 1, firstAt: r.at, lastAt: r.at, workspaces: at });
      continue;
    }
    group.count += 1;
    group.firstAt = r.at;
    group.workspaces = [...new Set([...group.workspaces, ...at])];
  }
  return [...groups.values()];
}
