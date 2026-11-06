// The Movers section's lists (#70) from the movers read model: one tab per metric and direction, one
// list per scope (alliances, members). Server side; app/_ui/Movers.tsx draws them.
import type { Dictionary } from "@/lib/copy";
import type { AllianceMover, MemberMover, MoverLists, RosterChange } from "@/lib/queries";

import { fellWithLeavers } from "./event-rows";
import { allianceLabel } from "./format";

export interface MoverItem {
  key: string;
  href: string;
  rank: number;
  label: string;
  /** A member's alliance tag after the event. */
  tag?: string | null;
  /** Alliances only: the emblem beside the name. */
  badgeId?: number | null;
  delta: number;
  base: number | null;
  /** The `*` member mark: the alliance's total fell while members left (D33). */
  mark: boolean;
}

export type MoverKey = keyof MoverLists<unknown>;

export interface MoverScope {
  key: string;
  /** The list's heading; null when the page has one scope only (the alliance page). */
  title: string | null;
  lists: Record<MoverKey, MoverItem[]>;
}

/** The tabs, in order: the metric's game word and whether the arrow points up. */
export const MOVER_TABS = [
  { key: "mightGains", metric: "might", up: true },
  { key: "mightLosses", metric: "might", up: false },
  { key: "killsGains", metric: "kills", up: true },
] as const;

function scope<R>(
  key: string,
  title: string | null,
  lists: MoverLists<R> | null,
  item: (m: MoverLists<R>[MoverKey][number]) => MoverItem,
): MoverScope {
  const of = (k: MoverKey) => (lists?.[k] ?? []).map(item);
  return {
    key,
    title,
    lists: {
      mightGains: of("mightGains"),
      mightLosses: of("mightLosses"),
      killsGains: of("killsGains"),
    },
  };
}

export function allianceScope(
  lists: MoverLists<AllianceMover> | null,
  eventId: number,
  changes: Map<number, RosterChange>,
  copy: Dictionary,
): MoverScope {
  return scope("alliances", copy.ledger.alliances, lists, (m) => ({
    key: String(m.row.unionId),
    href: `/events/${eventId}/alliances/${m.row.unionId}`,
    rank: m.rank,
    label: allianceLabel(m.row.tag, m.row.name),
    badgeId: m.row.badgeId,
    delta: m.delta,
    base: m.base,
    mark: fellWithLeavers(m.delta, changes.get(m.row.unionId)?.left ?? 0),
  }));
}

export function memberScope(lists: MoverLists<MemberMover> | null, title: string | null) {
  return scope("members", title, lists, (m) => ({
    key: String(m.row.uid),
    href: `/players/${m.row.uid}`,
    rank: m.rank,
    label: m.row.name,
    tag: m.row.tag,
    delta: m.delta,
    base: m.base,
    mark: false,
  }));
}
