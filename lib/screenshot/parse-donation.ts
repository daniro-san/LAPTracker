// The Donation weekly ranking as OCR text lines (D74, issue 299). A row is one line, `rank … name
// contribution`, with the member's R-badge on a line of its own just above it. Pure.
import {
  endCount,
  flagsOf,
  inferRanks,
  keptRowCount,
  lastWord,
  readRank,
  type RowFlag,
  toCount,
} from "./ranking";

export interface DonationRow {
  /** From the row's place in the list; null when no rank was read on the page. */
  rank: number | null;
  /** The alliance rank the badge shows, 1 to 5; null when the badge text was not read. */
  rankBadge: number | null;
  name: string;
  /** null when the number was not read (the row has the flag `points`). */
  contribution: number | null;
  flags: RowFlag[];
}

/** `R3`, `R2 |`, `R3N`: an R and one or two characters, as a whole word. `Rank` is not one. */
const BADGE = /^R([A-Za-z0-9]{1,2})(?![A-Za-z0-9])/;

interface Found {
  read: number | null;
  rankBadge: number | null;
  name: string;
  points: number | null;
}

/** A name after the rank on a line that has no number: a row whose contribution was not read. */
function unreadName(line: string): string {
  return readRank(line) === null ? "" : lastWord(line.replace(/^\s*\d{1,3}(?=\s)/, ""), 3);
}

function findRows(lines: readonly string[]): Found[] {
  const found: Found[] = [];
  let badge: number | null = null;
  for (const line of lines) {
    const badgeText = BADGE.exec(line)?.[1];
    if (badgeText !== undefined) {
      badge = /^[1-5]/.test(badgeText) ? Number(badgeText[0]) : null;
      continue;
    }
    const count = endCount(line);
    const name = count
      ? lastWord(count.prefix.replace(/^\s*\d{1,3}(?=\s)/, ""), 2)
      : unreadName(line);
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
 * The rows of one screenshot, top to bottom. The pinned row of the viewer's own place under the list
 * is dropped. A row whose contribution was not read (a rank and a name only) comes back with
 * `contribution: null`. A row is flagged when its contribution is above the row before, its rank
 * disagrees with its place, or its rank does not follow the row above.
 */
export function parseDonationRanking(lines: readonly string[]): DonationRow[] {
  const found = findRows(lines);
  const ranks = inferRanks(found.map((row) => row.read));
  return found.slice(0, keptRowCount(found, ranks)).map((row, place) => ({
    rank: ranks[place] ?? null,
    rankBadge: row.rankBadge,
    name: row.name,
    contribution: row.points,
    flags: flagsOf(found, ranks, place),
  }));
}
