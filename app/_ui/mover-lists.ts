// The Movers section's lists (#70) from the movers read model: one tab per metric and direction, plus
// the Rank tab; one list per scope (alliances, members). Server side; app/_ui/Movers.tsx draws them.
import { rankDelta } from "@/lib/compute";
import type { Dictionary } from "@/lib/copy";
import type {
  AllianceMover,
  AllianceMoverLists,
  MemberMover,
  MoverLists,
  RosterChange,
} from "@/lib/queries";

import { fellWithLeavers } from "./event-rows";
import { allianceLabel } from "./format";

export interface MoverItem {
  key: string;
  href: string;
  /**
   * Alliances: the ledger rank by might after the event and its move (D23), as on the comparison
   * table. Members: the place in the list, without a move.
   */
  rank: { n: number | null; move?: number | null };
  label: string;
  /** A member's alliance tag after the event. */
  tag?: string | null;
  /** Alliances only: the emblem beside the name. */
  badgeId?: number | null;
  delta: number | null;
  base: number | null;
  /** The `*` member mark: the alliance's total fell while members left (D33). */
  mark: boolean;
}

export type MoverKey = keyof AllianceMoverLists;

export interface MoverScope {
  key: string;
  /** The list's heading; null when the page has one scope only (the alliance page). */
  title: string | null;
  /** The Rank lists exist for alliances only. */
  lists: Partial<Record<MoverKey, MoverItem[]>>;
}

/** The tabs, in order: the head's word, its arrow (null: both), and the lists it shows. */
export const MOVER_TABS = [
  { key: "mightGains", word: "might", up: true, lists: ["mightGains"] },
  { key: "mightLosses", word: "might", up: false, lists: ["mightLosses"] },
  { key: "killsGains", word: "kills", up: true, lists: ["killsGains"] },
  { key: "rank", word: "rank", up: null, lists: ["rankUp", "rankDown"] },
] as const;

export type MoverTab = (typeof MOVER_TABS)[number]["key"];

const listKeys = ["mightGains", "mightLosses", "killsGains"] as const;

function lists<R>(
  lists: MoverLists<R> | null,
  item: (m: MoverLists<R>["mightGains"][number]) => MoverItem,
) {
  return Object.fromEntries(listKeys.map((k) => [k, (lists?.[k] ?? []).map(item)]));
}

export function allianceScope(
  movers: AllianceMoverLists | null,
  eventId: number,
  changes: Map<number, RosterChange>,
  copy: Dictionary,
): MoverScope {
  /** One alliance row: its ledger rank and move, then its might change unless a delta is given. */
  const item = (row: AllianceMover, delta?: number, base?: number | null): MoverItem => {
    const might =
      row.before?.totalPower != null && row.after?.totalPower != null
        ? row.after.totalPower - row.before.totalPower
        : null;
    const d = delta ?? might;
    return {
      key: String(row.unionId),
      href: `/events/${eventId}/alliances/${row.unionId}`,
      rank: { n: row.ledger.after, move: rankDelta(row.ledger.before, row.ledger.after) },
      label: allianceLabel(row.tag, row.name),
      badgeId: row.badgeId,
      delta: d,
      base: base === undefined ? (row.before?.totalPower ?? null) : base,
      mark: fellWithLeavers(d, changes.get(row.unionId)?.left ?? 0),
    };
  };
  return {
    key: "alliances",
    title: copy.ledger.alliances,
    lists: {
      ...lists(movers, (m) => item(m.row, m.delta, m.base)),
      rankUp: (movers?.rankUp ?? []).map((m) => item(m.row)),
      rankDown: (movers?.rankDown ?? []).map((m) => item(m.row)),
    },
  };
}

export function memberScope(movers: MoverLists<MemberMover> | null, title: string | null) {
  return {
    key: "members",
    title,
    lists: lists(movers, (m) => ({
      key: String(m.row.uid),
      href: `/players/${m.row.uid}`,
      rank: { n: m.rank },
      label: m.row.name,
      tag: m.row.tag,
      delta: m.delta,
      base: m.base,
      mark: false,
    })),
  };
}
