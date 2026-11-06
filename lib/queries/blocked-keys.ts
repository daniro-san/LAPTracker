// Roster fields stored in raw_json but never served by any read model, route, page, log or message (plan §12.1).

export const BLOCKED_ROSTER_KEYS = [
  "x",
  "y",
  "online",
  "last_online_at",
  "joined_at",
  "daily_honor",
  "daily_tech",
  "avatar_url",
  "active",
] as const;

export type BlockedRosterKey = (typeof BLOCKED_ROSTER_KEYS)[number];

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
