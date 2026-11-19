// The thefts log's arithmetic (issue 321, D97), pure: who an entry's attacker is, the entries grouped by the
// attacker's alliance and by attacker with this week's and all-time counts, and each attacker's "to follow
// up" state. Counts per victim exist only inside an attacker's group (D75: no list of our members).
import { SERVER } from "../../config/alliances";
import { nameKey } from "../screenshot/name-key";

/** The steps of the talks with an attacker's alliance, in order (D97, amended 2026-11-19). */
export const FOLLOW_UP_STATES = ["open", "warned", "talked", "retaliated", "resolved"] as const;
export type FollowUpState = (typeof FOLLOW_UP_STATES)[number];

/** A theft's type, as the add sheet offers it (D97, amended 2026-11-17). */
export const THEFT_KINDS = ["tile_hit", "ops", "caravan", "sanctuary"] as const;
export type TheftKind = (typeof THEFT_KINDS)[number];

/** One attacker across entries: `uid:<uid>` for a player found in a tracked roster, else `name:<name key>`. */
export function attackerKeyOf(uid: number | null, name: string): string {
  return uid !== null ? `uid:${uid}` : `name:${nameKey(name)}`;
}

export interface TheftEntry {
  id: number;
  /** When it happened; null when the time was not read. */
  at: Date | null;
  attackerKey: string;
  attackerName: string;
  attackerTag: string;
  /** Matched exactly to a tracked roster (an officer's pick, or the same name and tag on a screenshot). */
  rosterExact: boolean;
  /** Null on rows saved before the type was asked. */
  kind: TheftKind | null;
  victimUid: number | null;
  victimName: string | null;
  source: "photo" | "typed";
  /** What was taken, as the officer wrote it; null when not given. */
  items: string | null;
  note: string | null;
}

/** One officer's change of an attacker's follow-up. */
export interface FollowUpChange {
  /** The change's row id: a new step names the newest one it saw (409 when another came first). */
  id: number;
  attackerKey: string;
  state: FollowUpState;
  note: string | null;
  changedAt: Date;
  by: string | null;
}

export interface FollowUp {
  state: FollowUpState;
  /** The newest change; null when no officer has set one. */
  last: Omit<FollowUpChange, "attackerKey"> | null;
  /** A theft that happened after the last change opened it again. */
  reopened: boolean;
  /** The changes before the newest, newest first. */
  earlier: Omit<FollowUpChange, "attackerKey">[];
}

const withoutKey = ({ id, state, note, changedAt, by }: FollowUpChange) => ({
  id,
  state,
  note,
  changedAt,
  by,
});

/**
 * The newest change of the attacker (`changes`, oldest first), else open. A theft whose time is known and
 * later than that change opens it again: talking or resolving was about the thefts before it.
 */
export function followUpOf(
  changes: readonly FollowUpChange[],
  entries: readonly TheftEntry[],
): FollowUp {
  const change = changes.at(-1);
  if (!change) return { state: "open", last: null, reopened: false, earlier: [] };
  const last = withoutKey(change);
  const earlier = changes.slice(0, -1).map(withoutKey).reverse();
  const again = entries.some((e) => e.at !== null && e.at > change.changedAt);
  return again && change.state !== "open"
    ? { state: "open", last, reopened: true, earlier }
    : { state: change.state, last, reopened: false, earlier };
}

export interface Victim {
  uid: number;
  name: string;
  count: number;
}

interface Counts {
  /** Thefts whose time falls in this week. */
  week: number;
  total: number;
  lastAt: Date | null;
}

export interface AttackerGroup extends Counts {
  key: string;
  /** The name and tag of the newest entry. */
  name: string;
  tag: string;
  /**
   * The attacker's server: the one an officer set (null when they said "not known"), else our server for a
   * player matched exactly to a tracked alliance's roster (every tracked alliance is on it), else null.
   */
  server: number | null;
  /** Whether `server` is an officer's (a number or "not known"), not inferred. */
  serverSet: boolean;
  /** Known victims, by name (D75: never ranked by how often). */
  victims: Victim[];
  followUp: FollowUp;
  /** Newest first. */
  entries: TheftEntry[];
}

export interface AllianceGroup extends Counts {
  /** The attackers' alliance tag; "" when not known. */
  tag: string;
  attackers: AttackerGroup[];
}

const time = (at: Date | null) => at?.getTime() ?? -Infinity;

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

/** Newest first: the later time, entries without a time last, then the later entry. */
const newestFirst = (a: TheftEntry, b: TheftEntry) => time(b.at) - time(a.at) || b.id - a.id;

/** This week's count first, then the most recent, then the most in total. */
const busiestFirst = (a: Counts, b: Counts) =>
  b.week - a.week || time(b.lastAt) - time(a.lastAt) || b.total - a.total;

function victimsOf(entries: readonly TheftEntry[]): Victim[] {
  const byUid = new Map<number, Victim>();
  for (const e of entries) {
    if (e.victimUid === null) continue;
    const known = byUid.get(e.victimUid);
    if (known) known.count += 1;
    else byUid.set(e.victimUid, { uid: e.victimUid, name: e.victimName ?? "", count: 1 });
  }
  return [...byUid.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function attackerOf(
  entries: TheftEntry[],
  changes: readonly FollowUpChange[],
  week: { from: Date; to: Date },
  servers: ReadonlyMap<string, number | null>,
): AttackerGroup {
  const sorted = [...entries].sort(newestFirst);
  const newest = sorted[0] as TheftEntry;
  const inWeek = (e: TheftEntry) => e.at !== null && e.at >= week.from && e.at < week.to;
  const set = servers.has(newest.attackerKey);
  return {
    key: newest.attackerKey,
    name: newest.attackerName,
    tag: newest.attackerTag,
    server: set
      ? (servers.get(newest.attackerKey) ?? null)
      : sorted.some((e) => e.rosterExact)
        ? SERVER
        : null,
    serverSet: set,
    week: sorted.filter(inWeek).length,
    total: sorted.length,
    lastAt: sorted.find((e) => e.at !== null)?.at ?? null,
    victims: victimsOf(sorted),
    followUp: followUpOf(changes, sorted),
    entries: sorted,
  };
}

/**
 * Entries by attacker, attackers by their newest entry's tag (any case), busiest first at each level.
 * `servers`: the servers officers set, by attacker key (null: "not known").
 */
export function groupThefts(
  entries: readonly TheftEntry[],
  changes: readonly FollowUpChange[],
  week: { from: Date; to: Date },
  servers: ReadonlyMap<string, number | null> = new Map(),
): AllianceGroup[] {
  const byKey = groupBy(entries, (e) => e.attackerKey);
  const attackers = [...byKey].map(([key, own]) =>
    attackerOf(
      own,
      changes.filter((c) => c.attackerKey === key),
      week,
      servers,
    ),
  );
  const byTag = groupBy(attackers, (a) => a.tag.toLowerCase());
  return [...byTag.values()]
    .map((own) => {
      const sorted = own.sort(busiestFirst);
      return {
        tag: (sorted[0] as AttackerGroup).tag,
        week: sorted.reduce((n, a) => n + a.week, 0),
        total: sorted.reduce((n, a) => n + a.total, 0),
        lastAt: sorted.map((a) => a.lastAt).reduce((a, b) => (time(b) > time(a) ? b : a), null),
        attackers: sorted,
      };
    })
    .sort(busiestFirst);
}
