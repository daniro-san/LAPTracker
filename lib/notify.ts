// Discord notifications (plan Phase 6 "Notifications"): a public channel in the public pages' words
// and a private admin channel in /admin's. Both are optional and skip silently when unset. Callers
// send only after the snapshot row is final. Messages carry alliance tags and names, counts and links:
// never member names, never secrets (plan §12.3). Text lives in lib/copy-discord.ts.
import type { RunSummary } from "./collector";
import { topMovers } from "./compute";
import { copy, fill } from "./copy";
import type { DailyReadSummary } from "./daily-read";
import { MINUS, percentFormat, sign, signedCompact, type DiscordClock } from "./discord-format";
import { sendOrEdit as send } from "./discord-send";
import type { Env } from "./env";
import type { Verdict } from "./rehearsal";
import type { Phase } from "./repo";

export { discordClock, type DiscordClock } from "./discord-format";

/** The public message's parts: the status chip as the title, the lines under it, the event page. */
export interface PublicMessage {
  title: string;
  url: string;
  description?: string;
}

/** The event picture's file name in the message (D58). */
export const EVENT_IMAGE_FILE = "event.png";

/**
 * `messageId`: the id of this event's message in the channel (D31). With one the message is edited
 * in place; without one, or when Discord no longer has it, a new message is posted. The result is
 * the id to store, or null when Discord returned none (the next phase then posts again).
 */
export interface Notifier {
  /** `image`: the event's picture (D58), attached under the text; null sends the text alone. */
  public(
    message: PublicMessage,
    messageId?: string | null,
    image?: Uint8Array<ArrayBuffer> | null,
  ): Promise<string | null>;
  /** `test`: an is_test event (plan Phase 6): the line starts with `[rehearsal]`; `manual`: `[manual]`. */
  admin(
    content: string,
    options?: { test?: boolean; manual?: boolean; messageId?: string | null },
  ): Promise<string | null>;
}

type NotifyEnv = Pick<
  Env,
  "NOTIFY_WEBHOOK_PUBLIC" | "NOTIFY_WEBHOOK_ADMIN" | "NOTIFY_ADMIN_MENTION"
>;

const DISCORD_MAX_CONTENT = 2000;

// No `username`: Discord shows the name and avatar the owner gave each webhook (owner, 2026-11-05).
export function createNotifier(env: NotifyEnv, fetchFn: typeof fetch): Notifier {
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
    // Plain text and the picture, no embed and so no frame around it (owner, 2026-11-09, D58). The
    // empty lists clear what an earlier phase left: an old embed, or a picture this phase could not redraw.
    public: (message, messageId, image) =>
      send(
        fetchFn,
        env.NOTIFY_WEBHOOK_PUBLIC,
        {
          content: publicText(message).slice(0, DISCORD_MAX_CONTENT),
          embeds: [],
          attachments: image
            ? [{ id: 0, filename: EVENT_IMAGE_FILE, description: copy.discord.image.alt }]
            : [],
          allowed_mentions: { parse: [] },
        },
        messageId,
        image ? { name: EVENT_IMAGE_FILE, data: image } : undefined,
      ),
    admin: (content, options) =>
      send(
        fetchFn,
        env.NOTIFY_WEBHOOK_ADMIN,
        {
          content:
            `${prefix}${options?.test ? `${copy.discord.admin.test} ` : options?.manual ? `${copy.discord.admin.manual} ` : ""}${content}`.slice(
              0,
              DISCORD_MAX_CONTENT,
            ),
          allowed_mentions: adminMentions,
        },
        options?.messageId,
      ),
  };
}

/**
 * Text people type (a round's name; an alliance's tag and name, typed in game) shows literally:
 * Discord markdown is backslash-escaped and mentions get a zero-width space after the `@`.
 */
const escapeDiscord = (text: string) =>
  text
    .replace(/[\\*_~`|>[\]]/g, "\\$&")
    .replace(/@(everyone|here)/g, "@\u200b$1")
    .replace(/<@/g, "<@\u200b");

/** `[NSE] Natural Selection`; the union id when the row has neither. */
const allianceLabel = (a: { unionId: number; tag: string | null; name?: string | null }) =>
  [a.tag !== null ? `[${escapeDiscord(a.tag)}]` : null, a.name && escapeDiscord(a.name)]
    .filter(Boolean)
    .join(" ") || String(a.unionId);

type State = RunSummary["status"];
/** Run states in the admin message, the same words as /admin. */
const STATE_WORD: Record<State, string> = {
  complete: copy.status.done,
  partial: copy.status.partial,
  failed: copy.status.failed,
};
const STATE_ICON: Record<State, string> = { complete: "✓", partial: "⚠", failed: "✗" };

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
  /**
   * This snapshot's rows, and the before snapshot's when this is the after one. Null when the event
   * detail could not be read: the count, stale and movers lines are then left out, not zeros.
   */
  alliances: PublicAlliance[] | null;
  before: PublicAlliance[] | null;
  /** A manual round's name: the message says it is a manual round (D28). Null for a scheduled event. */
  roundName?: string | null;
  /** When the before snapshot finished, on the after message: it shows the whole event (D31). */
  beforeAt?: Date | null;
  /** The event picture goes with the text (D58): it shows the top gains, so the text leaves them out. */
  image?: boolean;
}

const MOVERS = 3;
export const usable = (a: PublicAlliance) => a.isFresh && !a.failed;

/**
 * The top gains of one metric, ranked by compute.topMovers (D53): an alliance with a stale, failed or
 * missing side is out. The message's lines and the event picture both read this one ranking.
 */
export function topGains<A extends PublicAlliance>(
  alliances: readonly A[],
  before: readonly PublicAlliance[],
  metric: "power" | "kills",
) {
  const was = new Map(before.map((a) => [a.unionId, a]));
  const side = (a: PublicAlliance) => ({ ...a, isFresh: usable(a) });
  const rows = alliances.map((a) => {
    const b = was.get(a.unionId);
    return { a, before: b ? side(b) : null, after: side(a) };
  });
  return topMovers(rows, metric, MOVERS, "gain");
}

/** The top gains of one metric: `[OGs] OldGrandmas ▲ +85.8M (+2.0%)`. */
function movers(ctx: PublicContext, metric: "power" | "kills"): string[] {
  return topGains(ctx.alliances ?? [], ctx.before ?? [], metric).map(({ row, delta, base }) => {
    const pct = base ? ` (${sign(delta)}${percentFormat.format(delta / base)})` : "";
    return `${allianceLabel(row.a)} ▲ ${signedCompact(delta)}${pct}`;
  });
}

/** A heading and its top gains, or nothing when no alliance gained. */
function moverBlock(ctx: PublicContext, heading: string, metric: "power" | "kills"): string[] {
  const top = movers(ctx, metric);
  return top.length > 0 ? [heading, ...top] : [];
}

/** The public message: the status chip as the title, counts, the next update or the top gains. */
export function publicSnapshotMessage(summary: RunSummary, ctx: PublicContext): PublicMessage {
  const t = copy.discord.public;
  // The page's status chip (app/_ui/Status.tsx): the icon says partial; the stale line names who.
  const chip = summary.status === "failed" ? copy.status.lastFailed : copy.status.lastUpdated;
  const title = `${STATE_ICON[summary.status]} ${fill(chip, { time: ctx.clock.at(ctx.finishedAt) })}`;
  const lines: string[] = ctx.roundName
    ? [fill(t.manual, { name: escapeDiscord(ctx.roundName) })]
    : [];
  if (ctx.beforeAt) lines.push(fill(t.beforeDone, { time: ctx.clock.at(ctx.beforeAt) }));
  if (summary.status !== "failed" && ctx.alliances) {
    const bad = ctx.alliances.filter((a) => !usable(a));
    lines.push(
      fill(t.alliances, { good: ctx.alliances.length - bad.length, total: ctx.alliances.length }),
    );
    if (bad.length > 0) {
      lines.push(fill(t.stale, { n: bad.length, list: bad.map(allianceLabel).join(", ") }));
    }
    if (ctx.before && !ctx.image)
      lines.push(...moverBlock(ctx, t.might, "power"), ...moverBlock(ctx, t.kills, "kills"));
  }
  if (ctx.nextAt) lines.push(fill(copy.status.next, { time: ctx.clock.at(ctx.nextAt) }));
  return {
    title,
    url: ctx.eventUrl,
    ...(lines.length > 0 ? { description: lines.join("\n") } : {}),
  };
}

/** The public message as Discord text: the bold title, its lines, then the event page's link. */
const publicText = (m: PublicMessage) =>
  [
    fill(copy.discord.public.title, { title: m.title }),
    m.description,
    fill(copy.discord.public.eventLink, { url: m.url }),
  ]
    .filter(Boolean)
    .join("\n");

export interface AdminContext {
  clock: DiscordClock;
  phase: Phase;
  runUrl: string;
  scheduledAt: Date;
  startedAt: Date;
  finishedAt: Date;
  logWriteFailures: number;
  /** A manual round's name: it has no schedule, so the "due" line is left out (D28). */
  roundName?: string | null;
}

export function adminSnapshotMessage(summary: RunSummary, ctx: AdminContext): string {
  const t = copy.discord.admin;
  const lagMin = Math.round((ctx.startedAt.getTime() - ctx.scheduledAt.getTime()) / 60_000);
  const manual = ctx.roundName != null;
  const lines = [
    fill(manual ? t.manualRun : t.run, {
      icon: STATE_ICON[summary.status],
      name: escapeDiscord(ctx.roundName ?? ""),
      phase: copy.admin.phase[ctx.phase],
      state: STATE_WORD[summary.status],
      at: ctx.clock.stamp(ctx.finishedAt),
    }),
    ...(manual
      ? []
      : [
          fill(t.due, {
            at: ctx.clock.stamp(ctx.scheduledAt),
            lag: lagMin < 0 ? `${MINUS}${-lagMin} min` : fill(t.lag, { n: lagMin }),
          }),
        ]),
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

/** The event's one admin message (D31): its name, then a block per phase run so far, then the verdict. */
export function adminEventMessage(name: string, blocks: string[]): string {
  return [fill(copy.discord.admin.eventHeader, { name: escapeDiscord(name) }), ...blocks].join(
    "\n\n",
  );
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

/** The tick-silence alert (D45): minutes since the last tick and its time, or none recorded. */
export function tickSilenceMessage(last: { min: number; at: string } | null): string {
  const t = copy.discord.admin;
  return last ? fill(t.tickSilence, last) : t.tickNone;
}

/** The daily roster read fell short (D60): its state and calls, the error and each failed alliance. */
export function dailyReadMessage(s: DailyReadSummary, at: string): string {
  const t = copy.discord.admin;
  const lines = [
    fill(t.dailyRead, {
      icon: STATE_ICON[s.status],
      day: s.day,
      state: STATE_WORD[s.status],
      calls: s.callsUsed,
      at,
    }),
  ];
  if (s.error) lines.push(fill(t.error, { error: s.error }));
  for (const f of s.failed)
    lines.push(fill(t.failed, { alliance: allianceLabel(f), error: f.error }));
  if (s.stale.length > 0)
    lines.push(fill(t.stale, { list: s.stale.map(allianceLabel).join(", ") }));
  return lines.join("\n");
}
