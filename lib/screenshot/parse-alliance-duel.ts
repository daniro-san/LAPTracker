// The Alliance Duel ranking screen as OCR text lines (D74, issue 299): rank, player and tag, points.
// One row is a name line, a line with the points (and the rank, when a number was read), and a line
// with `[TAG]Alliance`. The points are the anchor: each number with thousands separators is one row.
// A tag line that no points line claims is a row whose number was not read.
// Pure; the lines come from read-screenshot.ts or from a recording.
import {
  flagsOf,
  inferRanks,
  keptRowCount,
  lastWord,
  readRank,
  type RowFlag,
  separatedCount,
  toCount,
} from "./ranking";

export interface DuelScreen {
  /** The tab the picture shows: one server day (`day` says which) or the game week. */
  scope: "daily" | "weekly";
  day?: string;
}

export interface DuelRow extends DuelScreen {
  /** From the row's place in the list, so medal rows have one; null when no rank was read on the page. */
  rank: number | null;
  /** "" when the name line was not read. */
  name: string;
  /** The alliance tag as read; "" when the tag line was not read. */
  tag: string;
  /** null when the number was not read (the row has the flag `points`). */
  points: number | null;
  flags: RowFlag[];
}

/** `[OGs]Alliance`, `(OGs]Alliance` and the like: the brackets are often misread. A bracketed word with no alliance after it is an icon. */
const TAG = /[[({]\s*([A-Za-z0-9]{1,6})\s*[\])}](?=[A-Za-z0-9])/;
/** Lines after the points line where the tag line may be. */
const TAG_REACH = 3;

interface Found {
  /** The line the row is placed by: its points line, or its tag line when the points were not read. */
  at: number;
  read: number | null;
  name: string;
  tag: string;
  points: number | null;
}

const isNameLine = (line: string | undefined): line is string =>
  line !== undefined && !TAG.test(line) && separatedCount(line) === null;

/** The name on the line above `at` when it has one; else a name written on the points line itself. */
function nameBefore(lines: readonly string[], at: number, prefix: string): string {
  const above = lines[at - 1];
  const nameAbove = isNameLine(above) ? lastWord(above, 3) : "";
  if (nameAbove !== "") return nameAbove;
  const inline = lastWord(prefix.replace(/^\s*\d{1,3}(?=\s)/, ""), 3);
  return inline !== "" || !isNameLine(above) ? inline : lastWord(above, 2);
}

/** The tag line after a points line, up to the next points line. */
function tagAfter(lines: readonly string[], at: number): { tag: string; at: number } | null {
  for (let next = at + 1; next <= at + TAG_REACH; next++) {
    const line = lines[next];
    if (line === undefined || separatedCount(line) !== null) return null;
    const tag = TAG.exec(line)?.[1];
    if (tag !== undefined) return { tag, at: next };
  }
  return null;
}

/** The rows whose number was read, and the lines of the tags that went with them. */
function numberedRows(lines: readonly string[]): { rows: Found[]; taken: Set<number> } {
  const rows: Found[] = [];
  const taken = new Set<number>();
  lines.forEach((line, at) => {
    const count = separatedCount(line);
    if (!count) return;
    const tag = tagAfter(lines, at);
    if (tag) taken.add(tag.at);
    rows.push({
      at,
      read: readRank(count.prefix),
      name: nameBefore(lines, at, count.prefix),
      tag: tag?.tag ?? "",
      points: toCount(count.text),
    });
  });
  return { rows, taken };
}

/** A tag line that no points line claimed is a row whose number was not read. */
function unreadRows(lines: readonly string[], taken: ReadonlySet<number>): Found[] {
  return lines.flatMap((line, at) => {
    const tag = taken.has(at) ? undefined : TAG.exec(line)?.[1];
    if (tag === undefined) return [];
    const name = [lines[at - 1], lines[at - 2]]
      .filter(isNameLine)
      .map((above) => lastWord(above, 3))
      .find((word) => word !== "");
    return [{ at, read: null, name: name ?? "", tag, points: null }];
  });
}

function findRows(lines: readonly string[]): Found[] {
  const { rows, taken } = numberedRows(lines);
  return [...rows, ...unreadRows(lines, taken)].sort((a, b) => a.at - b.at);
}

/**
 * The rows of one screenshot of the ranking, top to bottom. A row whose number was not read comes
 * back with `points: null`. The pinned row of the viewer's own alliance under the list is dropped,
 * and a row is flagged when its points are above the row before, its rank disagrees with its place,
 * or its rank does not follow the row above.
 */
export function parseAllianceDuelRanking(lines: readonly string[], screen: DuelScreen): DuelRow[] {
  const found = findRows(lines);
  const ranks = inferRanks(found.map((row) => row.read));
  return found.slice(0, keptRowCount(found, ranks, true)).map((row, place) => ({
    ...screen,
    rank: ranks[place] ?? null,
    name: row.name,
    tag: row.tag,
    points: row.points,
    flags: flagsOf(found, ranks, place),
  }));
}
