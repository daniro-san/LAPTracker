// What the two ranking-screen parsers share (D74): reading a number, picking a name out of OCR noise,
// ranks that the picture does not show, and the pinned own row. Pure.

/**
 * `order`: the points are higher than the row above. `rank`: the rank read from the picture is not the
 * one inferred for the row (taken as misread). `gap`: its rank does not follow the rank of the row
 * above, so a row may be missing between them. `points`: the number of the row was not read.
 */
export type RowFlag = "order" | "rank" | "gap" | "points";

/**
 * One to three digits, then groups of exactly three behind one thousands separator, the same one
 * throughout: , . space or U+202F. So `8 174,488,831` (a medal's digit beside a number) is two numbers.
 */
const groups = (ref: number) => `\\d{1,3}(?:([,. \\u202F])\\d{3}(?:\\${ref}\\d{3})*)?`;
/** A number as a whole token; not the middle of a longer one, not a decimal such as 12,34. */
export const COUNT = new RegExp(String.raw`(?<![\d,.\u202F])${groups(1)}(?!\d|[,.]\d)`, "gu");
const COUNT_AT_END = new RegExp(String.raw`(?:^|\s)(${groups(2)})\s*$`, "u");
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

/** The offset (rank minus place) that most read ranks agree on; null when no rank was read. */
function majorityOffset(read: readonly (number | null)[]): number | null {
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
  return best;
}

/**
 * The rank each place gives with the offset most read ranks agree on: what the pinned-row check
 * compares the last row's read rank with. Null without any read rank, or below rank 1.
 */
export function placeRanks(read: readonly (number | null)[]): (number | null)[] {
  const best = majorityOffset(read);
  return read.map((_, place) => (best === null || best + place < 1 ? null : best + place));
}

interface Anchor {
  place: number;
  /** Rank minus place. */
  offset: number;
}

/**
 * Read ranks the others hang on: one whose offset a neighbouring read rank shares, or a lone one
 * that steps the offset up at either end of the page (a row is missing beside it). Any other lone
 * read rank is taken as misread.
 */
function anchorsOf(read: readonly (number | null)[]): Anchor[] {
  const all = read.flatMap((rank, place) =>
    rank === null ? [] : [{ place, offset: rank - place }],
  );
  return all.filter(({ offset }, i) => {
    const [before, after] = [all[i - 1]?.offset, all[i + 1]?.offset];
    if (offset === before || offset === after || all.length === 1) return true;
    const last = i === all.length - 1 && before !== undefined && offset > before;
    return last || (i === 0 && after !== undefined && offset < after);
  });
}

/**
 * The rank of every row. A row takes the rank of the nearest anchor above it plus its distance, so
 * a missing row shows as a jump (the flag `gap`) where the read ranks step up, and never shifts the
 * rows above it. Rows above the first anchor count back from it, except in one case: when that puts
 * the page's top row at rank 2 and gives a row of rank 4 or more no printed rank, those rows are the
 * medal rows 1 to 3 (which print no digit) and a row is missing after them (the own row, white on
 * green, measured on issue 299). No read rank at all: no ranks.
 */
export function inferRanks(read: readonly (number | null)[]): (number | null)[] {
  const anchors = anchorsOf(read);
  const first = anchors[0];
  if (!first) return read.map(() => null);
  const medals = first.offset === 2 && first.place + first.offset - 1 >= 4;
  return read.map((_, place) => {
    if (place < first.place && medals) return place + 1;
    const rank = place + (anchors.findLast((a) => a.place <= place) ?? first).offset;
    return rank < 1 ? null : rank;
  });
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
 * above the nearest row above that has points. The Alliance Duel screens always pin one under a list
 * of at most `pinsAfter` rows (`pinned`), so there a last row whose number was not read, or one row
 * more than the list holds, is dropped too.
 */
export function keptRowCount(
  rows: readonly Placed[],
  ranks: readonly (number | null)[],
  pinned?: { pinsAfter: number },
): number {
  if (rows.length === 0) return 0;
  const over = pinned !== undefined && rows.length > pinned.pinsAfter;
  return over || isPinned(rows, ranks.at(-1) ?? null, pinned !== undefined)
    ? rows.length - 1
    : rows.length;
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
  const [rank, previous] = [ranks[place] ?? null, ranks[place - 1] ?? null];
  const flags: [boolean, RowFlag][] = [
    [row.points === null, "points"],
    [row.points !== null && above !== null && row.points > above, "order"],
    [row.read !== null && row.read !== rank, "rank"],
    [rank !== null && previous !== null && rank !== previous + 1, "gap"],
  ];
  return flags.filter(([on]) => on).map(([, flag]) => flag);
}
