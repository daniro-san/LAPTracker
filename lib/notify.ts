// Discord notifications (plan Phase 6 "Notifications"): a public channel in the public pages' words
// and a private admin channel in /admin's. Both are optional and skip silently when unset. Callers
// send only after the snapshot row is final. Messages carry alliance tags and names, counts and links:
// never member names, never secrets (plan §12.3). Text lives in lib/copy-discord.ts.
import type { RunSummary } from "./collector";
import { delta as computeDelta } from "./compute";
import { copy, fill } from "./copy";
import type { Env } from "./env";
import type { Verdict } from "./rehearsal";
import type { Phase } from "./repo";

/** A Discord embed: the colour bar is the state's third channel, beside the icon and the word. */
export interface Embed {
  title: string;
  url: string;
  description?: string;
  color: number;
}

export interface Notifier {
  public(embed: Embed): Promise<void>;
  /** `test`: an is_test event (plan Phase 6): the line starts with `[rehearsal]`. */
  admin(content: string, options?: { test: boolean }): Promise<void>;
}

type NotifyEnv = Pick<
  Env,
  "NOTIFY_WEBHOOK_PUBLIC" | "NOTIFY_WEBHOOK_ADMIN" | "NOTIFY_ADMIN_MENTION"
>;

const DISCORD_MAX_CONTENT = 2000;
const SEND_TIMEOUT_MS = 5_000;

// No `username`: Discord shows the name and avatar the owner gave each webhook (owner, 2026-11-05).
export function createNotifier(env: NotifyEnv, fetchFn: typeof fetch): Notifier {
  async function send(url: string | undefined, body: object) {
    if (!url) return;
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!res.ok) console.error("notify.failed", { http_status: res.status });
    } catch {
      // Never the error itself: a fetch error can carry the webhook URL, which is a secret.
      console.error("notify.failed", { http_status: null });
    }
  }

  const mention = env.NOTIFY_ADMIN_MENTION;
  const roleId = mention?.startsWith("role:") ? mention.slice("role:".length) : null;
  const userId = mention && !roleId ? mention : null;
  const prefix = roleId ? `<@&${roleId}> ` : userId ? `<@${userId}> ` : "";
  // Only the configured id can ever be pinged; @everyone and @here never resolve.
  const adminMentions = roleId
    ? { parse: [], roles: [roleId] }
    : userId
      ? { parse: [], users: [userId] }
      : { parse: [] };

  return {
    public: (embed) =>
      send(env.NOTIFY_WEBHOOK_PUBLIC, { embeds: [embed], allowed_mentions: { parse: [] } }),
    admin: (content, options) =>
      send(env.NOTIFY_WEBHOOK_ADMIN, {
        content: `${prefix}${options?.test ? `${copy.discord.admin.test} ` : ""}${content}`.slice(
          0,
          DISCORD_MAX_CONTENT,
        ),
        allowed_mentions: adminMentions,
      }),
  };
}

// Discord has no viewer locale, so messages use one fixed English format, in server time.
const MINUS = "−";
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? MINUS : "");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
});
const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `+85.8M`, `−2`: compact above 1,000, signed with a real minus. */
const signedCompact = (n: number) =>
  `${sign(n)}${Math.abs(n) < 1000 ? Math.abs(n) : compactFormat.format(Math.abs(n))}`;

export interface DiscordClock {
  /** "Sat, Nov 7, 14:01 server": the public pages' date, with the weekday. */
  at: (d: Date) => string;
  /** "Sat, 11/07/2026, 14:01 server": /admin's date. */
  stamp: (d: Date) => string;
}

export function discordClock(timeZone: string): DiscordClock {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone, ...o });
  const day = f({ weekday: "short", month: "short", day: "numeric" });
  const hhmm = f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const full = f({
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return {
    at: (d) => `${day.format(d)}, ${hhmm.format(d)} ${copy.time.server}`,
    stamp: (d) => `${full.format(d)} ${copy.time.server}`,
  };
}

/** `[NSE] Natural Selection`; the union id when the row has neither. */
const allianceLabel = (a: { unionId: number; tag: string | null; name?: string | null }) =>
  [a.tag !== null ? `[${a.tag}]` : null, a.name].filter(Boolean).join(" ") || String(a.unionId);

type State = RunSummary["status"];
/** Run states in the admin message, the same words as /admin. */
const STATE_WORD: Record<State, string> = {
  complete: copy.status.done,
  partial: copy.status.partial,
  failed: copy.status.failed,
};
const STATE_ICON: Record<State, string> = { complete: "✓", partial: "⚠", failed: "✗" };
/** DESIGN.md tokens: sage, yarn, seal. */
const STATE_COLOR: Record<State, number> = {
  complete: 0x586750,
  partial: 0x805c12,
  failed: 0x8c2f2f,
};

/** One alliance row of a snapshot, as lib/queries getEventDetail returns it. */
export interface PublicAlliance {
  unionId: number;
  tag: string | null;
  name: string | null;
  isFresh: boolean;
  failed: boolean;
  totalPower: number | null;
  totalKills: number | null;
}

export interface PublicContext {
  clock: DiscordClock;
  /** `/events/<id>`: the same event next week too, unlike `/`. */
  eventUrl: string;
  finishedAt: Date;
  /** The after snapshot's due time when this was the before snapshot; null otherwise. */
  nextAt: Date | null;
  /** This snapshot's rows, and the before snapshot's when this is the after one. */
  alliances: PublicAlliance[];
  before: PublicAlliance[] | null;
}

const MOVERS = 3;
const usable = (a: PublicAlliance) => a.isFresh && !a.failed;

/** The top gains of one metric: `[OGs] OldGrandmas ▲ +85.8M (+2.0%)`. Alliances with bad data are out. */
function movers(ctx: PublicContext, metric: "power" | "kills"): string[] {
  const before = new Map((ctx.before ?? []).map((a) => [a.unionId, a]));
  const gains = ctx.alliances.flatMap((a) => {
    const b = before.get(a.unionId);
    if (!b || !usable(a) || !usable(b)) return [];
    const d = computeDelta(b, a);
    const base = metric === "power" ? b.totalPower : b.totalKills;
    if (!d || d[metric] <= 0) return [];
    return [{ a, gain: d[metric], base }];
  });
  return gains
    .sort((x, y) => y.gain - x.gain)
    .slice(0, MOVERS)
    .map(({ a, gain, base }) => {
      const pct = base ? ` (${sign(gain)}${percentFormat.format(gain / base)})` : "";
      return `${allianceLabel(a)} ▲ ${signedCompact(gain)}${pct}`;
    });
}

/** A heading and its top gains, or nothing when no alliance gained. */
function moverBlock(ctx: PublicContext, heading: string, metric: "power" | "kills"): string[] {
  const top = movers(ctx, metric);
  return top.length > 0 ? [heading, ...top] : [];
}

/** The public message: the status chip as the title, counts, the next update or the top gains. */
export function publicSnapshotMessage(summary: RunSummary, ctx: PublicContext): Embed {
  const t = copy.discord.public;
  // The page's status chip (app/_ui/Status.tsx): the icon says partial; the stale line names who.
  const chip = summary.status === "failed" ? copy.status.lastFailed : copy.status.lastUpdated;
  const title = `${STATE_ICON[summary.status]} ${fill(chip, { time: ctx.clock.at(ctx.finishedAt) })}`;
  const lines: string[] = [];
  if (summary.status !== "failed") {
    const bad = ctx.alliances.filter((a) => !usable(a));
    lines.push(
      fill(t.alliances, { good: ctx.alliances.length - bad.length, total: ctx.alliances.length }),
    );
    if (bad.length > 0) {
      lines.push(fill(t.stale, { n: bad.length, list: bad.map(allianceLabel).join(", ") }));
    }
    if (ctx.before)
      lines.push(...moverBlock(ctx, t.might, "power"), ...moverBlock(ctx, t.kills, "kills"));
  }
  if (ctx.nextAt) lines.push(fill(copy.status.next, { time: ctx.clock.at(ctx.nextAt) }));
  return {
    title,
    url: ctx.eventUrl,
    ...(lines.length > 0 ? { description: lines.join("\n") } : {}),
    color: STATE_COLOR[summary.status],
  };
}

export interface AdminContext {
  clock: DiscordClock;
  phase: Phase;
  runUrl: string;
  scheduledAt: Date;
  startedAt: Date;
  finishedAt: Date;
  logWriteFailures: number;
}

export function adminSnapshotMessage(summary: RunSummary, ctx: AdminContext): string {
  const t = copy.discord.admin;
  const lagMin = Math.round((ctx.startedAt.getTime() - ctx.scheduledAt.getTime()) / 60_000);
  const lines = [
    fill(t.run, {
      icon: STATE_ICON[summary.status],
      phase: copy.admin.phase[ctx.phase],
      state: STATE_WORD[summary.status],
      at: ctx.clock.stamp(ctx.finishedAt),
    }),
    fill(t.due, {
      at: ctx.clock.stamp(ctx.scheduledAt),
      lag: lagMin < 0 ? `${MINUS}${-lagMin} min` : fill(t.lag, { n: lagMin }),
    }),
    fill(t.usage, {
      calls: summary.callsUsed,
      left: summary.quotaRemainingAfter ?? t.unknown,
      seconds: (summary.durationMs / 1000).toFixed(1),
    }),
  ];
  if (summary.error) lines.push(fill(t.error, { error: summary.error }));
  for (const f of summary.failed) {
    lines.push(fill(t.failed, { alliance: allianceLabel(f), error: f.error }));
  }
  if (summary.stale.length > 0) {
    lines.push(fill(t.stale, { list: summary.stale.map(allianceLabel).join(", ") }));
  }
  if (ctx.logWriteFailures > 0) lines.push(fill(t.logFailures, { n: ctx.logWriteFailures }));
  lines.push(fill(t.runLink, { id: summary.snapshotId, url: ctx.runUrl }));
  return lines.join("\n");
}

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
