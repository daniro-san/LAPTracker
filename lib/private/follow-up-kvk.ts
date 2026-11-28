// Follow-up's "After KvK, offer help" (issue 585 slice 5; D104 and D139 amended): which KvK Follow-up offers
// help after, by Insights' own rule (`kvkOf`) over the members view's reads, for the week after it
// (`afterKvk`); the records it reads back to; and whether its group has someone in it, for Insights' link.
// Every read is bounded by the date (D149). Might is public; no private roster field is read here.
import type { Db } from "../db";
import { followedUpSince } from "../repo/member-follow-ups";
import { scheduledEventMight, type EventMight, type RosterRead } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import { addDays, dayIn, zonedInstant } from "./calendar-time";
import { featureOn } from "./features";
import { inKvkGroup, kvkOpen, sinceMonday } from "./follow-up-rules";
import { afterKvk, KVK_HELP_DAYS, kvkOf, type KvkView } from "./insights-kvk";

/** 00:00 server time of the oldest day a KvK Follow-up still offers help after can fall on. */
const kvkSince = (now: Date, zone: string) =>
  new Date(zonedInstant(addDays(dayIn(zone, now.getTime()), 1 - KVK_HELP_DAYS), 0, zone));

/** Where the week's records are read from: the earlier of Monday 00:00 ST and the oldest KvK day. */
export const recordsSince = (now: Date, zone: string) =>
  new Date(Math.min(sinceMonday(now, zone).getTime(), kvkSince(now, zone).getTime()));

/** The KvK events `kvkHelp` needs: from KVK_HELP_DAYS back, one statement bounded by the date. */
export const kvkEvents = (db: Db, access: WorkspaceAccess, now: Date, zone: string) =>
  scheduledEventMight(db, access.unionId, kvkSince(now, zone));

/**
 * The KvK Follow-up offers help after: Insights' rule (`kvkOf`) over the members view's own end-of-day
 * reads, its newest event shown, inside its week (`afterKvk`). `worklist` leaves out members on a break, by
 * the same test as Insights' `awayOf`.
 */
export const kvkHelp = (
  events: EventMight[],
  view: { reads: readonly RosterRead[] },
  now: Date,
  zone: string,
) => afterKvk(kvkOf(events, view.reads, zone, new Set(), now), dayIn(zone, now.getTime()));

/**
 * Whether Follow-up's "After KvK, offer help" has someone in it, for Insights' link to it: the same KvK and
 * `kvkOpen` as Follow-up's `weekLists`, less the members marked Needs help (`needsHelp`, in that group
 * instead). Insights' help list already leaves out members on a break. Reads nothing while the Follow-up tab
 * is off (D126) or outside the KvK's week.
 */
export async function kvkGroupOpen(
  db: Db,
  access: WorkspaceAccess,
  kvk: KvkView,
  needsHelp: ReadonlySet<number>,
  now: Date,
  zone: string,
): Promise<boolean> {
  const after = afterKvk(kvk, dayIn(zone, now.getTime()));
  if (!featureOn(access, "follow_up") || !after) return false;
  const rows = await followedUpSince(db, access.workspaceId, recordsSince(now, zone));
  const open = kvkOpen(after.help, rows, sinceMonday(now, zone), after.afterAt);
  return [...open].some((uid) => inKvkGroup({ kvk: true, help: needsHelp.has(uid) }));
}
