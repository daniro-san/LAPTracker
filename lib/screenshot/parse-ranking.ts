// The Might Ranking screens as OCR text lines (D74, issue 299): Might, Kills and Donation (daily and
// weekly) share one layout, "Rank · Doctor · value". A row is one line, `rank … name value`, with the
// member's R-badge on a line of its own just above it. Lines above the column header (the title, the
// tabs, the phone's status bar) are not rows. Pure.
import {
  endCount,
  flagsOf,
  inferRanks,
  keptRowCount,
  lastWord,
  placeRanks,
  readRank,
  type RowFlag,
  toCount,
} from "./ranking";

export interface RankingRow {
  /** Inferred from the read ranks (see inferRanks); null when no rank was read on the page. */
  rank: number | null;
  /** The alliance rank the badge shows, 1 to 5; null when the badge text was not read. */
  rankBadge: number | null;
  name: string;
  /** Might, kills or contribution; null when the number was not read (the row has the flag `points`). */
  value: number | null;
  flags: RowFlag[];
}

/** `R3`, `R2 |`, `R3N`: an R and one or two characters, as a whole word. `Rank` is not one. */
const BADGE = /^R([A-Za-z0-9]{1,2})(?![A-Za-z0-9])/;
/** The column header: `Rank Doctor Contribution`, `Rank Doctor Might`, `Rank Doctor Kills`. */
const HEADER = /\bRank\b.*\b(?:Doctor|Contribution|Might|Kills)\b/i;
/** OCR noise around a row: frame edges read as `|`, `[`, `]`, `©`. */
const EDGES = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const RANK_AT_START = /^\s*\d{1,3}(?=\s)/;

interface Found {
  read: number | null;
  rankBadge: number | null;
  name: string;
  points: number | null;
}

/** A name after the rank on a line that has no number: a row whose value was not read. */
function unreadName(line: string): string {
  return readRank(line) === null ? "" : lastWord(line.replace(RANK_AT_START, ""), 3);
}

/** The lines after the column header, without the noise at their ends; all lines when no header was read. */
function listLines(lines: readonly string[]): string[] {
  const header = lines.findLastIndex((line) => HEADER.test(line));
  return lines
    .slice(header + 1)
    .map((line) => line.replace(EDGES, ""))
    .filter((line) => line !== "");
}

function findRows(lines: readonly string[]): Found[] {
  const found: Found[] = [];
  let badge: number | null = null;
  for (const line of listLines(lines)) {
    const badgeText = BADGE.exec(line)?.[1];
    if (badgeText !== undefined) {
      badge = /^[1-5]/.test(badgeText) ? Number(badgeText[0]) : null;
      continue;
    }
    const count = endCount(line);
    const name = count ? lastWord(count.prefix.replace(RANK_AT_START, ""), 2) : unreadName(line);
    if (name === "") continue;
    found.push({
      read: readRank(count?.prefix ?? line),
      rankBadge: badge,
      name,
      points: count ? toCount(count.text) : null,
    });
    badge = null;
  }
  return found;
}

/**
 * The rows of one screenshot, top to bottom. The viewer's own row pinned under the list is dropped
 * (it repeats a listed row, or belongs to another page). A row whose value was not read comes back
 * with `value: null`. A row is flagged when its value is above the row before, its read rank
 * disagrees with the inferred one, or a row seems to be missing above it.
 */
export function parseRanking(lines: readonly string[]): RankingRow[] {
  const found = findRows(lines);
  const kept = found.slice(0, keptRowCount(found, placeRanks(found.map((row) => row.read))));
  const ranks = inferRanks(kept.map((row) => row.read));
  return kept.map((row, place) => ({
    rank: ranks[place] ?? null,
    rankBadge: row.rankBadge,
    name: row.name,
    value: row.points,
    flags: flagsOf(kept, ranks, place),
  }));
}
