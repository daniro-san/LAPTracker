// Server power balance (D85, issue 283): the arithmetic of "who holds how much of the server's might" and of
// a hypothetical bloc. Pure: figures in, figures out. The inputs are alliance totals only, never members.

export interface BalanceAlliance {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** The alliance's total might, buildings and tech included. */
  might: number;
  members: number;
  /** When the alliance's newest usable daily roster was read. */
  at: Date;
}

/** The alliances whose might makes the top share. */
export const TOP_N = 3;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Each might as a share (0 to 1) of the total; they sum to 1, or all 0 when the total is 0. */
export function shares(mights: number[]): number[] {
  const total = sum(mights);
  return mights.map((m) => (total > 0 ? m / total : 0));
}

/** The share of the `n` greatest mights. */
export function topShare(mights: number[], n = TOP_N): number {
  const total = sum(mights);
  if (total <= 0) return 0;
  return sum([...mights].sort((a, b) => b - a).slice(0, n)) / total;
}

export interface Blocs {
  a: number[];
  b: number[];
}

export type Side = "a" | "b";

const ID = /^\d{1,15}$/;

/** `1,2,3` as ids; anything that is not a known alliance id, and a repeated id, is dropped. */
export function parseBloc(raw: string | undefined, known: Set<number>): number[] {
  const ids = (raw ?? "")
    .split(",")
    .filter((s) => ID.test(s))
    .map(Number)
    .filter((id) => known.has(id));
  return [...new Set(ids)];
}

/** Both blocs from the URL. An alliance is in at most one bloc: when named in both, A keeps it. */
export function parseBlocs(
  a: string | undefined,
  b: string | undefined,
  known: Set<number>,
): Blocs {
  const first = parseBloc(a, known);
  return { a: first, b: parseBloc(b, known).filter((id) => !first.includes(id)) };
}

/** The blocs after a tap on `side` for an alliance: it joins that bloc (leaving the other), or leaves
 * it when it is already there. */
export function tap(blocs: Blocs, unionId: number, side: Side): Blocs {
  const next: Blocs = {
    a: blocs.a.filter((id) => id !== unionId),
    b: blocs.b.filter((id) => id !== unionId),
  };
  if (!blocs[side].includes(unionId)) next[side].push(unionId);
  return next;
}

/** The query string of the blocs, empty when both are empty (an empty builder is the default). */
export function blocQuery(blocs: Blocs): string {
  const parts = (["a", "b"] as const).flatMap((s) =>
    blocs[s].length > 0 ? [`${s}=${blocs[s].join(",")}`] : [],
  );
  return parts.join("&");
}

export interface BlocFigures {
  /** Alliances in the bloc. */
  n: number;
  /** The bloc's share of the server's might: the sum of its alliances' shares. */
  share: number;
  might: number;
  members: number;
}

/** A bloc's figures against the whole server's might. */
export function blocFigures(alliances: BalanceAlliance[], ids: number[]): BlocFigures {
  const total = sum(alliances.map((r) => r.might));
  const inBloc = alliances.filter((r) => ids.includes(r.unionId));
  const might = sum(inBloc.map((r) => r.might));
  return {
    n: inBloc.length,
    share: total > 0 ? might / total : 0,
    might,
    members: sum(inBloc.map((r) => r.members)),
  };
}

/** One daily roster's figures for the trend. */
export interface DailyMight {
  day: string;
  unionId: number;
  might: number;
  at: Date;
}

export interface ConcentrationPoint {
  day: string;
  at: Date;
  /** The top share, 0 to 1. */
  top: number;
  total: number;
}

/**
 * The top share per day, oldest first, over the days on which `n` alliances or more have a usable roster
 * (a day with fewer would compare a smaller server with a larger one).
 */
export function concentration(rows: DailyMight[], n: number): ConcentrationPoint[] {
  const days = new Map<string, DailyMight[]>();
  for (const r of rows) days.set(r.day, [...(days.get(r.day) ?? []), r]);
  return [...days.entries()]
    .filter(([, rs]) => rs.length >= n)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rs]) => {
      const mights = rs.map((r) => r.might);
      return {
        day,
        at: new Date(Math.max(...rs.map((r) => r.at.getTime()))),
        top: topShare(mights),
        total: sum(mights),
      };
    });
}
