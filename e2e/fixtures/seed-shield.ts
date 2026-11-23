// Moss Hollow's Raid Shield check of last week's raid (issue 726), shaped like a real Friday night: most maps
// from the 22:33 ST scan, one from 16:41 ST, one from Thursday, a morning batch scanned 31 min after the reset,
// and one member with no reading. Its Raid prep has no mark yet: the tick no longer marks it (D137,
// 2026-11-22). The check is on for Moss Hollow only, so Lantern Keep's Raid prep tests keep theirs off.
// Invented names; the readings are times and shield flags only.
import { ALLIANCES, uidOf } from "./seed-people";

/** A map: whether it saw a shield, and its scan's minutes from the reset (Saturday 00:00 ST). */
type Map = { on: boolean; at: number };
const before = (h: number, m: number) => -(h * 60 + m);

/** Each Moss Hollow member's night (Fri 23:30 ST) and morning (Sat 10:01 ST) reading, by roster index. */
export const SHIELD_READINGS: Record<number, { night?: Map; morning?: Map }> = {
  0: { night: { on: true, at: before(1, 27) } },
  1: { night: { on: true, at: before(1, 27) } },
  // No shield on the 22:33 map, one on the 07:15 map: the map nearest the reset saw none.
  2: { night: { on: false, at: before(1, 27) }, morning: { on: true, at: 7 * 60 + 15 } },
  // Seen on the 16:41 map, 7 h 19 min before the reset, and on the 09:39 one: neither is near it.
  3: { night: { on: true, at: before(7, 19) }, morning: { on: true, at: 9 * 60 + 39 } },
  // A Thursday 10:07 map at night; no shield on the map 31 min after the reset.
  4: { night: { on: true, at: before(37, 53) }, morning: { on: false, at: 31 } },
  5: { night: { on: true, at: before(1, 27) }, morning: { on: true, at: 4 * 60 + 36 } },
  // 6: no reading at all.
  // None at 22:33, one at 00:31: both within 3 h, so 00:00 ST is unknown.
  7: { night: { on: false, at: before(1, 27) }, morning: { on: true, at: 31 } },
};

/** "To check by hand" on that Raid prep (issue 726): roster indexes, in roster order. */
export const HAND_CHECK = [2, 3, 4, 6, 7];
/** That Raid prep's roll call id (Lantern Keep's are 1 to 4). */
export const SHIELD_PREP_ID = 50;
const NIGHT_READ = before(0, 30);
const MORNING_READ = 10 * 60 + 1;

/** The rows: Moss Hollow's check turned on, its readings, and last week's Raid prep with no mark yet. */
export function shieldRows(raidDay: string, monday: string): string[] {
  const b = ALLIANCES.b;
  const reset = `timestamptz '${raidDay}T00:00:00-02:00'`;
  const minutes = (m: number) => `${reset} + interval '${m} minutes'`;
  const reads = Object.entries(SHIELD_READINGS).flatMap(([k, r]) =>
    (["night", "morning"] as const).flatMap((pass) => {
      const map = r[pass];
      const readAt = pass === "night" ? NIGHT_READ : MORNING_READ;
      return map
        ? [
            `(${b.unionId}, ${uidOf("b", Number(k))}, ${minutes(readAt)}, ${map.on ? 1 : 0}, 0, ${minutes(map.at)})`,
          ]
        : [];
    }),
  );
  return [
    `update workspace_features set switches = '{"shield_check": true}', alliance_switches = '{"shield_check": true}' where workspace_id = ${b.id};`,
    `insert into player_reads (union_id, uid, read_at, shielding, shield_type, map_updated_at) values ${reads.join(", ")};`,
    `insert into roll_calls (id, workspace_id, kind, day, week, created_by) values (${SHIELD_PREP_ID}, ${b.id}, 'shield', '${raidDay}', '${monday}', 3);`,
  ];
}
