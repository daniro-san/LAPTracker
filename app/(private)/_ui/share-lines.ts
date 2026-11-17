// What Home says after a share from the phone (D110), from the share target's redirect query.
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { MAX_PICTURES } from "@/lib/private/import";

/**
 * What became of a share from the phone (D110), from the share target's redirect: `shared=again` (not
 * signed in as an officer), `limit`, `empty`, `busy`, `failed`, or `done` with `made` drafts and `none` pictures that made
 * none. Null for any other visit.
 */
export function sharedLines(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  query: Record<string, string | string[] | undefined>,
): string[] | null {
  const count = (key: string) => Math.min(MAX_PICTURES, Math.max(0, Number(query[key]) || 0));
  const counted = (key: "shots.share.made" | "shots.share.none", n: number) =>
    fill(t[`${key}.${new Intl.PluralRules(language).select(n) === "one" ? "one" : "other"}`], {
      n,
    });
  switch (query.shared) {
    case "again":
      return [t["shots.share.again"]];
    case "limit":
    case "empty":
    case "busy":
    case "failed":
      return [t[`shots.share.${query.shared}`]];
    case "done": {
      const [made, none] = [count("made"), count("none")];
      const lines = [
        ...(made > 0 ? [counted("shots.share.made", made)] : []),
        ...(none > 0 ? [counted("shots.share.none", none)] : []),
      ];
      return lines.length > 0 ? lines : null;
    }
    default:
      return null;
  }
}
