// The Friday check's admin message (plan Phase 6 "Notifications"), split from lib/notify.ts for size.
// Counts and links only: never member names, never secrets (plan §12.3).
import { copy } from "./copy";
import { fill } from "./words";

export interface QuotaReport {
  at: string;
  remaining: number | null;
  warnBelow: number;
  databaseMb: number;
  warnAboveMb: number;
  beforeAt: string;
  afterAt: string;
  /** The site's own alliance's might lists (D70): counts only, never names. Omitted while not ready. */
  might?: { days: number; unchanged: number; pct: number; lost: number } | undefined;
}

/** The Friday check: requests left, database size, the coming snapshots. */
export function quotaReportMessage(r: QuotaReport): string {
  const t = copy.discord.admin;
  const low = r.remaining === null || r.remaining < r.warnBelow;
  const high = r.databaseMb > r.warnAboveMb;
  return [
    fill(t.quotaCheck, { at: r.at }),
    r.remaining === null
      ? t.quotaUnavailable
      : fill(t.quotaLeft, { icon: low ? "⚠" : "✓", n: r.remaining }) +
        (low ? fill(t.quotaLow, { n: r.warnBelow }) : ""),
    fill(t.database, { icon: high ? "⚠" : "✓", mb: r.databaseMb.toFixed(1) }) +
      (high ? fill(t.databaseHigh, { n: r.warnAboveMb }) : ""),
    ...(r.might
      ? [
          fill(t.mightLine, {
            days: r.might.days,
            unchanged: r.might.unchanged,
            pct: r.might.pct,
            lost: r.might.lost,
          }),
        ]
      : []),
    `${copy.admin.phase.before} ${r.beforeAt}`,
    `${copy.admin.phase.after} ${r.afterAt}`,
  ].join("\n");
}
