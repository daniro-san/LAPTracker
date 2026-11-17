// Several pictures of one long ranking (scrolled pages) as one list (issue 299): each row once, in rank
// order, with the flag `gap` where a rank is missing between two pages. Pure.
import { nameKey } from "./name-key";

export interface PageRow {
  rank: number | null;
  name: string;
  value: number | null;
  /** The parser's flags (RowFlag), as stored. */
  flags: string[];
}

/** The same row read on two pages: the same rank and value, or the same name and value. */
const same = (a: PageRow, b: PageRow) =>
  a.value === b.value &&
  ((a.rank !== null && a.rank === b.rank) ||
    (a.value !== null && nameKey(a.name) !== "" && nameKey(a.name) === nameKey(b.name)));

/**
 * The pages' rows merged: duplicates dropped (pages overlap when scrolled part way), ranked rows in rank
 * order and rows without a rank after them in their pages' order. A rank that does not follow the row
 * before gets `gap`, across pages too.
 */
export function mergePages<R extends PageRow>(pages: readonly (readonly R[])[]): R[] {
  const kept: R[] = [];
  for (const row of pages.flat()) if (!kept.some((k) => same(k, row))) kept.push(row);
  const ranked = kept.filter((r) => r.rank !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const merged = [...ranked, ...kept.filter((r) => r.rank === null)];
  return merged.map((row, i) => {
    const before = merged[i - 1]?.rank ?? null;
    const jump = row.rank !== null && before !== null && row.rank > before + 1;
    return jump && !row.flags.includes("gap") ? { ...row, flags: [...row.flags, "gap"] } : row;
  });
}
