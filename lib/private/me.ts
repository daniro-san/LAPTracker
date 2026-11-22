// A member's own page (issue 487, D142): the read behind /w/[slug]/board/me. It takes a MeAccess (the
// board's door and an approved link), so the uid is the link's and never the request's, and every read is
// of that one player of the workspace's own alliance (D71). A member no longer in the alliance's newest
// roster gets nothing past that check. Never read here: rankings, other members, officers' notes, facts,
// statuses or follow-ups, and x, y, online, last_online_at, joined_at and avatar_url. The member's own
// daily_tech, daily_honor and active (owner, 2026-11-21, D142) are returned to this page only: nothing
// here is logged, cached or sent anywhere.
import type { Db } from "../db";
import { heroNames } from "../repo/hero-catalog";
import { mightBeforeEvent, ownDays, ownMarks, ownSeats, ownTeam } from "../repo/me";
import { squadPairs } from "../repo/squads";
import type { MeAccess } from "./access";
import { addDays, dayIn, mondayOf, zonedInstant } from "./calendar-time";
import { endOf } from "./calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import {
  neededLines,
  recoveryLine,
  seriesOf,
  weekCard,
  PROGRESS_DAYS,
  type NeededLine,
  type Series,
} from "./me-parts";
import { cardFormats } from "./member-card";
import { daysFormats } from "./member-card-parts";
import type { DaysCard } from "./member-days";
import { squadsCardOf, type SquadsCard } from "./member-squads";

const DAY_MS = 86_400_000;

export type MeView =
  | { left: true; name: string }
  | {
      left: false;
      name: string;
      progress: { might: Series | null; kills: Series | null; kvk: string | null };
      week: DaysCard | null;
      squads: SquadsCard;
      needed: NeededLine[];
    };

/** The member's own page in `language`; `today` is the server day. */
export async function meView(
  db: Db,
  me: MeAccess,
  at: {
    now: Date;
    zone: string;
    /** The KvK's End read, "16:15" (SNAPSHOT_AFTER), when its Raid prep line is "Ended". */
    endRead: string;
    language: WorkspaceLanguage;
    t: WorkspaceDictionary;
  },
): Promise<MeView> {
  const { now, zone, t } = at;
  const today = dayIn(zone, now.getTime());
  const week = mondayOf(today);
  const days = await ownDays(db, me.unionId, me.uid, addDays(week, -7));
  const newest = days.at(-1);
  const name = days.findLast((d) => d.name !== null)?.name ?? "";
  // INVARIANT me.left-closes: a member the newest roster does not list sees nothing more.
  if (newest && !newest.listed) return { left: true, name };
  const since = new Date(now.getTime() - PROGRESS_DAYS * DAY_MS);
  const [before, pairs, heroes, team, seats, marks] = await Promise.all([
    mightBeforeEvent(db, me.unionId, me.uid, since, now),
    squadPairs(db, me.unionId, me.uid),
    heroNames(db),
    ownTeam(db, me.workspaceId, me.uid, week),
    ownSeats(db, me.workspaceId, me.uid, week),
    ownMarks(db, me.workspaceId, me.uid, today),
  ]);
  const f = cardFormats(at.language, zone, now);
  const d = daysFormats(t, f);
  const kvk = before && { day: dayIn(zone, before.at.getTime()), power: before.power };
  return {
    left: false,
    name,
    progress: {
      might: seriesOf(days, "power", t, d),
      kills: seriesOf(days, "kills", t, d),
      kvk: recoveryLine(days, kvk, t, d.date),
    },
    week: weekCard(days, today, t, d),
    squads: { ...squadsCardOf(pairs, heroes, t, f), none: t["me.squads.none"] },
    // An event with no time of its own starts and ends with its day, so it is only ever "Ended"; a Raid
    // prep starts with its KvK instead (`neededLines`).
    needed: neededLines(
      { team, seats, marks },
      week,
      t,
      d.date,
      (kind, day, minute) => {
        const end = endOf(kind, day, minute, zone, at.endRead);
        return { at: minute === null ? end : zonedInstant(day, minute, zone), end };
      },
      { now: now.getTime(), zone },
    ),
  };
}
