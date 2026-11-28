// One member card's words, made on the server (issues 296, 337): every number and date is formatted here, in
// the officer's language, so the browser only lays strings out. No data is "—", never 0. `memberCard` is the
// read behind GET /api/w/[slug]/members/[uid]: one member of the workspace's own alliance, no photo read.
// Issue 461 (D136): a header (status, the stat strip, languages, where they came from) over four tabs:
// Overview (reasons, the last 7 days, might since, this week's Alliance Duel), Info (facts and details),
// Squads (D117) and History (follow-up notes, earlier values). Issue 516: the Follow-up block (card-follow-up.ts).
// Issue 634: the Raid Shield block (card-shield.ts), from Friday's night check until KvK starts.
import { compactLarge } from "../compact";
import { dateWords } from "../date-words";
import type { Db } from "../db";
import { factHistory, type FactRow } from "../repo/member-facts";
import { gameLanguageReads } from "../repo/player-reads";
import { endOfDayReads } from "../repo/workspace-rosters";
import { fill } from "../words";
import type { WorkspaceAccess } from "./access";
import { cardBuddy, type CardBuddy } from "./buddy";
import { dayIn } from "./calendar-time";
import { cardFollowUp, type CardFollowUp } from "./card-follow-up";
import { cardShield, type CardShield } from "./card-shield";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";
import type { CardTab } from "./dictionary.card";
import {
  FACT_FIELDS,
  type FactField,
  type FactSource,
  type FactValues,
  type MemberFacts,
} from "./fact-fields";
import { factText, NONE } from "./fact-text";
import { cardBase, lastTwo, TREND_FIELDS, type Progress, type TrendField } from "./fact-trend";
import { followUpsOf, helpMarksOf } from "./follow-up";
import { historyLine, markLines } from "./follow-up-rules";
import { cardLink, type CardLink } from "./me-link";
import { daysFormats, duelText, quietDayLine, toAskLine, versionLines } from "./member-card-parts";
import {
  allianceBest,
  daysCard,
  lastDays,
  LAST_DAYS,
  type DaysCard,
  type LastDays,
} from "./member-days";
import { memberOrigin } from "./member-origin";
import { squadsCard, type SquadsCard } from "./member-squads";
import { DAY_MS } from "./member-week";
import { membersView, type MemberRow } from "./members";
import {
  breakText,
  missingText,
  reasonText,
  statusOf,
  type Formats,
  type Status,
} from "./members-sheet";
import { NOTICE_LANGUAGE_DAYS } from "./notice-languages";
import { messageLanguage } from "./ready-message";
import { cardSelfReport, type CardSelfReport } from "./self-report";
import { trendOf, type Previous, type WeekBase } from "./trend-words";

const exact = (n: number, language: string) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(Math.abs(n));
/** 61.2M (D78); below 1,000 the plain integer. */
const compact = (n: number, language: string) =>
  Math.abs(n) < 1000 ? exact(n, language) : compactLarge(n, language);

export interface CardFormats extends Formats {
  /** 61.2M, 61,2M (D78). */
  compact: (n: number) => string;
  /** When the page is made: a time zone's offset is shown as of now. */
  now: Date;
}

/** One member fact as the opened card shows it, with where it came from. */
export interface FactLine {
  field: FactField;
  label: string;
  value: string;
  source: FactSource | null;
  /** Main squad and AD Tech (D109): "+0.4M since Tue, Nov 10", "was 69%", or "complete" at 100 %. */
  change?: string;
  /** Main squad and AD Tech: "Updated Tue, Nov 17", plain information, never a warning (D109). */
  updated?: string;
}

/** The line "Game language: {name} (read {date})": the browser fills `{name}` from the language's own name. */
export interface CardGameLanguage {
  /** The line's words with `{name}` and `{date}` still to fill. */
  line: string;
  /** The language the notices are written in, or null: shown as `other`. */
  language: WorkspaceLanguage | null;
  other: string;
  date: string;
}

export interface CardData {
  uid: number;
  name: string;
  rank: string;
  /** Might · Main squad · Kills · Sanctuary; the game's terms are not translated by the browser. */
  facts: { text: string; game: boolean }[];
  /** The languages they speak, as codes ("EN", "PT"), for the header's chips. */
  languages: string[];
  /** "Came from [TAG] Name · joined us Wed, Nov 18", "Before that: …", or "Came from: not known". */
  origin: string[];
  status: Status;
  /** Empty for Fine and for "No data" (missing data is "—" in its own place, never a headline, #461). */
  statusLabel: string;
  /** Under "Needs help": since when, who added it and their note in quotes (#585 S2), set by memberCard. */
  statusMark: string[];
  /** The reasons with their evidence, or when a new member was first seen. */
  statusLines: string[];
  /** Issue 821: "Last seen in game: …" and "In the alliance since: …"; "no data" with no reading. */
  presence: string[];
  /** "No data": the name of the marker drawn where a value is "—". */
  noData: string;
  /** The last 7 days; null before the alliance's first end-of-day read (`daysEarly` says so). */
  days: DaysCard | null;
  daysEarly: string;
  /** This week's Alliance Duel from screenshots (issue 299), when any was saved this week. */
  duel: { label: string; value: string } | null;
  details: { label: string; value: string }[];
  /** Map position, behind "Show map position" on the Info tab. */
  map: { label: string; value: string; show: string };
  /** "Still to ask: time zone, languages"; null when every fact is recorded. */
  toAsk: string | null;
  /** The earlier value of each fact, newest first: "Main squad might: 18.1M · Tue, Nov 10". */
  versions: { head: string; lines: string[]; none: string };
  tabs: { label: string; names: Record<CardTab, string> };
  dates: { show: string; hide: string };
  factLines: FactLine[];
  /** The member facts as stored, with their versions, for the editor. */
  stored: MemberFacts;
  /** The status shown when no officer sets one ("Check in", "Fine" …), for the editor's Automatic. */
  autoStatus: string;
  /** The officers' follow-ups (issue 340), newest first: "Talked Mon 16 Nov: … · Ana". */
  followUps: {
    head: string;
    lines: string[];
    /** Each line's record, for its Delete (D123 phase 2). */
    ids: number[];
    words: Pick<WorkspaceDictionary, (typeof DELETE_KEYS)[number]>;
  };
  /** The squads the tracker saw (D117); set by memberCard. */
  squads?: SquadsCard;
  /** D142: who on Discord says they are this member, and whether an officer still has to approve it. */
  link?: CardLink | null;
  /** Issue 516: this week's follow-up and the ready message; null while the Follow-up tab is off. */
  followUp?: CardFollowUp | null;
  /** Issue 828: the buddy an officer named, and the list to pick one from. */
  buddy?: CardBuddy;
  /** Issue 634: the Raid Shield block, from Friday's night check until KvK starts; null otherwise. */
  shield?: CardShield | null;
  /** Issue 814: the game's language from the newest own-alliance read; null with no read (D75). */
  gameLanguage?: CardGameLanguage | null;
  /** D154: what the member sent about themselves from their own link; null when nothing to show. */
  selfReport?: CardSelfReport | null;
}

/** Server days as dates in the officer's language; instants in server time (help.servertime). */
export function cardFormats(
  language: WorkspaceLanguage,
  zone: string,
  now: Date,
): CardFormats & { time: (at: Date) => string } {
  const words = dateWords(language, zone);
  return {
    date: words.day,
    number: (n) => exact(n, language),
    compact: (n) => compact(n, language),
    time: words.at,
    language,
    zone,
    now,
  };
}

export const or = (v: number | null, as: (n: number) => string) => (v === null ? NONE : as(v));

/** The member's status, its label and the lines under it (the reasons with their evidence …). */
export function statusParts(m: MemberRow, t: WorkspaceDictionary, f: Formats) {
  const status = statusOf(m);
  if (status === "checkin" || status === "help") {
    const label = t[status === "help" ? "status.help" : "status.checkin"];
    return { status, label, lines: m.reasons.map((r) => reasonText(r, t, f)) };
  }
  if (status === "break") {
    const note = m.facts.away?.value?.text;
    return { status, label: breakText(m, t, f), lines: note ? [note] : [] };
  }
  if (status === "none") return { status, label: "", lines: [] };
  if (status === "new") {
    const seen = m.seenSince ? [fill(t["members.firstSeen"], { date: f.date(m.seenSince) })] : [];
    return { status, label: t["members.new"], lines: seen };
  }
  const label = status === "nodata" ? missingText(m, t, f) : t["status.fine"];
  return { status, label, lines: quietDayLine(m, t, f) };
}

/** What the card shows only when someone has it. Joined and Last seen are header lines (issue 821). */
export interface Shown {
  /** Alliance Duel points were saved from a photo for someone this week (issue 299). */
  duel: boolean;
}

export const shownOf = (members: MemberRow[]): Shown => ({
  duel: members.some((m) => Object.keys(m.duel).length > 0),
});

function detailsOf(m: MemberRow, t: WorkspaceDictionary, f: CardFormats) {
  return [{ label: t["sheet.seen"], value: m.seenSince ? f.date(m.seenSince) : NONE }];
}

/** Map position, shown on the Info tab only after "Show map position" (D136: D71 allows it, people first). */
const mapOf = (m: MemberRow, t: WorkspaceDictionary) => ({
  label: t["sheet.map"],
  value:
    m.mapX === null || m.mapY === null ? NONE : fill(t["sheet.mapValue"], { x: m.mapX, y: m.mapY }),
  show: t["card.info.showMap"],
});

/**
 * The facts with their value; Status only when an officer set one (otherwise the card's status says it).
 * Main squad and AD Tech also carry the day they were saved and, with `previous`, the change (D109).
 */
export function factLines(
  facts: MemberFacts,
  t: WorkspaceDictionary,
  f: CardFormats,
  previous?: Previous,
  week?: WeekBase,
): FactLine[] {
  const text = { language: f.language, now: f.now, day: (iso: string) => f.date(iso), words: t };
  return FACT_FIELDS.filter((field) => field !== "status" || facts.status?.value).map(
    <F extends FactField>(field: F) => {
      const fact = facts[field];
      const value = fact?.value as FactValues[F] | null | undefined;
      const known = value !== null && value !== undefined;
      const line: FactLine = {
        field,
        label: t[`facts.${field}`],
        value: factText(field, value, text),
        source: known ? (fact?.source ?? null) : null,
      };
      if (!known || !isTrend(field)) return line;
      const compared = { before: previous?.[field], week: week?.[field] };
      return { ...line, ...trendOf(field, value as number, fact?.at, compared, t, f) };
    },
  );
}

/**
 * What a thanks line says after the name (D109), with no number and no ranking: "finished AD Tech",
 * "grew their main squad", or both.
 */
export function progressText(p: Progress, t: WorkspaceDictionary): string {
  if (p.adDone && p.squadGrowth !== null) return t["thanks.both"];
  return p.adDone ? t["thanks.adDone"] : t["thanks.squadUp"];
}

/** The words of a follow-up note's Delete and its Undo in the History tab (D123 phase 2). */
const DELETE_KEYS = [
  "card.followup.delete",
  "card.followup.deleteName",
  "card.followup.deleteAsk",
  "card.followup.deleteWhere",
  "card.followup.deleting",
  "card.followup.keep",
  "card.followup.deleted",
  "card.followup.deleteFailed",
  "card.followup.deleteUndoFailed",
  "followup.undo",
] as const satisfies readonly WorkspaceKey[];

const isTrend = (field: FactField): field is TrendField =>
  (TREND_FIELDS as readonly string[]).includes(field);

/** What the card adds to the member's row: read by `memberCard`; none in a bare `cardData`. */
export interface CardExtras {
  followUps: { id: number; line: string }[];
  previous: Previous;
  thisWeek: WeekBase;
  days: LastDays | null;
  origin: string[];
  /** Every version of the member's facts, oldest first per field. */
  history: readonly FactRow[];
}

const NO_EXTRAS: CardExtras = {
  followUps: [],
  previous: {},
  thisWeek: {},
  days: null,
  origin: [],
  history: [],
};

/** The header shows a status only when it says something: not Fine, and not "No data" (#461). */
const HEADLINE: readonly Status[] = ["checkin", "help", "break", "new"];

/** Issue 821: "Last seen in game" and "In the alliance since", "no data" with no reading. */
function presenceLines(m: MemberRow, t: WorkspaceDictionary, f: CardFormats) {
  const date = (at: Date | null) => (at ? f.date(at) : t["members.don.none"]);
  return [
    fill(t["card.lastSeen"], { date: date(m.lastOnlineAt) }),
    fill(t["card.since"], { date: date(m.joinedAt) }),
  ];
}

export function cardData(
  m: MemberRow,
  t: WorkspaceDictionary,
  f: CardFormats,
  shown: Shown,
  x: CardExtras = NO_EXTRAS,
): CardData {
  const { status, label, lines } = statusParts(m, t, f);
  const headline = HEADLINE.includes(status);
  const squad = m.facts.squadMight?.value ?? null;
  const duel = { label: `${t["shots.duel.card"]} · ${t["src.photo"]}`, value: duelText(m, t, f) };
  return {
    uid: m.uid,
    name: m.name,
    rank: m.rank ?? NONE,
    facts: [
      { game: true, text: fill(t["members.meta.might"], { v: or(m.might, f.compact) }) },
      { game: false, text: fill(t["card.strip.squad"], { v: or(squad, f.compact) }) },
      { game: true, text: fill(t["list.meta.kills"], { v: or(m.kills, f.compact) }) },
      { game: true, text: fill(t["members.meta.level"], { n: or(m.sanctuary, String) }) },
    ],
    languages: (m.facts.languages?.value ?? []).map((code) => code.toUpperCase()),
    origin: x.origin,
    status,
    statusLabel: headline ? label : "",
    statusMark: [],
    presence: presenceLines(m, t, f),
    statusLines: headline ? lines : [],
    noData: t["nodata.mark"],
    days: x.days ? daysCard(x.days, t, daysFormats(t, f)) : null,
    daysEarly: t["card.days.early"],
    duel: shown.duel ? duel : null,
    details: detailsOf(m, t, f),
    map: mapOf(m, t),
    toAsk: toAskLine(m.facts, t),
    factLines: factLines(m.facts, t, f, x.previous, x.thisWeek),
    stored: m.facts,
    autoStatus: statusParts({ ...m, officerStatus: null }, t, f).label || NONE,
    followUps: {
      head: t["followup.cardHead"],
      lines: x.followUps.map((r) => r.line),
      ids: x.followUps.map((r) => r.id),
      words: Object.fromEntries(
        DELETE_KEYS.map((k) => [k, t[k]]),
      ) as CardData["followUps"]["words"],
    },
    versions: {
      head: t["card.history.versions"],
      lines: versionLines(x.history, t, f),
      none: t["card.history.none"],
    },
    tabs: {
      label: t["card.tabs"],
      names: {
        overview: t["card.tab.overview"],
        info: t["card.tab.info"],
        squads: t["card.tab.squads"],
        history: t["card.tab.history"],
      },
    },
    dates: { show: t["card.info.dates"], hide: t["card.info.hideDates"] },
  };
}

/** The card's last 7 days; donations drawn against the alliance's best member-day in them (D158). */
function cardDays(reads: Parameters<typeof lastDays>[0], uid: number): LastDays | null {
  const days = lastDays(reads, uid);
  return days && { ...days, best: allianceBest(reads, days.days) };
}

/** One member's card in `language`, or null when the uid is not in the workspace's own alliance. */
export async function memberCard(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  at: { now: Date; zone: string; language: WorkspaceLanguage; t: WorkspaceDictionary },
): Promise<CardData | null> {
  const [view, followUps, history, reads] = await Promise.all([
    membersView(db, access, at.now, at.zone),
    followUpsOf(db, access, uid),
    factHistory(db, access.workspaceId, FACT_FIELDS, uid),
    // One read more: the first day's quest points are its running total less the day before's (#739).
    endOfDayReads(db, access.unionId, LAST_DAYS + 1),
  ]);
  const member = view.members.find((m) => m.uid === uid);
  if (!member) return null;
  const f = cardFormats(at.language, at.zone, at.now);
  const previous = Object.fromEntries(
    TREND_FIELDS.map((field) => [field, lastTwo(history, uid, field)?.before ?? null]),
  );
  // This game week, or on a Monday the week the thanks cover (D114).
  const today = dayIn(at.zone, at.now.getTime());
  const thisWeek = Object.fromEntries(
    TREND_FIELDS.map((field) => [field, cardBase(history, uid, field, today, at.zone)]),
  );
  const [squads, origin, link, followUp, marks, shield, selfReport, game] = await Promise.all([
    squadsCard(db, access, uid, at.t, f),
    memberOrigin(db, access, uid, at.zone, at.t, f.date),
    cardLink(db, access, uid, at.t),
    cardFollowUp(db, access, member, followUps, view.reads, at, f.date),
    // Follow-up's own rule, read only while the status is Needs help (#585 S2), on the records read above.
    helpMarksOf(
      db,
      access.workspaceId,
      member.officerStatus === "help" ? [uid] : [],
      [...followUps].reverse(),
    ),
    cardShield(db, access, member, at),
    cardSelfReport(db, access, uid, member.facts, at.t, f),
    gameLanguageReads(
      db,
      access.unionId,
      [uid],
      new Date(at.now.getTime() - NOTICE_LANGUAGE_DAYS * DAY_MS),
    ),
  ]);
  const read = game.get(uid);
  const gameLanguage: CardGameLanguage | null = read
    ? {
        line: at.t["card.gameLanguage"],
        language: messageLanguage([read.language]),
        other: at.t["notices.langs.other"],
        date: f.date(read.readAt),
      }
    : null;
  const card = cardData(member, at.t, f, shownOf(view.members), {
    followUps: followUps.map((row) => ({
      id: row.id,
      line: historyLine(row, at.t, f.date, f.date),
    })),
    previous,
    thisWeek,
    days: cardDays(reads, uid),
    origin,
    history,
  });
  const mark = marks.get(uid);
  const statusMark = mark ? markLines(mark, at.t, f.date) : [];
  const buddy = cardBuddy(member, view.members, at.t);
  return { ...card, statusMark, squads, link, followUp, shield, selfReport, gameLanguage, buddy };
}
