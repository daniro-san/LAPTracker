// Which alliance a member came from (owner, 2026-11-20, issue 461; D136): from the public daily rosters of
// every alliance we read (which one listed the player each day) and the alliance tag in the member's own
// /v1/players history rows (D132, kept under this workspace's alliance only). Officers always see it, not
// only in a member's first weeks. Unknown stays unknown: no guess, no "probably". Desk only; public pages
// keep D89's counts.
import { asc, and, eq } from "drizzle-orm";

import { fill, isolate } from "../copy";
import type { Db } from "../db";
import { rosterSightings } from "../queries/roster-stays";
import { allianceLabels, type AllianceLabel } from "../repo/alliances";
import { playerHistory } from "../schema-squads";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";

/** One day the player was seen in an alliance; `tag` is the tag the history row carried that day. */
export interface Sighting {
  day: string;
  unionId: number;
  tag?: string | null;
}

export interface Origin {
  /** The alliances before ours, the most recent first, with the tag each had then when a history row said. */
  before: { unionId: number; tag: string | null }[];
  /** The first day seen with us after the latest sighting elsewhere; null when no earlier alliance is known. */
  joined: string | null;
}

/**
 * The member's earlier alliances and the day they joined us, from sightings in any order. Sightings in no
 * alliance (id 0 or less) are left out. With no sighting elsewhere before the current stay, nothing is known.
 */
export function originOf(sightings: readonly Sighting[], ours: number): Origin {
  const seen = sightings
    .filter((s) => s.unionId > 0)
    // On a day seen in two alliances, ours goes last: that is the day of the move.
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) || Number(b.unionId !== ours) - Number(a.unionId !== ours),
    );
  const lastElsewhere = seen.findLastIndex((s) => s.unionId !== ours);
  if (lastElsewhere < 0) return { before: [], joined: null };
  // The most recent first; an alliance keeps the newest tag a history row gave it.
  const before = new Map<number, string | null>();
  for (const s of seen.slice(0, lastElsewhere + 1).reverse()) {
    if (s.unionId !== ours) before.set(s.unionId, before.get(s.unionId) ?? s.tag ?? null);
  }
  return {
    before: [...before].map(([unionId, tag]) => ({ unionId, tag })),
    joined: seen.slice(lastElsewhere + 1).find((s) => s.unionId === ours)?.day ?? null,
  };
}

/** "[TAG] Name", each part only when known, isolated so a right-to-left name keeps its place. */
function allianceText(b: Origin["before"][number], label: AllianceLabel | undefined): string {
  const tag = b.tag ?? label?.tag ?? null;
  const parts = [tag ? `[${tag}]` : null, label?.name ?? null].filter((p) => p !== null);
  return isolate(parts.length > 0 ? parts.join(" ") : String(b.unionId));
}

/** The card's lines: "Came from [TAG] Name · joined us Wed, Nov 18" and "Before that: …", or "not known". */
export function originLines(
  origin: Origin,
  labels: Map<number, AllianceLabel>,
  t: WorkspaceDictionary,
  date: (day: string) => string,
): string[] {
  const [first, ...rest] = origin.before;
  if (!first) return [t["card.origin.unknown"]];
  const from = allianceText(first, labels.get(first.unionId));
  const head = origin.joined
    ? fill(t["card.origin.joined"], { alliance: from, date: date(origin.joined) })
    : fill(t["card.origin.from"], { alliance: from });
  if (rest.length === 0) return [head];
  const list = rest.map((b) => allianceText(b, labels.get(b.unionId))).join(" · ");
  return [head, fill(t["card.origin.before"], { list })];
}

/** The member's origin lines; the uid is already known to be in the workspace's own alliance. */
export async function memberOrigin(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  zone: string,
  t: WorkspaceDictionary,
  date: (day: string) => string,
): Promise<string[]> {
  const [rosters, history] = await Promise.all([
    rosterSightings(db, uid),
    db
      .select({
        t: playerHistory.t,
        unionId: playerHistory.playerUnionId,
        tag: playerHistory.unionAbbr,
      })
      .from(playerHistory)
      .where(and(eq(playerHistory.unionId, access.unionId), eq(playerHistory.uid, uid)))
      .orderBy(asc(playerHistory.t)),
  ]);
  const sightings: Sighting[] = [
    ...rosters,
    ...history.flatMap((h) =>
      h.unionId === null
        ? []
        : [{ day: dayIn(zone, h.t.getTime()), unionId: h.unionId, tag: h.tag || null }],
    ),
  ];
  const origin = originOf(sightings, access.unionId);
  const labels = await allianceLabels(
    db,
    origin.before.map((b) => b.unionId),
  );
  return originLines(origin, labels, t, date);
}
