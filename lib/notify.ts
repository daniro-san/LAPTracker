// Discord notifications (plan Phase 6 "Notifications"): a public channel in plain language and a
// private admin channel with the technical detail. Both are optional and skip silently when unset.
// Callers send only after the snapshot row is final. Messages carry tags, counts and links: never
// member names, never secrets (plan §12.3).
import type { RunSummary } from "./collector";
import type { Env } from "./env";

export interface Notifier {
  public(content: string): Promise<void>;
  admin(content: string): Promise<void>;
}

type NotifyEnv = Pick<
  Env,
  "NOTIFY_WEBHOOK_PUBLIC" | "NOTIFY_WEBHOOK_ADMIN" | "NOTIFY_ADMIN_MENTION"
>;

const DISCORD_MAX_CONTENT = 2000;
const SEND_TIMEOUT_MS = 5_000;

export function createNotifier(env: NotifyEnv, fetchFn: typeof fetch): Notifier {
  async function send(url: string | undefined, content: string, mentions: object) {
    if (!url) return;
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: content.slice(0, DISCORD_MAX_CONTENT),
          username: "LAPTracker",
          allowed_mentions: mentions,
        }),
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
    public: (content) => send(env.NOTIFY_WEBHOOK_PUBLIC, content, { parse: [] }),
    admin: (content) => send(env.NOTIFY_WEBHOOK_ADMIN, prefix + content, adminMentions),
  };
}

export interface SnapshotContext {
  /** "Saturday" for EVENT_WEEKDAY 6. */
  weekdayName: string;
  allianceCount: number;
  tableUrl: string;
  runUrl: string;
  eventId: number;
  logWriteFailures: number;
}

const label = (a: { unionId: number; tag: string | null }) => a.tag ?? String(a.unionId);

/** The three plan Phase 6 templates, word for word except the counts. */
export function publicSnapshotMessage(summary: RunSummary, ctx: SnapshotContext): string {
  const when = `${summary.phase} the event`;
  if (summary.status === "failed") {
    return `❌ The ${ctx.weekdayName} ledger could not be updated (${when}). An admin has been notified.`;
  }
  if (summary.status === "complete") {
    return `✅ ${ctx.weekdayName} ledger updated (${when}). All ${ctx.allianceCount} alliances refreshed and recorded. See the table: ${ctx.tableUrl}`;
  }
  const affected = [...summary.stale, ...summary.failed].map(label);
  const count = affected.length === 1 ? "1 alliance" : `${affected.length} alliances`;
  return `⚠️ ${ctx.weekdayName} ledger updated (${when}), but ${count} came back with old data (${affected.join(", ")}). No change is shown for them. ${ctx.tableUrl}`;
}

const STATUS_ICON = { complete: "✅", partial: "⚠️", failed: "❌" } as const;

export function adminSnapshotMessage(summary: RunSummary, ctx: SnapshotContext): string {
  const lines = [
    `${STATUS_ICON[summary.status]} ${summary.phase} snapshot ${summary.status} (event ${ctx.eventId}, snapshot ${summary.snapshotId})`,
    `calls used ${summary.callsUsed} · quota remaining ${summary.quotaRemainingAfter ?? "unknown"} · ${(summary.durationMs / 1000).toFixed(1)} s`,
  ];
  if (summary.error) lines.push(`error: ${summary.error}`);
  for (const f of summary.failed) lines.push(`failed ${label(f)}: ${f.error}`);
  if (summary.stale.length > 0) lines.push(`stale: ${summary.stale.map(label).join(", ")}`);
  if (ctx.logWriteFailures > 0) lines.push(`run_logs write failures: ${ctx.logWriteFailures}`);
  lines.push(ctx.runUrl);
  return lines.join("\n");
}
