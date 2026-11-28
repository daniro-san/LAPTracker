// The Secret Operations report ("Rapport d'Opération secrète") as OCR text lines (D74, issues 299,
// 321). An entry is `[TAG]name` (with the time at the end of the line for a theft), the sentence
// that says what the player did, and the time `MM-DD HH:MM` (server time). Pure.
//
// The French sentences come from screenshots; the English and Portuguese ones are NOT verified
// against the game: they are built from the French structure (the verb, then "your quest
// rewards"), so check them against a real report before relying on them.
import { nameKey } from "./name-key";

export interface SecretOpsEntry {
  /** null when no sentence under the name was readable: a person has to say which it is. */
  kind: "theft" | "help" | null;
  /** "" when the bracket after the tag was not read (`[YRTrolabeth`). */
  tag: string;
  name: string;
  /** `MM-DD HH:MM`, server time; null when the time was not read. */
  at: string | null;
  /** The line the player was read from, for a person to check. */
  raw: string;
}

/** "a dérobé vos récompenses de quête" / "stole your quest rewards" / "roubou suas recompensas de missão". OCR drops accents. */
const THEFT = /d.rob|\bstole|\bstolen|\broub/i;
/** "vous a aidé à obtenir vos récompenses" / "helped you get your quest rewards" / "ajudou você a obter suas recompensas". */
const HELP = /\baid|\bhelp|\bajud/i;
const START = /\[\s*[^\]})\s[]/;
const CLOSER = /^[^\]})\s[]{1,8}?[\]})]/;
const TIME = /(\d{2})-(\d{2})\s?(\d{2}):(\d{2})/;

function timeOf(text: string): string | null {
  const m = TIME.exec(text);
  if (!m) return null;
  const [month, day, hour, minute] = m.slice(1).map(Number) as [number, number, number, number];
  const valid = month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour < 24 && minute < 60;
  return valid ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : null;
}

/** `tag` and `name` of a line that starts at its `[`: the name is the first word after the closing bracket. */
function whoOf(line: string): { tag: string; name: string } {
  const after = line.slice(line.indexOf("[") + 1);
  const closer = CLOSER.exec(after);
  if (!closer) return { tag: "", name: after.trim().split(/\s+/)[0] ?? "" };
  const tag = closer[0].slice(0, -1);
  return { tag, name: after.slice(closer[0].length).trim().split(/\s+/)[0] ?? "" };
}

function kindOf(sentence: string): SecretOpsEntry["kind"] {
  if (THEFT.test(sentence)) return "theft";
  return HELP.test(sentence) ? "help" : null;
}

/**
 * Entries in the order shown, newest first in the game. An entry with no readable sentence (cut off at
 * an edge) has `kind: null`, and a person says which it is. A bracket with no readable name, no sentence
 * and no time is OCR noise, not an entry.
 */
export function parseSecretOpsReport(lines: readonly string[]): SecretOpsEntry[] {
  const starts = lines.flatMap((line, at) => (START.test(line) ? [at] : []));
  return starts.flatMap((from, n) => {
    const line = lines[from] as string;
    const rest = lines.slice(from + 1, starts[n + 1] ?? lines.length);
    const sentence = rest.join("\n");
    const entry = {
      kind: kindOf(sentence),
      ...whoOf(line),
      at: timeOf(line) ?? timeOf(sentence),
      raw: line,
    };
    return entry.kind === null && entry.at === null && nameKey(entry.name) === "" ? [] : [entry];
  });
}
