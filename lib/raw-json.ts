// What raw_json keeps of an upstream alliance response (plan §6). Split from lib/collector.ts for its size.

/** §6: raw_json keeps the response minus bulk. badge_url and avatar_url stay (docs/decisions/D22). The
 * alliance's own statement (`declaration`, `bulletin`) stays since D128: its public page shows it. */
export function trimRaw(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const { server_badge_url, quota, ...rest } = raw as Record<string, unknown>;
  void [server_badge_url, quota];
  if (!Array.isArray(rest.members)) return rest;
  const members: unknown[] = rest.members;
  return {
    ...rest,
    members: members.map((m) => {
      if (typeof m !== "object" || m === null) return m;
      const { frame_url, ...member } = m as Record<string, unknown>;
      void frame_url;
      return member;
    }),
  };
}
