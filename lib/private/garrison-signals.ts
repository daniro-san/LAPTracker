// What the garrison plan's suggestion order reads (D121): daily quest points over the game week (D76, D127,
// the own alliance's end-of-day rosters), might grown over the last one to two weeks (D109, the same
// rosters), and "took part"
// in a recent Undead Siege roll call (D103). They stay in lib/private: the page gets only the good ones as
// words, never a number (D71, D76), and nothing here is logged.
import type { Db } from "../db";
import { callsOfWeeks, newestMarks } from "../repo/roll-call";
import { endOfDayReads, type RosterRead } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import { addDays, daysBetween } from "./calendar-time";
import type { Signals } from "./garrison-plan";
import { weekQuestPoints } from "./member-week";

/** Growth compares the newest roster with the oldest one from 7 to 14 days before it. */
const GROWTH_DAYS = [7, 14] as const;
/** "Took part" looks at the Undead Siege roll calls of the four weeks before the siege's week. */
const SIEGE_WEEKS = 4;

/**
 * Per member: active when the daily quest points of the newest read's game week are above zero (D127),
 * growing when their might is
 * above the base roster's, took part when a recent siege's newest mark is "took part". Each is null when
 * not known: no roster, no value, no base roster, or no mark.
 */
export function signalsOf(
  reads: readonly RosterRead[],
  marks: readonly { uid: number; mark: string | null }[],
): (uid: number) => Signals {
  const newest = reads.at(-1);
  const base = newest
    ? reads.find((r) => {
        const gap = daysBetween(r.day, newest.day);
        return gap >= GROWTH_DAYS[0] && gap <= GROWTH_DAYS[1];
      })
    : undefined;
  const now = new Map(newest?.members.map((m) => [m.uid, m]));
  const then = new Map(base?.members.map((m) => [m.uid, m.power]));
  return (uid) => {
    const m = now.get(uid);
    const before = then.get(uid);
    const quest = weekQuestPoints(reads, uid);
    const own = marks.filter((x) => x.uid === uid).map((x) => x.mark);
    return {
      active: quest === null ? null : quest > 0,
      growing: m?.power == null || before == null ? null : m.power > before,
      tookPart: own.includes("yes") ? true : own.includes("no") ? false : null,
    };
  };
}

/** The signals of the workspace's own members before the siege of `week` (its Monday). */
export async function readSignals(
  db: Db,
  access: WorkspaceAccess,
  week: string,
): Promise<(uid: number) => Signals> {
  const weeks = Array.from({ length: SIEGE_WEEKS }, (_, i) => addDays(week, -7 * (i + 1)));
  const [reads, calls] = await Promise.all([
    endOfDayReads(db, access.unionId, GROWTH_DAYS[1] + 1),
    callsOfWeeks(db, access.workspaceId, weeks),
  ]);
  const sieges = calls.filter((c) => c.kind === "raid").map((c) => c.id);
  return signalsOf(reads, await newestMarks(db, sieges));
}
