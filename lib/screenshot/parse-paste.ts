// A ranking pasted as text: the phone's "copy text from photo" (iOS Live Text, Android Google Lens)
// instead of the OCR (D74, issue 299). Ported from the validation (docs/handoff/11d-screenshot-reader.md).
// The paste shape is from the validation's transcriptions of three screens; it has not been checked
// on a device. Pure.

export interface PastedRow {
  rank: number | null;
  name: string | null;
  value: number;
}

export interface PastedRanking {
  rows: PastedRow[];
  /** The viewer's own row under the list, when the paste has one. */
  pinned: PastedRow | null;
}

type Line =
  | { k: "skip" }
  | { k: "rank"; v: number }
  | { k: "value"; v: number }
  | { k: "name"; v: string }
  | { k: "row"; rank: number; name: string; v: number };

const HEADER =
  /^(rank|player|doctor|point|points|contribution|daily|weekly|might|kills|donation|might ranking|my alliance|donate|reward|claim|total)$/i;
/** `[OGs]OldGrandmas` alone on a line, or after a name. */
const TAG_LINE = /^\[[^\]]{1,8}\]\s*\S.*$/;
const TAG_TAIL = /\s*\[[^\]]{1,8}\]\s*\S+/g;
const BADGE = /^R[1-5]$/;
/** Digits with the usual O and I look-alikes. */
const NUMBER = /^[\dOoIl][\dOoIl,.\s]*$/;

const toInt = (text: string) =>
  parseInt(text.replace(/[Oo]/g, "0").replace(/[Il]/g, "1").replace(/\D/g, ""), 10);

function classify(line: string): Line {
  const t = line.trim();
  if (!t || HEADER.test(t) || BADGE.test(t) || TAG_LINE.test(t)) return { k: "skip" };
  if (/\d/.test(t) && NUMBER.test(t)) {
    // "174,488,831" or "16500" is a value; ranks are one to three digits without a separator.
    const isValue = /[,.]/.test(t) || t.replace(/\D/g, "").length >= 4;
    return isValue ? { k: "value", v: toInt(t) } : { k: "rank", v: toInt(t) };
  }
  // "4 Lordanirosan 87,244,291" on one line
  const m = /^(\d{1,3})\s+(.+?)\s+([\dOoIl][\dOoIl,.]*[\dOoIl])$/.exec(t.replace(TAG_TAIL, ""));
  if (m)
    return {
      k: "row",
      rank: Number(m[1]),
      name: (m[2] as string).trim(),
      v: toInt(m[3] as string),
    };
  return { k: "name", v: t.replace(TAG_TAIL, "").trim() };
}

/** Row by row (rank, name, value; a value closes the row). */
function rowWise(tokens: readonly Line[]): PastedRow[] {
  const rows: PastedRow[] = [];
  let rank: number | null = null;
  let name: string | null = null;
  for (const t of tokens) {
    if (t.k === "row") {
      rows.push({ rank: t.rank, name: t.name, value: t.v });
      rank = null;
      name = null;
    } else if (t.k === "rank") rank = t.v;
    else if (t.k === "name") name = name ? `${name} ${t.v}` : t.v;
    else if (t.k === "value") {
      rows.push({ rank, name, value: t.v });
      rank = null;
      name = null;
    }
  }
  return rows;
}

/** Column by column (all ranks, then all names, then all values): zipped when the counts agree. */
function columnWise(tokens: readonly Line[]): PastedRow[] | null {
  const ranks = tokens.flatMap((t) => (t.k === "rank" ? [t.v] : []));
  const names = tokens.flatMap((t) => (t.k === "name" ? [t.v] : []));
  const values = tokens.flatMap((t) => (t.k === "value" ? [t.v] : []));
  if (values.length < 2 || names.length !== values.length) return null;
  return values.map((value, i) => ({
    rank: ranks.length === values.length ? (ranks[i] ?? null) : null,
    name: names[i] ?? null,
    value,
  }));
}

/** Medal rows (1 to 3) have no number text: the rank follows from the first row that has one. */
function fillMedalRanks(rows: PastedRow[]): void {
  const first = rows.findIndex((r) => r.rank !== null);
  const firstRank = rows[first]?.rank;
  if (first < 0 || firstRank == null) return;
  rows.forEach((r, i) => {
    if (r.rank === null && i < rows.length - 1) r.rank = firstRank - first + i;
  });
}

/**
 * The pinned own row: the last row, when both ranks are known and the last does not follow the row
 * before, or when its value is above the row before. It is removed from `rows`.
 */
function takePinned(rows: PastedRow[]): PastedRow | null {
  const last = rows.at(-1);
  const before = rows.at(-2);
  if (!last || !before) return null;
  const breaksRank = last.rank !== null && before.rank !== null && last.rank !== before.rank + 1;
  return breaksRank || last.value > before.value ? (rows.pop() ?? null) : null;
}

export function parseRankingPaste(text: string): PastedRanking {
  const tokens = text
    .split(/\r?\n/)
    .map(classify)
    .filter((t) => t.k !== "skip");
  let rows = rowWise(tokens);
  if (rows.length < 2 || rows.filter((r) => r.name).length < rows.length * 0.8)
    rows = columnWise(tokens) ?? rows;
  fillMedalRanks(rows);
  return { rows, pinned: takePinned(rows) };
}
