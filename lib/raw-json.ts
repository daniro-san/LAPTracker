// What raw_json keeps of an upstream alliance response (plan §6). Split from lib/collector.ts for its size.

/** §6: raw_json keeps the response minus bulk and free text. */
export function trimRaw(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const { badge_url, server_badge_url, bulletin, declaration, quota, ...rest } = raw as Record<
    string,
    unknown
  >;
  void [badge_url, server_badge_url, bulletin, declaration, quota];
  if (!Array.isArray(rest.members)) return rest;
  const members: unknown[] = rest.members;
  return {
    ...rest,
    members: members.map((m) => {
      if (typeof m !== "object" || m === null) return m;
      const { avatar_url, frame_url, ...member } = m as Record<string, unknown>;
      void [avatar_url, frame_url];
      return member;
    }),
  };
}
