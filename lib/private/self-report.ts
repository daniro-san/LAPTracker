// What a member tells their officers about themselves (D154, issue 301): their Alliance Duel tech, time zone
// and languages, sent from their own page and kept apart from the officers' member facts (D80) until an
// officer taps "Put on the card". The member's side takes the board's door and an approved link (MeAccess),
// so the uid is the link's and never the request's; the officers' side takes a WorkspaceAccess. Nothing here
// changes a fact, a status or a list by itself (D75), and nothing is logged: a value only reaches the
// member's own page, the member card and the workspace download.
import { z } from "zod";

import { fill } from "../copy";
import type { Db } from "../db";
import { currentCount, recordFailure } from "../repo/auth-attempts";
import { factVersion } from "../repo/member-facts";
import {
  markSeen,
  ownReports,
  reportsOfPlayer,
  selfReportLimitKey,
  sentAlready,
  unseenReports,
  writeReport,
  type ReportField,
  type ReportRow,
} from "../repo/self-reports";
import { anyRoster } from "../repo/workspace-any-roster";
import type { BoardAccess, MeAccess, WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";
import { selfReportCardWords, type SelfReportCardWords } from "./dictionary.self-report";
import { LANGUAGES, type FactValues, type MemberFacts } from "./fact-fields";
import { factText } from "./fact-text";
import { FACT_VALUES, saveMemberFact, type ChangeResult } from "./member-facts";

/** The fields a member may send about themselves; never squad might (the tracker reads it, D117). */
export const REPORT_FIELDS = ["adTech", "timeZone", "languages"] as const satisfies ReportField[];

/** Sends a member may make in a rolling day (a repeat of a stored request id is not one). */
export const SENDS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60_000;
const PG_INT_MAX = 2_147_483_647;

const VALUES = {
  adTech: FACT_VALUES.adTech,
  timeZone: FACT_VALUES.timeZone,
  // An empty list is sent as null (a removal), never as [].
  languages: FACT_VALUES.languages.min(1),
};

const change = <F extends ReportField>(field: F) =>
  z
    .object({
      field: z.literal(field),
      /** The version the member's page showed; 0 when they had sent none. */
      version: z.number().int().min(0).max(PG_INT_MAX),
      value: VALUES[field].nullable(),
    })
    .strict();

/** A member's send: strict, so a `uid` or any other key is refused. */
export const REPORT_SEND = z
  .object({
    requestId: z.uuid(),
    changes: z
      .array(
        z.discriminatedUnion("field", [change("adTech"), change("timeZone"), change("languages")]),
      )
      .min(1)
      .max(REPORT_FIELDS.length)
      .refine((c) => new Set(c.map((x) => x.field)).size === c.length),
  })
  .strict();
export type ReportSend = z.infer<typeof REPORT_SEND>;

/** One field as the member's own page shows it; null when they sent nothing for this player. */
export interface OwnReport {
  version: number;
  value: unknown;
  /** When it was sent (ISO). */
  at: string;
  seen: boolean;
}
export type OwnReports = Record<ReportField, OwnReport | null> & {
  /** The version each field's next send names: also for a row sent for another player before. */
  versions: Record<ReportField, number>;
};

const ordered = (field: ReportField, value: unknown) =>
  field === "languages" && Array.isArray(value)
    ? LANGUAGES.filter((l) => (value as string[]).includes(l))
    : value;

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function ownOf(rows: readonly ReportRow[], uid: number): OwnReports {
  const own = { versions: { adTech: 0, timeZone: 0, languages: 0 } } as OwnReports;
  for (const field of REPORT_FIELDS) {
    const row = rows.find((r) => r.field === field);
    own.versions[field] = row?.version ?? 0;
    // A row sent while linked to another player is not this player's: nothing sent here.
    own[field] =
      row && row.uid === uid
        ? {
            version: row.version,
            value: ordered(field, row.value),
            at: row.writtenAt.toISOString(),
            seen: row.seenVersion >= row.version,
          }
        : null;
  }
  return own;
}

/** The member's own reports for their own linked player, for their page. */
export async function ownReport(db: Db, board: BoardAccess, me: MeAccess): Promise<OwnReports> {
  return ownOf(await ownReports(db, board.workspaceId, board.userId), me.uid);
}

export type SendResult = "left" | "too_many" | { conflict: boolean; reports: OwnReports };

/**
 * Stores the member's changes for their own link's uid, each field named by the version they saw. `left`:
 * the newest roster does not list them. A request id that a field still holds answers the stored state,
 * and stores and counts nothing (D100); an older one, overwritten since, meets versions that moved on, so
 * each field is refused (conflict). A value the same as the one stored for this player is no new send: it
 * keeps its version and stays seen, so a repeat cannot make it "New" for the officers again. Over
 * SENDS_PER_DAY in a day from the first send: `too_many`, nothing stored.
 */
export async function sendReport(
  db: Db,
  board: BoardAccess,
  me: MeAccess,
  input: ReportSend,
  now: Date,
): Promise<SendResult> {
  const roster = await anyRoster(db, me.unionId);
  // INVARIANT self-report.member-only: a member who left sends nothing (as Me closes, D142).
  if (!roster?.members.some((m) => m.uid === me.uid)) return "left";
  const reports = () => ownReport(db, board, me);
  if (await sentAlready(db, board.workspaceId, board.userId, input.requestId))
    return { conflict: false, reports: await reports() };
  const key = selfReportLimitKey(board.userId);
  if ((await currentCount(db, key, DAY_MS, now)) >= SENDS_PER_DAY) return "too_many";
  const before = await reports();
  let conflict = false;
  let wrote = false;
  for (const c of input.changes) {
    const stored = before[c.field];
    // Nothing to take back, or the same value again: no new send.
    if (
      !stored
        ? c.value === null
        : stored.version === c.version && sameValue(stored.value, ordered(c.field, c.value))
    )
      continue;
    const row = {
      workspaceId: board.workspaceId,
      userId: board.userId,
      // INVARIANT self-report.own-uid: the link's uid, never one from the request.
      uid: me.uid,
      field: c.field,
      value: c.value === null ? null : ordered(c.field, c.value),
      requestId: input.requestId,
      writtenAt: now,
    };
    if (await writeReport(db, row, c.version)) wrote = true;
    else conflict = true;
  }
  if (wrote) await recordFailure(db, key, DAY_MS, now);
  return { conflict, reports: await reports() };
}

/** One field of what the member sent, as the card shows it. */
export interface CardReportLine {
  userId: number;
  field: ReportField;
  version: number;
  label: string;
  /** "Member says: 72%", or "Member took back what they sent". */
  says: string;
  /** "Self-reported · Tue, Nov 18". */
  sent: string;
  /** "On the card: 70%" or "On the card: nothing yet". */
  onCard: string;
  same: boolean;
  removed: boolean;
  /** The card's fact version, which "Put on the card" names (D80). */
  factVersion: number;
}

export interface CardSelfReport {
  /** The reports no officer has seen yet, for the header block. */
  unseen: CardReportLine[];
  /** Under a fact on the Info tab: a seen report that is not what the card holds. */
  info: Partial<Record<ReportField, string>>;
  words: SelfReportCardWords;
}

interface CardFormat {
  language: string;
  now: Date;
  date: (at: Date | string) => string;
}

/** One unseen report's line, both values labelled: "Member says: …", "On the card: …". */
function lineOf(
  row: ReportRow,
  fact: MemberFacts[ReportField],
  t: WorkspaceDictionary,
  day: string,
  shown: (field: ReportField, value: unknown) => string,
): CardReportLine {
  const { field } = row;
  const removed = row.value === null;
  return {
    userId: row.userId,
    field,
    version: row.version,
    label: t[`facts.${field}`],
    says: removed
      ? t["self.card.took"]
      : fill(t["self.card.says"], { value: shown(field, row.value) }),
    sent: fill(t["self.card.sent"], { day }),
    onCard:
      fact?.value === null || fact?.value === undefined
        ? t["self.card.onCardNone"]
        : fill(t["self.card.onCard"], { value: shown(field, fact.value) }),
    same: sameValue(ordered(field, row.value), fact?.value),
    removed,
    factVersion: fact?.version ?? 0,
  };
}

/** The member card's block (D154): null when the member has sent nothing from their own link. */
export async function cardSelfReport(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  facts: MemberFacts,
  t: WorkspaceDictionary,
  f: CardFormat,
): Promise<CardSelfReport | null> {
  const rows = await reportsOfPlayer(db, access.workspaceId, uid);
  if (rows.length === 0) return null;
  const text = { language: f.language, now: f.now, day: (iso: string) => f.date(iso), words: t };
  const shown = (field: ReportField, value: unknown) =>
    factText(field, ordered(field, value) as FactValues[typeof field] | null, text);
  const report: CardSelfReport = { unseen: [], info: {}, words: selfReportCardWords(t) };
  for (const row of [...rows].sort(
    (a, b) => REPORT_FIELDS.indexOf(a.field) - REPORT_FIELDS.indexOf(b.field),
  )) {
    const day = f.date(row.writtenAt);
    const line = lineOf(row, facts[row.field], t, day, shown);
    if (row.seenVersion < row.version) report.unseen.push(line);
    // Seen and not what the card holds: said once more under the fact, on the Info tab.
    else if (!line.removed && !line.same)
      report.info[row.field] = fill(t["self.card.info"], {
        value: shown(row.field, row.value),
        day,
      });
  }
  return report.unseen.length > 0 || Object.keys(report.info).length > 0 ? report : null;
}

export type AnswerResult = "ok" | "changed" | "removed" | { conflict: ChangeResult };

/**
 * An officer answers one report as they saw it: that user, that field, that version, while the user holds
 * the approved link to `uid`. "use" puts the member's value on the card (the fact's next version, source
 * `member`, D80's rule on `factVersion`), then marks it seen; "seen" only marks it seen. A removal can only
 * be marked seen.
 */
export async function answerReport(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  input: {
    user: number;
    field: ReportField;
    version: number;
    action: "use" | "seen";
    factVersion?: number;
  },
  now: Date,
): Promise<AnswerResult> {
  const rows = await reportsOfPlayer(db, access.workspaceId, uid);
  const row = rows.find(
    (r) => r.userId === input.user && r.field === input.field && r.version === input.version,
  );
  if (!row) return "changed";
  const report = { userId: row.userId, uid, field: row.field, version: row.version };
  if (input.action === "seen")
    return (await markSeen(db, access.workspaceId, report, access.user.id, now)) ? "ok" : "changed";
  if (row.value === null) return "removed";
  // Refused when any officer saved the fact since the card was read, languages too: D80 would combine
  // languages, and a combined list is a value nobody saw (adversarial review, 2026-11-22).
  const newest = await factVersion(db, access.workspaceId, uid, input.field, "newest");
  const seenVersion = input.factVersion ?? 0;
  if ((newest?.version ?? 0) !== seenVersion && newest)
    return {
      conflict: {
        field: input.field,
        status: "conflict",
        version: newest.version,
        value: newest.value,
        source: newest.source,
      },
    };
  const change = { field: input.field, version: seenVersion, value: row.value };
  const saved = await saveMemberFact(db, access, uid, change, now);
  if (!saved) return "changed";
  if (saved.status === "conflict") return { conflict: saved };
  // On the card now. A send that came in meanwhile stays new (the mark finds nothing): still "ok".
  await markSeen(db, access.workspaceId, report, access.user.id, now);
  return "ok";
}

export interface ReportReview {
  uid: number;
  player: string;
  fields: ReportField[];
}

/** Home's "To review": each member of `members` with an unseen report, once, with its fields. */
export async function reportReviews(
  db: Db,
  access: WorkspaceAccess,
  members: ReadonlyMap<number, string>,
): Promise<ReportReview[]> {
  const byUid = new Map<number, ReportField[]>();
  for (const r of await unseenReports(db, access.workspaceId)) {
    // A member who left the newest roster is not listed (persona panel, 2026-11-22).
    if (!members.has(r.uid)) continue;
    byUid.set(r.uid, [...(byUid.get(r.uid) ?? []), r.field]);
  }
  return [...byUid].map(([uid, fields]) => ({
    uid,
    player: members.get(uid) ?? "",
    fields: REPORT_FIELDS.filter((f) => fields.includes(f)),
  }));
}
