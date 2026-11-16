// The admin channel's stand-alone alerts: the rehearsal verdict and skip, the Friday check, the PIN lock,
// an app error and the tick-silence alert. Split from lib/notify.ts for size; lib/notify.ts re-exports
// them, so callers import from there. Text lives in lib/copy-discord.ts.
import { copy, fill } from "./copy";
import type { Verdict } from "./rehearsal";

/** Plan §3.1: the verdict (the `[rehearsal]` prefix is the notifier's), one ✓/✗ line per check. */
export function rehearsalVerdictMessage(verdict: Verdict, at: string, runsUrl: string): string {
  const t = copy.discord.admin;
  const r = copy.admin.rehearsal;
  return [
    fill(t.verdict, { icon: verdict.pass ? r.pass : r.fail, at }),
    ...verdict.lines.map((l) => `${l.ok ? "✓" : "✗"} ${l.text}`),
    fill(t.runsLink, { url: runsUrl }),
  ].join("\n");
}

/** A scheduled rehearsal that may not run; the reason in /admin's words. */
export function rehearsalSkippedMessage(
  reason: "event-day" | "before-real" | "real-running" | "pending",
  at: string,
): string {
  const words = copy.admin.run.refusals[`rehearsal_${reason.replace("-", "_")}`] ?? reason;
  return fill(copy.discord.admin.skipped, { at, reason: words });
}

export interface QuotaReport {
  at: string;
  remaining: number | null;
  warnBelow: number;
  databaseMb: number;
  warnAboveMb: number;
  beforeAt: string;
  afterAt: string;
  /** The site's own alliance's might lists (D70): counts and the page's link, never names. Omitted while not ready. */
  might?: { days: number; unchanged: number; pct: number; lost: number; url: string } | undefined;
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
            url: r.might.url,
          }),
        ]
      : []),
    `${copy.admin.phase.before} ${r.beforeAt}`,
    `${copy.admin.phase.after} ${r.afterAt}`,
  ].join("\n");
}

export const pinLockedMessage = (n: number): string => fill(copy.discord.admin.pinLocked, { n });

export function appErrorMessage(route: string, message: string, digest: string | null): string {
  const t = copy.discord.admin;
  return fill(t.appError, {
    route,
    message,
    digest: digest ? fill(t.digest, { digest }) : "",
  });
}

/** The tick-silence alert (D45): minutes since the last tick and its time, or none recorded. */
export function tickSilenceMessage(last: { min: number; at: string } | null): string {
  const t = copy.discord.admin;
  return last ? fill(t.tickSilence, last) : t.tickNone;
}
