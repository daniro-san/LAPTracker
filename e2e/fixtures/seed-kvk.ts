// The last event's KvK opponent (D152): an invented server 326 with two alliances, read at the Start and the
// End. Each member is `[might, kills]`; no member names, as the tracker stores none for the opponent.
import { calendarOf } from "./seed";

type Members = readonly (readonly [number, number])[];
interface OpponentAlliance {
  tag: string;
  name: string;
  unionId: number;
  start: Members;
  end: Members;
}

export const OPPONENT: { server: number; alliances: readonly OpponentAlliance[] } = {
  server: 326,
  alliances: [
    {
      tag: "XQZ",
      name: "Quiet Zephyr",
      unionId: 990301,
      start: [
        [61_000_000, 2_000_000],
        [40_000_000, 1_000_000],
      ],
      end: [
        [55_000_000, 2_300_000],
        [40_000_000, 1_100_000],
      ],
    },
    {
      tag: "MOR",
      name: "Morning Reed",
      unionId: 990302,
      start: [
        [35_000_000, 900_000],
        [30_000_000, 500_000],
      ],
      end: [
        [34_000_000, 950_000],
        [30_000_000, 500_000],
      ],
    },
  ],
};

const list = (xs: readonly number[]) => `'{${xs.join(",")}}'`;
const sum = (m: Members, i: 0 | 1) => m.reduce((t, r) => t + r[i], 0);

/** The opponent of the last event, and its reads in that event's Before and After (snapshots 3 and 4, as
 * `seedSql` numbers them), as one transaction after the seed. */
export function opponentSql(now: Date): string {
  const day = calendarOf(now).events[1] as string;
  const tags = OPPONENT.alliances.map((a) => a.tag).join(",");
  const lines = [
    `insert into kvk_opponents (id, event_at, server, tags) values (1, '${day}T12:00:00-02:00', ${OPPONENT.server}, '{${tags}}');`,
  ];
  for (const [phase, sid, hour] of [
    ["before", 3, "10"],
    ["after", 4, "14"],
  ] as const)
    for (const a of OPPONENT.alliances) {
      const m = phase === "before" ? a.start : a.end;
      const at = `${day}T${hour}:01:00-02:00`;
      const uids = m.map((_, i) => a.unionId * 10 + i);
      lines.push(
        `insert into kvk_reads (opponent_id, snapshot_id, phase, tag, union_id, sid, name, member_count, total_power, total_kills, member_uids, member_power, member_kills, source_updated_at, cached, is_fresh, read_at) values (1, ${sid}, '${phase}', '${a.tag}', ${a.unionId}, ${OPPONENT.server}, '${a.name}', ${m.length}, ${sum(m, 0)}, ${sum(m, 1)}, ${list(uids)}, ${list(m.map((r) => r[0]))}, ${list(m.map((r) => r[1]))}, '${at}', false, true, '${at}');`,
      );
    }
  return ["begin;", ...lines, "commit;"].join("\n");
}
