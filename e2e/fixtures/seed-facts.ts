// The e2e seed's member facts, apart from seed.ts for its size, each written as the facts editor writes it
// (version 1, the value as JSON, by Lantern Keep's officer) FACT_SEEDED.daysAgo days before the seed's today:
// Troops T10 for each member the member-facts test edits, and ZONE_FACTS' time zones (Insights' Time zones
// card, owner 2026-11-22).
import { ALLIANCES, FACT_MEMBERS, FACT_SEEDED, uidOf, ZONE_FACTS } from "./seed-people";

const DAY_MS = 86_400_000;

/** `today`: the seed's server day as midnight UTC of that date (calendarOf's `today`). */
export function factRows(today: number): string[] {
  const at = `${new Date(today - FACT_SEEDED.daysAgo * DAY_MS).toISOString().slice(0, 10)}T12:00:00-02:00`;
  const row = (k: number, field: string, value: unknown) =>
    `(${ALLIANCES.a.id}, ${uidOf("a", k)}, '${field}', 1, '${JSON.stringify(value)}', 'officer', 1, '${at}')`;
  const rows = [
    ...Object.values(FACT_MEMBERS)
      .flat()
      .map((k) => row(k, "troopTier", FACT_SEEDED.tier)),
    ...Object.entries(ZONE_FACTS).map(([k, zone]) => row(Number(k), "timeZone", zone)),
  ];
  return [
    `insert into member_facts (workspace_id, uid, field, version, value, source, written_by, written_at) values ${rows.join(", ")};`,
  ];
}
