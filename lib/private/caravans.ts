// The Caravans view's suggestions (issues 300, 354): the workspace's own roster (newest roster for who is in
// the alliance, the end-of-day reads of the game week for daily quest points, D127), the away notes and
// statuses of member facts (D80), and every caravan seat taken in the calendar. `active` stays in here and in
// the pure ranking: the page gets only names and a reason (D71, D76).
import type { Db } from "../db";
import { caravanSeats } from "../repo/calendar";
import { endOfDayReads } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import { pickableMembers } from "./calendar";
import type { Placed } from "./calendar-model";
import { addDays, weekdayIndex } from "./calendar-time";
import { suggest, type Role, type Suggestion } from "./caravan-suggest";
import { awayOn } from "./fact-fields";
import { factsOf } from "./member-facts";
import { WEEK_READS, weekQuestPoints } from "./member-week";

/** Per caravan week (`entry:week`), its suggestions; caravans only. */
export async function caravanSuggestions(
  db: Db,
  access: WorkspaceAccess,
  caravans: readonly Placed[],
  /** The server's zone (SERVER_TZ): an away note or a break counts from the day it was saved (D103). */
  zone: string,
): Promise<Map<string, Suggestion[]>> {
  if (caravans.length === 0) return new Map();
  const [members, reads, facts, seats] = await Promise.all([
    pickableMembers(db, access),
    endOfDayReads(db, access.unionId, WEEK_READS),
    factsOf(db, access),
    caravanSeats(db, access.workspaceId),
  ]);
  const roles: Role[] = seats.flatMap((s) => {
    const day = s.movedTo ?? addDays(s.week, weekdayIndex(s.planned));
    const key = `${s.entryId}:${s.week}`;
    return [s.coachUid, s.secondUid].flatMap((uid) => (uid === null ? [] : [{ uid, day, key }]));
  });
  return new Map(
    caravans.map((p) => {
      const key = `${p.entry.id}:${p.week}`;
      const candidates = members.map((m) => {
        const away = awayOn(facts.get(m.uid), p.day, zone) !== null;
        return { ...m, active: weekQuestPoints(reads, m.uid), away };
      });
      const seated = [p.row?.coachUid, p.row?.secondUid].filter((u): u is number => u != null);
      return [key, suggest(candidates, roles, { key, day: p.day, seated })];
    }),
  );
}
