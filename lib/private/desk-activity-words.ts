// The words of Home's "On the desk now" and "Recent activity" (D108), made on the server in the officer's
// language. Every name and title goes through isolate(), so a right-to-left name cannot reorder the line.
import { fill, isolate } from "../copy";
import { agoText, titleOf } from "./calendar-words";
import type { ActivityItem } from "./desk-activity";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";
import type { ImportKind, Scope } from "./import-kinds";
import { kindLabel } from "./import-words";
import type { RollKind } from "./roll-call-rules";
import { callTitle } from "./roll-call-words";

/** "Ana, Wren and Rook" in the officer's language. */
export function namesList(names: string[], language: WorkspaceLanguage): string {
  return new Intl.ListFormat(language, { type: "conjunction" }).format(names.map(isolate));
}

/** A line about one member, or about "a member" when the name is not known (a former member). */
function aboutMember(
  t: WorkspaceDictionary,
  who: string,
  member: string | null,
  keys: readonly [WorkspaceKey, WorkspaceKey],
): string {
  return member === null
    ? fill(t[keys[1]], { who })
    : fill(t[keys[0]], { who, member: isolate(member) });
}

/** A save of member facts; a batch (a sheet import) names how many members, not who. */
function factsLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "facts" }>,
): string {
  if (item.members > 1) return fill(t["activity.factsMany"], { who, n: item.members });
  return aboutMember(t, who, item.member, ["activity.facts", "activity.factsSomeone"]);
}

/** What the officer did, as one sentence, without the time. */
export function activityLine(item: ActivityItem, t: WorkspaceDictionary): string {
  const who = isolate(item.who);
  switch (item.kind) {
    case "facts":
      return factsLine(t, who, item);
    case "followUp":
      return aboutMember(t, who, item.member, ["activity.followUp", "activity.followUpSomeone"]);
    case "noticeSaved":
    case "noticePosted":
      return fill(t[`activity.${item.kind}`], { who, title: isolate(item.title) });
    case "draft": {
      const kind = kindLabel(t, item.draft.kind as ImportKind, item.draft.scope as Scope | null);
      return fill(t["activity.draft"], { who, kind });
    }
    case "entry":
      return fill(t["activity.entry"], { who, entry: isolate(titleOf(item.entry, t)) });
    case "marks": {
      const call = callTitle({ ...item.call, kind: item.call.kind as RollKind, placed: null }, t);
      return fill(t[item.rest ? "activity.marksRest" : "activity.marks"], { who, call });
    }
    case "thefts":
      return fill(t[`activity.thefts.${item.count === 1 ? "one" : "other"}`], {
        who,
        n: item.count,
      });
    case "newMember":
      return fill(t["activity.newMember"], { who, member: isolate(item.name) });
  }
}

/** "5 minutes ago", "há 2 horas", "il y a 1 jour"; "just now" under a minute. */
export const activityAgo = (
  at: Date,
  now: Date,
  language: WorkspaceLanguage,
  t: WorkspaceDictionary,
) => agoText(at.toISOString(), now, language, t["calendar.conflict.justNow"]);
