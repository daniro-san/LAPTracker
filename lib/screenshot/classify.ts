// Which game screen a picture shows, from its OCR text lines (issue 299). It scores, it never guesses:
// each screen has signals (a header, columns, rows of the right shape, the screen's own words), a kind is
// accepted only when its signals reach the threshold and no other kind ties it, and anything below is
// "not recognised". A map is recognised so that it is never read as data. Pure.
import { endCount, separatedCount } from "./ranking";
import type { ScreenshotReader } from "./read-screenshot";

export const SCREEN_KINDS = [
  "alliance_duel",
  "donation",
  "might",
  "kills",
  "secret_ops",
  "member_update",
  "damage_event",
  "undead_mail",
  "elixir_teams",
  "map",
] as const;
export type ScreenKind = (typeof SCREEN_KINDS)[number];

export interface Classified {
  /** null: not recognised. */
  kind: ScreenKind | null;
  /** Rankings with a Daily and a Weekly tab: the one the text points to. */
  scope: "daily" | "weekly" | null;
  /** False when the text cannot tell Daily from Weekly (both tabs read the same); a person confirms. */
  scopeSure: boolean;
  score: number;
}

/** A kind is accepted from this score. */
export const THRESHOLD = 3;

interface Text {
  lines: readonly string[];
  all: string;
}

type Signal = [weight: number, test: (t: Text) => boolean];

const has = (pattern: RegExp) => (t: Text) => pattern.test(t.all);
const count = (t: Text, pattern: RegExp) => t.lines.filter((line) => pattern.test(line)).length;
const rows = (t: Text, find: (line: string) => unknown) =>
  t.lines.filter((line) => find(line) !== null).length;

/** `[OGs]OldGrandmas` under a duel row's name. */
const TAG_LINE = /[[({]\s*[A-Za-z0-9]{1,6}\s*[\])}][A-Za-z0-9]/;
/** The six duel days, as the Daily tab shows them. */
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const dayTabs = (t: Text) => DAYS.filter((d) => new RegExp(`\\b${d}\\b`, "i").test(t.all)).length;
/**
 * `Lv.28 [OGs] Kasoar•Thorne`: a chat sender line, with a message on the line after it. The `Lv` sits
 * on a coloured badge and is often misread (`CIEL. 28`), so the level's dot and digits are enough.
 */
const SENDER = /\.\s?\d{1,2}\b.{0,12}[[({]\s*[A-Za-z0-9]{1,6}\s*[\])}]\s*\S/;
const senders = (t: Text) =>
  t.lines.filter((line, i) => SENDER.test(line) && !SENDER.test(t.lines[i + 1] ?? "")).length;
/**
 * `#325 [OGs] Name`: a city label on the map, the server number before the tag. The `#` and the closing
 * bracket are often lost (`P9325 [ods]`, `4323 (00a`). A number's last group (`14,800,884 [OGs]`) is not one.
 */
const MAP_LABEL = /(?<![\d,.])\d{3,4}\s*[[({]\s*[A-Za-z0-9]{2,4}\s*[\])}]?\s/;
const MIGHT_TITLE = /Might\s+Ranking/i;
const RANKING_COLUMNS = (column: string) =>
  new RegExp(String.raw`\bRank\b.*\bDoctor\b.*\b${column}\b`, "i");

const SIGNALS: Record<ScreenKind, Signal[]> = {
  alliance_duel: [
    [2, has(/\bRank\b.*\bPlayer\b.*\bPoint/i)],
    [1, (t) => count(t, TAG_LINE) >= 2],
    [1, (t) => rows(t, separatedCount) >= 2],
    [1, has(/My\s+Alliance/i)],
    [1, (t) => dayTabs(t) >= 4],
  ],
  donation: [
    [2, has(RANKING_COLUMNS("Contribution"))],
    [1, has(MIGHT_TITLE)],
    [1, has(/\bDonate\b/)],
    [1, (t) => rows(t, endCount) >= 2],
  ],
  might: [
    [2, has(RANKING_COLUMNS("Might"))],
    [1, (t) => rows(t, separatedCount) >= 2],
  ],
  kills: [
    [2, has(RANKING_COLUMNS("Kills"))],
    [1, (t) => rows(t, separatedCount) >= 2],
  ],
  secret_ops: [
    [2, has(/Op[ée]ration\s+secr[èée]te|Secret\s+Op/i)],
    [2, (t) => count(t, /d[ée]rob[ée]|\bstole\b|roubou|vous a aid|helped you|ajudou/i) >= 1],
    [1, (t) => count(t, /\b\d{2}-\d{2}\s?\d{2}:\d{2}\b/) >= 2],
  ],
  member_update: [
    // A chat page shows four to eight messages; a notice shows one or two comments under it.
    [3, (t) => senders(t) >= 3],
    [1, has(/^\s*\W{0,3}\s*Chat\b|Private\s+Chat|\bKingdom\b/im)],
    [1, has(/R4\s?&\s?R5/i)],
    // A notice with comments under it has sender lines too.
    [-3, has(/Notice\s+Details|\bRepost\b/i)],
  ],
  damage_event: [
    [2, has(/Damage\s+Phase/i)],
    [2, has(/MVP\s+Bonus/i)],
  ],
  undead_mail: [
    [3, has(/withstood\s+[\d,]+\s+waves/i)],
    [1, has(/Lv\.?\s?\d+\s+difficulty/i)],
  ],
  elixir_teams: [
    [2, has(/Participants:?\s*\d{1,2}\s*\/\s*20\b/i)],
    [2, (t) => count(t, /\bTeam\s*[AB]\b/) >= 2],
    [1, has(/Elixir/i)],
  ],
  map: [
    [3, (t) => count(t, MAP_LABEL) >= 2],
    // The map's own controls: the minimap button, the resource rates at the top (`0/s 15 8 12 0/s`,
    // the 0 often read as o) and the Mail and Bag buttons.
    [1, has(/\bMap\b/)],
    [1, has(/\b[\do]+\/s\b.*\b[\do]+\/s\b/i)],
    [1, has(/\bMail\b/)],
    [1, has(/\bBag\b/)],
  ],
};

const scoreOf = (kind: ScreenKind, t: Text) =>
  SIGNALS[kind].reduce((sum, [weight, test]) => sum + (test(t) ? weight : 0), 0);

/** Daily or Weekly: the Alliance Duel's Daily tab shows its day tabs; the Might Ranking tabs read the same. */
function scopeOf(kind: ScreenKind, t: Text): Pick<Classified, "scope" | "scopeSure"> {
  if (kind === "alliance_duel") {
    const daily = dayTabs(t) >= 4;
    return { scope: daily ? "daily" : "weekly", scopeSure: daily };
  }
  return kind === "donation"
    ? { scope: "weekly", scopeSure: false }
    : { scope: null, scopeSure: true };
}

/** The screen the lines come from, or `kind: null` when no kind reaches the threshold alone. */
export function classifyScreen(lines: readonly string[]): Classified {
  const t = { lines, all: lines.join("\n") };
  const scored = SCREEN_KINDS.map((kind) => ({ kind, score: scoreOf(kind, t) })).sort(
    (a, b) => b.score - a.score,
  );
  const [best, second] = scored as [(typeof scored)[number], (typeof scored)[number]];
  if (best.score < THRESHOLD || best.score === second.score) {
    return { kind: null, scope: null, scopeSure: true, score: best.score };
  }
  return { kind: best.kind, ...scopeOf(best.kind, t), score: best.score };
}

/** What a picture shows and the lines that told: see `readScreen`. */
export interface ScreenRead {
  lines: string[];
  classified: Classified;
}

/**
 * Reads a picture and classifies it. A picture the first reading does not recognise is read again in
 * plain grey: a map's labels sit on textured terrain that the flattening wipes out, and a map must be
 * recognised so that it never becomes data.
 */
export async function readScreen(
  reader: ScreenshotReader,
  image: Uint8Array,
  options: { statusBar: boolean },
): Promise<ScreenRead> {
  const lines = await reader.read(image, options);
  const classified = classifyScreen(lines);
  if (classified.kind !== null) return { lines, classified };
  const plain = await reader.read(image, { ...options, flatten: false });
  const again = classifyScreen(plain);
  return again.kind === null ? { lines, classified } : { lines: plain, classified: again };
}
