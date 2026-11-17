// Roll call rules (issue 298, D103), pure and browser-safe: which occasions have a roll call, the marks
// each takes, what "the rest" becomes, the counts, and the Elixir Scramble team suggestions. People first
// (D75): a member with no mark is "not set", which is never counted as a "no", never sorted last and never
// a reason to look at anyone. Away members are left out of every roll call and every count of answers.
import { addDays, mondayOf } from "./calendar-time";
import { isDaytime } from "./members-list";

/** KvK shield, Undead Siege (the issue's "raid"), plunders, an Elixir Scramble team. */
export const ROLL_KINDS = ["shield", "raid", "plunder", "elixir"] as const;
export type RollKind = (typeof ROLL_KINDS)[number];

/** The kinds an officer adds by hand. An Elixir Scramble roll call starts from its Calendar entry. */
export const ADDED_KINDS = ["shield", "raid", "plunder"] as const;

/** Calendar entry kinds that have a roll call, and its kind. */
export const FROM_CALENDAR: Readonly<Record<string, RollKind>> = {
  kvk: "shield",
  undead: "raid",
  elixir: "elixir",
};

/** `assumed` is "no problem seen": the KvK shield's answer for the rest, not checked one by one. */
export const MARKS = ["yes", "no", "assumed"] as const;
export type Mark = (typeof MARKS)[number];

/**
 * What "the rest" becomes (owner, issue 298): the shield's rest is "no problem seen", never a silent "shield
 * up"; an Elixir Scramble team's rest did not join (its joiners are the few); an Undead Siege's rest took
 * part. Plunders (plundering caravans or Black Ops) have no "the rest": each one is marked (owner,
 * 2026-11-17).
 */
export const REST: Readonly<Record<RollKind, Mark | null>> = {
  shield: "assumed",
  elixir: "no",
  raid: "yes",
  plunder: null,
};

/** Players per Elixir Scramble team (the game's own limit). */
export const TEAM_MAX = 20;

/**
 * Whether an Elixir Scramble's registration is still open on server day `today` (owner, 2026-11-17): open
 * until Wednesday of the game week of `day` (the Scramble's day), closed from Thursday 00:00 ST. Team
 * edits stay allowed either way.
 */
export const registrationOpen = (day: string, today: string) => today < addDays(mondayOf(day), 3);

/** A tap marks ✓ or ✗, or clears; `assumed` comes only from the shield's "the rest". */
export const tapMark = (mark: Mark | null) => mark === null || mark === "yes" || mark === "no";

/** The next mark when a button is tapped: the same button again clears it. */
export const toggled = (current: Mark | null, tapped: "yes" | "no"): Mark | null =>
  current === tapped ? null : tapped;

export interface Tally {
  yes: number;
  no: number;
  assumed: number;
  notSet: number;
  away: number;
}

/**
 * The answers of the members a roll call asks about. A member with no mark, or a cleared one, is `notSet`
 * and nothing else (D75). Away members are counted apart, whatever they were marked.
 */
export function tally(
  members: readonly { uid: number; away: unknown }[],
  marks: ReadonlyMap<number, Mark | null>,
): Tally {
  const t: Tally = { yes: 0, no: 0, assumed: 0, notSet: 0, away: 0 };
  for (const m of members) {
    if (m.away) t.away += 1;
    else t[marks.get(m.uid) ?? "notSet"] += 1;
  }
  return t;
}

/**
 * The order rows are shown in, fixed when the page opens so rows never move while being tapped: not set
 * first, then marked, each by name; away members last.
 */
export function callOrder<M extends { uid: number; name: string; away: unknown }>(
  members: readonly M[],
  marks: ReadonlyMap<number, Mark | null>,
  language: string,
): M[] {
  const group = (m: M) => (m.away ? 2 : (marks.get(m.uid) ?? null) === null ? 0 : 1);
  return [...members].sort((a, b) => group(a) - group(b) || a.name.localeCompare(b.name, language));
}

/** A member who could join an Elixir Scramble team. */
export interface TeamCandidate {
  uid: number;
  name: string;
  /** Their clock's minute at the window's start; null when no time zone is recorded. */
  theirMinute: number | null;
  /** Weekly activity from the newest end-of-day read; null when not known. */
  active: number | null;
  /** Main squad might (a fact); null when not recorded. */
  squad: number | null;
}

/** "Daytime for them" as the Members list says it (D98); null with no time zone recorded. */
export const awakeAt = (minute: number | null): boolean | null =>
  minute === null ? null : isDaytime(minute);

/**
 * The team suggestions' order (owner, issue 298): daytime for them at the window first, then those with no time
 * zone recorded (missing data is never held against anyone, D75), then night; within each, the most
 * active this week, then the strongest main squad; unknown values after known ones; then by name.
 */
export function teamOrder<C extends TeamCandidate>(
  candidates: readonly C[],
  language: string,
): C[] {
  const rank = (c: C) => ({ true: 0, null: 1, false: 2 })[String(awakeAt(c.theirMinute))] ?? 1;
  return [...candidates].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.active ?? -1) - (a.active ?? -1) ||
      (b.squad ?? -1) - (a.squad ?? -1) ||
      a.name.localeCompare(b.name, language),
  );
}
