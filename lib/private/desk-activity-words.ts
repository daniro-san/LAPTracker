// The words of Home's "On the desk now" and "Recent activity" (D108), made on the server in the officer's
// language. Every name and title goes through isolate(), so a right-to-left name cannot reorder the line.
import { fill, isolate } from "../copy";
import { agoText, calendarDates, titleOf } from "./calendar-words";
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

/** A break's last day: "Nov 24", "24 nov."; Portuguese writes it as officers do, "24/11" (persona panel). */
function breakDay(day: string, language: WorkspaceLanguage): string {
  if (language !== "pt-BR") return calendarDates(language).dayMonth(day);
  const numeric = { day: "2-digit", month: "2-digit", timeZone: "UTC" } as const;
  return new Intl.DateTimeFormat(language, numeric).format(new Date(`${day}T00:00:00Z`));
}

/**
 * A follow-up record names the choice (owner, 2026-11-17): talked, a break with its last day away, needs
 * help, fine. Never the note.
 */
function followUpLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "followUp" }>,
  language: WorkspaceLanguage,
): string {
  const member = isolate(item.member ?? t["activity.aMember"]);
  const key = item.action === "break" && item.until === null ? "breakOpen" : item.action;
  const date = item.until === null ? "" : breakDay(item.until, language);
  return fill(t[`activity.followUp.${key}`], { who, member, date });
}

/** Marks in a roll call: "the rest" when one action wrote several. */
function marksLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "marks" }>,
): string {
  const call = callTitle({ ...item.call, kind: item.call.kind as RollKind, placed: null }, t);
  return fill(t[item.rest ? "activity.marksRest" : "activity.marks"], { who, call });
}

/** Thefts added, or new members added: one named member, or how many (a grouped line). */
function countLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "thefts" | "newMember" }>,
): string {
  if (item.kind === "thefts") {
    return fill(t[`activity.thefts.${item.count === 1 ? "one" : "other"}`], { who, n: item.count });
  }
  const [name] = item.names;
  return item.names.length === 1
    ? fill(t["activity.newMember"], { who, member: isolate(name ?? "") })
    : fill(t["activity.newMembers"], { who, n: item.names.length });
}

/** What the officer did, as one sentence, without the time. */
export function activityLine(
  item: ActivityItem,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): string {
  const who = isolate(item.who);
  switch (item.kind) {
    case "facts":
      return factsLine(t, who, item);
    case "followUp":
      return followUpLine(t, who, item, language);
    case "noticeSaved":
    case "noticePosted":
      return fill(t[`activity.${item.kind}`], { who, title: isolate(item.title) });
    case "draft": {
      const kind = kindLabel(t, item.draft.kind as ImportKind, item.draft.scope as Scope | null);
      return fill(t["activity.draft"], { who, kind });
    }
    case "entry":
    case "entryEdit":
      return fill(t[`activity.${item.kind}`], { who, entry: isolate(titleOf(item.entry, t)) });
    case "marks":
      return marksLine(t, who, item);
    case "thefts":
    case "newMember":
      return countLine(t, who, item);
  }
}

/** "5 minutes ago", "há 2 horas", "il y a 1 jour"; "just now" under a minute. */
export const activityAgo = (
  at: Date,
  now: Date,
  language: WorkspaceLanguage,
  t: WorkspaceDictionary,
) => agoText(at.toISOString(), now, language, t["calendar.conflict.justNow"]);
