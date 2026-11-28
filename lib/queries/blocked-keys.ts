// Roster fields stored in raw_json but never served by any public read model, route, page, log or message
// (plan §12.1). x and y wait for the owner (D76 amendment 2026-11-28).

export const BLOCKED_ROSTER_KEYS = [
  "x",
  "y",
  "online",
  "last_online_at",
  "last_seen_at",
  "joined_at",
  "avatar_url",
] as const;

export type BlockedRosterKey = (typeof BLOCKED_ROSTER_KEYS)[number];

/** Per member, public on the alliance page's member list since the owner's 2026-11-28 decision (D76
 * amendment); still never in logs, run_logs, Discord, AI requests or exports, so the redactor keeps them. */
export const ACTIVITY_KEYS = ["daily_honor", "daily_tech", "active"] as const;

/** Every roster key kept out of logs, run_logs, Discord messages, AI requests and exports. */
export const UNLOGGED_ROSTER_KEYS = [...BLOCKED_ROSTER_KEYS, ...ACTIVITY_KEYS] as const;

/** avatar_url's photos live on this host (D22); lib/redact.ts removes any URL on it from error text. */
export const PHOTO_HOST = "phs-image.globallap.com";

const blocked = new Set<string>(BLOCKED_ROSTER_KEYS);
const unlogged = new Set<string>(UNLOGGED_ROSTER_KEYS);

function walk(value: unknown, keys: ReadonlySet<string>, path: string): string[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => walk(item, keys, `${path}${i}.`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(keys.has(key) ? [`${path}${key}`] : []),
    ...walk(child, keys, `${path}${key}.`),
  ]);
}

/**
 * Every path at which a private roster key appears in `value`, e.g. `members.0.last_online_at`. Empty =
 * clean. The activity keys count too, unless `allowActivity`: only the public alliance page's read model
 * (lib/queries/alliance-page.ts) may carry them (D76 amendment 2026-11-28).
 */
export function findBlockedKeys(value: unknown, { allowActivity = false } = {}): string[] {
  return walk(value, allowActivity ? blocked : unlogged, "");
}
