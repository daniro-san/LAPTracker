// Members' `?set=<kind>:<key>` (D158 rule 7 (c)): the members behind one Insights count, built on the server
// by the same functions as the count (insightsView, then the Insights words), never from the address alone.
// The set is read for the signed-in workspace's own alliance only: a key from another workspace, a band or a
// week that holds nobody today, or the Insights tab turned off, gives nothing. Names only, no measure (D75).
import type { Db } from "../db";
import type { WorkspaceAccess } from "./access";
import { featureOn } from "./features";
import { insightsView, type InsightsView } from "./insights";
import type { Formats } from "./insights-format";
import type { MemberSet, SetRef, Who } from "./insights-sets";
import { insightsWords } from "./insights-words";
import { zonesWordsAt, type ZoneClock } from "./insights-zones-words";

/** The page's instant, the server's zone and the KvK start: the Time zones card's own clock. */
export type SetClock = ZoneClock;

/** Every set the Insights page shows for `view`, from the words its cards draw. */
export function insightsSets(view: InsightsView, f: Formats, c: SetClock): MemberSet[] {
  const words = insightsWords(view, f.t, f.language);
  const zones = zonesWordsAt(view.zones, view.people, f, c);
  return [
    ...(words.effort?.ranges ?? []).map((r) => r.set),
    ...(words.effort?.leftOut ?? []).map((k) => k.set),
    ...(words.flow?.weeks ?? []).flatMap((w) => [w.joined.set, w.left.set]),
    ...(words.flow?.tenure ?? []).map((r) => r.set),
    ...(zones.details?.rows ?? []).map((r) => r.set),
  ].filter((s): s is MemberSet => s !== null && s !== undefined);
}

/** What Members shows for a set: its chart sentence, its current members' uids and those who left since. */
export interface ShownSet {
  ref: SetRef;
  title: string;
  uids: number[];
  former: Who[];
}

/** The set `ref` names for this workspace, as Insights counts it now; null when there is none. */
export async function shownSet(
  db: Db,
  access: WorkspaceAccess,
  ref: SetRef,
  f: Formats,
  c: SetClock,
): Promise<ShownSet | null> {
  if (!featureOn(access, "insights")) return null;
  const view = await insightsView(db, access, c.now, c.serverZone);
  const set = insightsSets(view, f, c).find((s) => s.kind === ref.kind && s.key === ref.key);
  if (!set || !set.onward) return null;
  return {
    ref,
    title: set.title,
    uids: set.people.filter((p) => p.current).map((p) => p.uid),
    former: set.people.filter((p) => !p.current),
  };
}
