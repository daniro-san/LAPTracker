// What Home says after a share from the phone (D110), from the share target's redirect query.
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { MAX_PICTURES } from "@/lib/private/import";
import { fill, plural } from "@/lib/words";
import { FREE_SHOTS_A_WEEK } from "@/lib/workspace-features";

/**
 * What became of a share from the phone (D110), from the share target's redirect: `shared=again` (not
 * signed in as an officer), `limit`, `empty`, `busy`, `failed`, `cap` (the free plan's week, D162), or `done` with `made` drafts and `none` pictures that made
 * none. Null for any other visit.
 */
export function sharedLines(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  query: Record<string, string | string[] | undefined>,
): string[] | null {
  const count = (key: string) => Math.min(MAX_PICTURES, Math.max(0, Number(query[key]) || 0));
  switch (query.shared) {
    case "again":
      return [t["shots.share.again"]];
    case "cap":
      return [fill(t["shots.cap"], { n: FREE_SHOTS_A_WEEK })];
    case "limit":
    case "empty":
    case "busy":
    case "failed":
      return [t[`shots.share.${query.shared}`]];
    case "done": {
      const [made, none] = [count("made"), count("none")];
      const lines = [
        ...(made > 0
          ? [
              fill(
                plural(
                  made,
                  { one: t["shots.share.made.one"], other: t["shots.share.made.other"] },
                  language,
                ),
                { n: made },
              ),
            ]
          : []),
        ...(none > 0
          ? [
              fill(
                plural(
                  none,
                  { one: t["shots.share.none.one"], other: t["shots.share.none.other"] },
                  language,
                ),
                { n: none },
              ),
            ]
          : []),
      ];
      return lines.length > 0 ? lines : null;
    }
    default:
      return null;
  }
}
