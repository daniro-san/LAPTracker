// The words of Home's "On the desk now" and "Recent activity" (D108), made on the server in the officer's
// language. Every name and title goes through isolate(), so a right-to-left name cannot reorder the line.
import { isolate } from "../copy";
import { fill, plural } from "../words";
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

/** "Wren and Tomas", "Wren, Tomas and Lucien", "Wren, Tomas and 3 others": who finished a roll call. */
function officersList(names: string[], t: WorkspaceDictionary, language: WorkspaceLanguage) {
  if (names.length <= 3) return namesList(names, language);
  const others = fill(t["activity.others"], { n: names.length - 2 });
  const shown = [...names.slice(0, 2).map(isolate), others];
  return new Intl.ListFormat(language, { type: "conjunction" }).format(shown);
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

/**
 * A break's last day: "Nov 24", "24 de nov.", "24 nov.", the same form in every language (issue 585 batch 4:
 * Portuguese wrote "24/11"); no weekday, since French puts an article before it ("jusqu’au 24 nov.").
 */
const breakDay = (day: string, language: WorkspaceLanguage) =>
  calendarDates(language).dayMonth(day);

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
  many = false,
): string {
  const call = callTitle({ ...item.call, kind: item.call.kind as RollKind, placed: null }, t);
  if (item.kind !== "marks") return fill(t[`activity.${item.kind}`], { who, call });
  if (many) return fill(t["activity.marksRestMany"], { who, call });
  return fill(t[item.rest ? "activity.marksRest" : "activity.marks"], { who, call });
}

/** Thefts added, or new members added: one named member, or how many (a grouped line). */
function countLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<ActivityItem, { kind: "thefts" | "newMember" }>,
  language: WorkspaceLanguage,
): string {
  if (item.kind === "thefts") {
    return fill(
      plural(
        item.count,
        { one: t["activity.thefts.one"], other: t["activity.thefts.other"] },
        language,
      ),
      { who, n: item.count },
    );
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

/**
 * The weekly thanks shared or taken down (D114), the tracker key saved or removed (D124), the alliance's
 * data downloaded and its deletion asked or cancelled (D125), a post's own line changed (D156), or a theft,
 * a new member or a follow-up note deleted (D123): a theft's people are never named, a new member's name as
 * typed is, and a follow-up note names whose it was, never its choice or note.
 */
function plainLine(
  t: WorkspaceDictionary,
  who: string,
  item: Extract<
    ActivityItem,
    {
      kind:
        | "thanks"
        | "trackerKey"
        | "workspaceData"
        | "callout"
        | "theftDeleted"
        | "newMemberDeleted"
        | "followUpDeleted";
    }
  >,
): string {
  if (item.kind === "theftDeleted") return fill(t["activity.theftDeleted"], { who });
  if (item.kind === "newMemberDeleted")
    return fill(t["activity.newMemberDeleted"], { who, member: isolate(item.name) });
  if (item.kind === "followUpDeleted") {
    const member = isolate(item.member ?? t["activity.aMember"]);
    return fill(t["activity.followUpDeleted"], { who, member });
  }
  if (item.kind === "thanks") return fill(t[`activity.thanks.${item.target}`], { who });
  if (item.kind === "callout") return fill(t[`activity.callout.${item.post}`], { who });
  if (item.kind === "workspaceData") return fill(t[`activity.data.${item.action}`], { who });
  return fill(t[`activity.key.${item.action}`], { who });
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
  // A Calendar entry added, changed or deleted (D123), or its garrison plan saved or posted (D121).
  if ("entry" in item) {
    return fill(t[`activity.${item.kind}`], { who, entry: isolate(titleOf(item.entry, t)) });
  }
  switch (item.kind) {
    case "facts":
      return factsLine(t, who, item);
    case "followUp":
      return followUpLine(t, who, item, language);
    case "draft":
      return draftLine(t, who, item);
    case "thefts":
    case "newMember":
      return countLine(t, who, item, language);
    case "theftStep":
      return fill(t["activity.theftStep"], { who, state: t[`thefts.state.${item.state}`] });
    // The rest is about a notice: saved, posted, deleted (D118), its picture added, kept or used in another
    // notice (D119), or a review request or its outcome (D113); else the thanks, the tracker key, or a
    // record deleted (D123).
    default:
      return "title" in item ? noticeLine(t, who, item) : plainLine(t, who, item);
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
 * says what it holds; a roll call finished by several officers names each once, newest first (issue 585).
 */
export function feedLine(line: ActivityLine, t: WorkspaceDictionary, language: WorkspaceLanguage) {
  const { item } = line;
  if (item.kind === "marks" && line.run.length > 0) {
    const names = [...new Set(line.run.map((one) => one.who))];
    return marksLine(t, officersList(names, t, language), item, names.length > 1);
  }
  if (line.run.length === 0 || !counted(item.kind)) return activityLine(item, t, language);
  return fill(t[`activity.run.${item.kind}`], { who: isolate(item.who), n: line.run.length });
}

/** One line as the client draws it: its words and time, and a run's own lines (empty for one action). */
export interface ActivityView {
  text: string;
  at: string;
  ago: string;
  run: { text: string; at: string; ago: string }[];
  /**
   * "{who} added {n} new members" (drilldown batch C): the n names, in name order, which its fold shows in
   * place of the run's lines. The same array as the n. Names as typed (D106), with no uid: plain text.
   */
  names?: string[];
}

/** A new members' run's names in the officer's language's name order; undefined for any other line. */
function namesOf(item: ActivityItem, language: WorkspaceLanguage): string[] | undefined {
  if (item.kind !== "newMember" || item.names.length < 2) return undefined;
  const order = new Intl.Collator(language, { numeric: true, ignorePunctuation: true });
  return [...item.names].sort((a, b) => order.compare(a, b));
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
    lines: page.lines.map((line) => {
      const names = namesOf(line.item, language);
      return {
        text: feedLine(line, t, language),
        ...when(line.item.at),
        run: line.run.map((item) => ({ text: activityLine(item, t, language), ...when(item.at) })),
        ...(names && { names }),
      };
    }),
    next: page.next?.getTime() ?? null,
  };
}
