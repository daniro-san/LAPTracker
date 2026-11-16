// What the two ranking-screen parsers share (D74): reading a number, picking a name out of OCR noise,
// ranks that the picture does not show, and the pinned own row. Pure.

/**
 * `order`: the points are higher than the row above. `rank`: the rank read from the picture is not the
 * one the row's place gives. `gap`: its read rank does not follow the read rank of the row above, so a
 * row may be missing between them. `points`: the number of the row was not read.
 */
export type RowFlag = "order" | "rank" | "gap" | "points";

/** One to three digits, then groups of exactly three behind a thousands separator: , . space or U+202F. */
const GROUPS = String.raw`\d{1,3}(?:[,. \u202F]\d{3})*`;
/** A number as a whole token; not the middle of a longer one, not a decimal such as 12,34. */
export const COUNT = new RegExp(String.raw`(?<![\d,.\u202F])${GROUPS}(?!\d|[,.]\d)`, "gu");
const COUNT_AT_END = new RegExp(String.raw`(?:^|\s)(${GROUPS})\s*$`, "u");
const SEPARATOR = /[,. \u202F]/u;

export const toCount = (text: string) => Number(text.replace(/[,. \u202F]/gu, ""));

/** A number with the text before it on its line. */
export interface LineCount {
  text: string;
  /** Everything before the number, rank and name included. */
  prefix: string;
}

interface Hit {
  text: string;
  index: number;
}

/**
 * Finds a count with `find`; when it starts at the beginning of the line and the line opens with a
 * rank, reads the count after the rank instead (`100 123,456` is rank 100, then 123,456).
 */
function afterRank(line: string, find: (text: string) => Hit | null): LineCount | null {
  const whole = find(line);
  if (!whole) return null;
  const rank = /^\s*\d{1,3}\s+/u.exec(line);
  const rest =
    rank && line.slice(0, whole.index).trim() === "" ? find(line.slice(rank[0].length)) : null;
  if (rank && rest) return { text: rest.text, prefix: line.slice(0, rank[0].length + rest.index) };
  return { text: whole.text, prefix: line.slice(0, whole.index) };
}

/** The last number in the line that is written with a thousands separator. */
export function separatedCount(line: string): LineCount | null {
  return afterRank(line, (text) => {
    const hit = [...text.matchAll(COUNT)].filter((m) => SEPARATOR.test(m[0])).at(-1);
    return hit ? { text: hit[0], index: hit.index } : null;
  });
}

/** The number that ends the line, with or without a separator. */
export function endCount(line: string): LineCount | null {
  return afterRank(line, (text) => {
    const hit = COUNT_AT_END.exec(text);
    return hit
      ? { text: hit[1] as string, index: hit.index + hit[0].length - (hit[1] as string).length }
      : null;
  });
}

/** Letters and digits in a string, in any script. */
const wordLength = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, "").length;

/** The last space-separated word that holds at least `min` letters or digits; "" when none does. */
export function lastWord(text: string, min: number): string {
  const words = text.split(/\s+/).filter((word) => wordLength(word) >= min);
  return words.at(-1) ?? "";
}

/** A rank the OCR read at the start of a text: one to three digits as a word of their own. */
export function readRank(prefix: string): number | null {
  const first = prefix.trim().split(/\s+/)[0] ?? "";
  return /^\d{1,3}$/.test(first) ? Number(first) : null;
}

/**
 * The rank of every row from its place in the list: ranks 1 to 3 are medals with no digits, and a
 * digit is often misread. The offset (rank minus place) that most rows agree on gives each row its
 * rank; with no rank read at all, no row has one, and a place that would be below rank 1 has none.
 */
export function inferRanks(read: readonly (number | null)[]): (number | null)[] {
  const votes = new Map<number, number>();
  read.forEach((rank, place) => {
    if (rank !== null) votes.set(rank - place, (votes.get(rank - place) ?? 0) + 1);
  });
  let best: number | null = null;
  let most = 0;
  for (const [offset, count] of votes) {
    if (count > most) {
      best = offset;
      most = count;
    }
  }
  return read.map((_, place) => (best === null || best + place < 1 ? null : best + place));
}

interface Placed {
  read: number | null;
  /** null when the row's number was not read. */
  points: number | null;
}

/** The points of the nearest row above `place` whose number was read. */
function pointsAbove(rows: readonly Placed[], place: number): number | null {
  return rows.slice(0, place).findLast((r) => r.points !== null)?.points ?? null;
}

/** True when `row` (the last one) is the viewer's pinned row; see `keptRowCount`. */
function isPinned(rows: readonly Placed[], rank: number | null, unreadIsPinned: boolean): boolean {
  const place = rows.length - 1;
  const last = rows[place] as Placed;
  if (last.read !== null && rank !== null && last.read !== rank) return true;
  if (last.points === null) return unreadIsPinned;
  const above = pointsAbove(rows, place);
  return above !== null && last.points > above;
}

/**
 * Counts the rows left after dropping the viewer's own row pinned under the list when it is the last
 * row and does not belong to the sequence: its rank is not the one its place gives, or its points are
 * above the nearest row above that has points. With `unreadIsPinned` a last row whose number was not
 * read is dropped too (the Alliance Duel screens always pin one under the list).
 */
export function keptRowCount(
  rows: readonly Placed[],
  ranks: readonly (number | null)[],
  unreadIsPinned = false,
): number {
  if (rows.length === 0) return 0;
  return isPinned(rows, ranks.at(-1) ?? null, unreadIsPinned) ? rows.length - 1 : rows.length;
}

/** Flags for the row at `place`: see RowFlag. */
export function flagsOf(
  rows: readonly Placed[],
  ranks: readonly (number | null)[],
  place: number,
): RowFlag[] {
  const row = rows[place];
  if (!row) return [];
  const above = pointsAbove(rows, place);
  const previous = rows[place - 1]?.read ?? null;
  const flags: [boolean, RowFlag][] = [
    [row.points === null, "points"],
    [row.points !== null && above !== null && row.points > above, "order"],
    [row.read !== null && row.read !== (ranks[place] ?? null), "rank"],
    // A misread rank breaks the sequence twice: at its own row and at the row after it.
    [row.read !== null && previous !== null && row.read !== previous + 1, "gap"],
  ];
  return flags.filter(([on]) => on).map(([, flag]) => flag);
}
