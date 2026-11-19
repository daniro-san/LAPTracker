// The words of Home's "On the desk now" and "Recent activity" (D108), made on the server in the officer's
// language. Every name and title goes through isolate(), so a right-to-left name cannot reorder the line.
import { fill, isolate } from "../copy";
import { agoText, calendarDates, titleOf } from "./calendar-words";
import {
  COUNTED_RUNS,
  type ActivityItem,
  type ActivityLine,
  type ActivityPage,
} from "./desk-activity";
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

/** A saved draft: a screenshot of some kind, or lines pasted into Members' "Paste updates" (D109). */
function draftLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "draft" }>,
): string {
  if (item.draft.source === "pasted") return fill(t["activity.pasted"], { who });
  const kind = kindLabel(t, item.draft.kind as ImportKind, item.draft.scope as Scope | null);
  return fill(t["activity.draft"], { who, kind });
}

/** Marks in a roll call ("the rest" when one action wrote several), or a roll call deleted or archived. */
function marksLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "marks" | "callDeleted" | "callArchived" }>,
): string {
  const call = callTitle({ ...item.call, kind: item.call.kind as RollKind, placed: null }, t);
  if (item.kind !== "marks") return fill(t[`activity.${item.kind}`], { who, call });
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

const CODE: Record<string, string> = { en: "EN", "pt-BR": "PT", fr: "FR" };

/** A review request or its outcome (D113): to whom (one officer or the team), and which language. */
function reviewLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "reviewAsked" | "reviewAnswered" }>,
): string {
  const title = isolate(item.title);
  const what = item.language ? (CODE[item.language] ?? item.language) : t["notices.review.all"];
  if (item.kind === "reviewAnswered") {
    const key = item.outcome === "approved" ? "activity.reviewApproved" : "activity.reviewEdited";
    return fill(t[key], { who, title, what });
  }
  if (item.reviewer === null) return fill(t["activity.reviewAskedTeam"], { who, title, what });
  return fill(t["activity.reviewAsked"], { who, title, what, reviewer: isolate(item.reviewer) });
}

/** A line about a notice, with its title. */
function noticeLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { title: string }>,
): string {
  if (item.kind === "reviewAsked" || item.kind === "reviewAnswered")
    return reviewLine(t, who, item);
  const title = isolate(item.title);
  if (item.kind === "noticePictureReused") {
    return fill(t["activity.noticePictureReused"], { who, from: isolate(item.from), title });
  }
  return fill(t[`activity.${item.kind}`], { who, title });
}

/** What the officer did, as one sentence, without the time. */
export function activityLine(
  item: ActivityItem,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): string {
  const who = isolate(item.who);
  // Marks, or a roll call deleted or archived (D120).
  if ("call" in item) return marksLine(t, who, item);
  switch (item.kind) {
    case "facts":
      return factsLine(t, who, item);
    case "followUp":
      return followUpLine(t, who, item, language);
    case "draft":
      return draftLine(t, who, item);
    case "entry":
    case "entryEdit":
      return fill(t[`activity.${item.kind}`], { who, entry: isolate(titleOf(item.entry, t)) });
    case "thefts":
    case "newMember":
      return countLine(t, who, item);
    case "thanks":
      return fill(t[`activity.thanks.${item.target}`], { who });
    // The rest is about a notice: saved, posted, deleted (D118), its picture added, kept or used in another
    // notice (D119), or a review request or its outcome (D113).
    default:
      return noticeLine(t, who, item);
  }
}

/** "5 minutes ago", "há 2 horas", "il y a 1 jour"; "just now" under a minute. */
export const activityAgo = (
  at: Date,
  now: Date,
  language: WorkspaceLanguage,
  t: WorkspaceDictionary,
) => agoText(at.toISOString(), now, language, t["calendar.conflict.justNow"]);

const counted = (kind: ActivityItem["kind"]): kind is (typeof COUNTED_RUNS)[number] =>
  (COUNTED_RUNS as readonly string[]).includes(kind);

/**
 * A line of the feed as one sentence. A run of calendar entries, notice saves or screenshots says how many
 * lines it opens to ("Rook added 6 entries to the Calendar"); a run of member saves, thefts or new members
 * says what it holds.
 */
export function feedLine(line: ActivityLine, t: WorkspaceDictionary, language: WorkspaceLanguage) {
  const { item } = line;
  if (line.run.length === 0 || !counted(item.kind)) return activityLine(item, t, language);
  return fill(t[`activity.run.${item.kind}`], { who: isolate(item.who), n: line.run.length });
}

/** One line as the client draws it: its words and time, and a run's own lines (empty for one action). */
export interface ActivityView {
  text: string;
  at: string;
  ago: string;
  run: { text: string; at: string; ago: string }[];
}

/** A page of the feed in the officer's language, made on the server; `next` is the cursor in ms. */
export interface ActivityPageView {
  lines: ActivityView[];
  next: number | null;
}

export function activityView(
  page: ActivityPage,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  now: Date,
): ActivityPageView {
  const when = (at: Date) => ({ at: at.toISOString(), ago: activityAgo(at, now, language, t) });
  return {
    lines: page.lines.map((line) => ({
      text: feedLine(line, t, language),
      ...when(line.item.at),
      run: line.run.map((item) => ({ text: activityLine(item, t, language), ...when(item.at) })),
    })),
    next: page.next?.getTime() ?? null,
  };
}
