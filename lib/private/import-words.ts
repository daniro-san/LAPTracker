// The import's words built from the dictionary (issue 299): a kind with its tab ("Alliance Duel weekly"),
// counted phrases, and the lines the Discord reply shows for one send.
import { fill } from "../copy";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import type { DraftSummary, Outcome } from "./import";
import type { ImportKind, Scope } from "./import-kinds";

export function kindLabel(t: WorkspaceDictionary, kind: ImportKind, scope: Scope | null): string {
  const name = t[`import.kind.${kind}`];
  return scope
    ? fill(t["import.kindScope"], { kind: name, scope: t[`import.scope.${scope}`] })
    : name;
}

type Counted =
  "import.rows" | "import.doubtful" | "import.notFound" | "import.leftOut" | "import.lost";

/** "8 rows", "1 doubtful": the plural form of the officer's language. */
export function counted(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  key: Counted,
  n: number,
): string {
  const form = new Intl.PluralRules(language).select(n) === "one" ? "one" : "other";
  return fill(t[`${key}.${form}`], { n });
}

/** "8 rows, 1 doubtful": the rows of a draft and the ones that need a person. */
export function draftCounts(t: WorkspaceDictionary, language: WorkspaceLanguage, d: DraftSummary) {
  return [
    counted(t, language, "import.rows", d.rows),
    ...(d.doubtful > 0 ? [counted(t, language, "import.doubtful", d.doubtful)] : []),
    ...(d.notFound > 0 ? [counted(t, language, "import.notFound", d.notFound)] : []),
  ].join(", ");
}

/** What one picture that made no draft says; null for a picture that made one. */
export function outcomeText(t: WorkspaceDictionary, outcome: Outcome): string | null {
  if (outcome.status === "draft") return null;
  if (outcome.status === "unrecognised") return t["import.unrecognised"];
  if (outcome.status === "map") return t["import.map"];
  const what = kindLabel(t, outcome.kind, null);
  return fill(t[outcome.status === "soon" ? "import.soon" : "import.empty"], { what });
}

/**
 * The Discord reply for one send: "Read: Alliance Duel weekly, 8 rows, 1 doubtful → Review" per draft,
 * with a link to it, then one line for each other result (not recognised, a map, coming soon).
 */
export function outcomeLines(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  result: { drafts: DraftSummary[]; outcomes: Outcome[] },
  lost: number,
  review: (id: number) => string,
): string[] {
  const drafts = result.drafts.flatMap((d) => [
    `${fill(t["import.reply.read"], {
      what: kindLabel(t, d.kind, d.scope),
      counts: draftCounts(t, language, d),
    })} → [${t["import.reply.review"]}](${review(d.id)})`,
    ...(d.leftOut > 0 ? [counted(t, language, "import.leftOut", d.leftOut)] : []),
  ]);
  const others = [...new Set(result.outcomes.map((o) => outcomeText(t, o)))].filter(
    (line): line is string => line !== null,
  );
  return [...drafts, ...others, ...(lost > 0 ? [counted(t, language, "import.lost", lost)] : [])];
}
