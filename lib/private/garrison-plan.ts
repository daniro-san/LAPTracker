// The Undead Siege garrison plan (issue 423, D121), pure, for the server and the browser. T is the siege's
// enemy might. Who needs a garrison (no squad at T or above), who is close (strongest squad from T to
// T + 1M), what each helper can lend (every squad but their strongest, which stays home), the suggested
// pairs, the check of an officer's edited pairs, and the text shared to the game and Discord. People first
// (D75): the order is only a suggestion, no score or rank is shown, and missing data counts against nobody.
import type { GarrisonPair } from "../schema-calendar";
import { fill } from "../words";

export type { GarrisonPair };

/** "Close": the strongest squad is at T or above, by at most this much (owner, 2026-11-18). */
export const CLOSE_MARGIN = 1_000_000;

export interface Squad {
  squad: number;
  power: number;
}

/**
 * What the suggestion order reads (D76, D103, D109, D127): the week's daily quest points above zero, might grown over the last
 * one to two weeks, and a "took part" mark in a recent Undead Siege roll call. Null is unknown.
 */
export interface Signals {
  active: boolean | null;
  growing: boolean | null;
  tookPart: boolean | null;
}

export interface PlanMember {
  uid: number;
  name: string;
  /** Each squad number's newest stored row (D117); empty when the tracker saw none. */
  squads: readonly Squad[];
  signals: Signals;
}

/** help: no squad at T or above; close: within CLOSE_MARGIN above T; unknown: no squad data. */
export type Need = "help" | "close" | "fine" | "unknown";

/** The strongest squad: the highest power, the lower number on a tie (D117's main squad). */
export function strongest(squads: readonly Squad[]): Squad | null {
  let best: Squad | null = null;
  for (const s of squads)
    if (!best || s.power > best.power || (s.power === best.power && s.squad < best.squad)) best = s;
  return best;
}

export function needOf(squads: readonly Squad[], t: number): Need {
  const top = strongest(squads);
  if (!top) return "unknown";
  if (top.power < t) return "help";
  return top.power <= t + CLOSE_MARGIN ? "close" : "fine";
}

/** A squad a helper can lend. */
export interface Spare {
  helper: number;
  squad: number;
  power: number;
}

/** The strongest first; then the helper's uid and the squad number, so the order never depends on reads. */
const bySpare = (a: Spare, b: Spare) =>
  b.power - a.power || a.helper - b.helper || a.squad - b.squad;

/**
 * What a member can lend: when their strongest squad is at T or above, it stays in their own sanctuary and
 * each other squad is a spare (capacity = squads − 1), strongest first. Nothing otherwise.
 */
export function sparesOf(m: Pick<PlanMember, "uid" | "squads">, t: number): Spare[] {
  const kept = strongest(m.squads);
  if (!kept || kept.power < t) return [];
  return m.squads
    .filter((s) => s.squad !== kept.squad)
    .map((s) => ({ helper: m.uid, squad: s.squad, power: s.power }))
    .sort(bySpare);
}

/** How many signals are known to be good. Unknown and not-good both count nothing: no one is pushed down. */
export const goodSignals = (s: Signals) =>
  [s.active, s.growing, s.tookPart].filter((v) => v === true).length;

const NEED_ORDER: Partial<Record<Need, number>> = { help: 0, close: 1 };

/** Who gets a squad first: "needs help" before "close", then more good signals, then by name. */
export function helpOrder<M extends PlanMember>(members: readonly M[], t: number): M[] {
  const need = (m: M) => NEED_ORDER[needOf(m.squads, t)] ?? 2;
  return members
    .filter((m) => need(m) < 2)
    .sort(
      (a, b) =>
        need(a) - need(b) ||
        goodSignals(b.signals) - goodSignals(a.signals) ||
        a.name.localeCompare(b.name, "en") ||
        a.uid - b.uid,
    );
}

/**
 * The suggested pairs: in help order, each member gets the strongest spare squad left that is not their
 * own. One squad per member, and each spare squad goes to one member only.
 */
export function suggestPairs(members: readonly PlanMember[], t: number): GarrisonPair[] {
  const free = members.flatMap((m) => sparesOf(m, t)).sort(bySpare);
  const pairs: GarrisonPair[] = [];
  for (const m of helpOrder(members, t)) {
    const i = free.findIndex((s) => s.helper !== m.uid);
    if (i === -1) continue;
    const [s] = free.splice(i, 1) as [Spare];
    pairs.push({ helper: s.helper, squad: s.squad, member: m.uid });
  }
  return pairs;
}

/** A pair lends a squad the helper has and that is not their strongest, to someone else on the roster. */
function pairFits(p: GarrisonPair, byUid: ReadonlyMap<number, Pick<PlanMember, "squads">>) {
  const helper = byUid.get(p.helper);
  const kept = helper ? strongest(helper.squads) : null;
  const has = helper?.squads.some((s) => s.squad === p.squad) ?? false;
  return byUid.has(p.member) && p.helper !== p.member && has && kept?.squad !== p.squad;
}

/** True when an officer's edited pairs can be saved: every pair fits, each squad lent once, each member helped once. */
export function pairsOk(
  pairs: readonly GarrisonPair[],
  members: readonly Pick<PlanMember, "uid" | "squads">[],
): boolean {
  const byUid = new Map(members.map((m) => [m.uid, m]));
  const lent = new Set(pairs.map((p) => `${p.helper}:${p.squad}`));
  const helped = new Set(pairs.map((p) => p.member));
  return (
    lent.size === pairs.length &&
    helped.size === pairs.length &&
    pairs.every((p) => pairFits(p, byUid))
  );
}

const UNITS: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

/**
 * The enemy might in a picture of the Undead Siege screen, in full ("Enemy Might: 11.5M" is 11500000);
 * null when the text has none. The OCR may drop the colon or a space, or misread a letter of "Might".
 */
export function enemyMightIn(text: string): number | null {
  const found = /enemy\W{0,3}m\w{2,5}\W{0,3}(\d{1,4}(?:[.,]\d{1,3})?)\s?([kmb])\b/i.exec(text);
  if (!found) return null;
  const [, digits = "", unit = ""] = found;
  return Math.round(Number(digits.replace(",", ".")) * (UNITS[unit.toLowerCase()] ?? 0)) || null;
}

/** The share's words: its heading lines and one line per pair, "{helper} → {member}: squad {n}, {might}". */
export interface ShareWords {
  head: string[];
  line: string;
  /** Said when the plan has no pair. */
  none: string;
}

/**
 * The text for the game and for Discord: names and squad might only, never a signal (D71, D76). `might`
 * formats a squad's power; `nameOf` gives a roster name.
 */
export function shareText(
  words: ShareWords,
  pairs: readonly GarrisonPair[],
  nameOf: (uid: number) => string,
  mightOf: (helper: number, squad: number) => string,
): string {
  const lines = pairs.map((p) =>
    fill(words.line, {
      helper: nameOf(p.helper),
      member: nameOf(p.member),
      n: p.squad,
      might: mightOf(p.helper, p.squad),
    }),
  );
  return [...words.head, "", ...(lines.length > 0 ? lines : [words.none])].join("\n");
}
