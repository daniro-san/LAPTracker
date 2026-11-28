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

/** Every path at which a blocked key appears in `value`, e.g. `members.0.last_online_at`. Empty = clean. */
export function findBlockedKeys(value: unknown, path = ""): string[] {
  if (Array.isArray(value))
    return value.flatMap((item, i) => findBlockedKeys(item, `${path}${i}.`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(blocked.has(key) ? [`${path}${key}`] : []),
    ...findBlockedKeys(child, `${path}${key}.`),
  ]);
}
