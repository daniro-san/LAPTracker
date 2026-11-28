// The Members tab's new members waiting for the roster (D106) and former members (D107), made on the
// server in the officer's language: names, their facts as lines, and the few numbers a former member
// keeps (the last roster's public might and kills, the day it was read, and the newest week of Alliance
// Duel points saved). Nothing else of theirs. Also the pending members an officer deleted (dismissed).
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import { lifecycleEn } from "@/lib/private/dictionary.lifecycle";
import { LEFT_REASONS, type LeftReasonCode, type MemberFacts } from "@/lib/private/fact-fields";
import { NONE } from "@/lib/private/fact-text";
import type { FormerMember } from "@/lib/private/former-members";
import { leftByMonth } from "@/lib/private/left-reason";
import { factLines, or, type CardFormats } from "@/lib/private/member-card";
import type { Pending } from "@/lib/private/pending-members";
import { fill, plural } from "@/lib/words";

import type { FactsCard } from "./MemberCards";
import { SHEET_KEYS } from "./sheet-words";

export interface PendingRow extends FactsCard {
  /** Said once a roster read after they were added found no single match; else null. */
  unmatched: string | null;
  /** "To match": that roster read came and left them pending (`toMatch`, 2026-11-17). */
  toMatch: boolean;
}

/** The facts recorded, one line: "Notes: moved server · Main squad: 48.2M". */
const summaryOf = (lines: ReturnType<typeof factLines>) =>
  lines
    .filter((l) => l.value !== NONE)
    .map((l) => `${l.label}: ${l.value}`)
    .join(" · ");

export function pendingRow(
  p: Pending,
  facts: MemberFacts,
  rosterAt: Date | null,
  t: WorkspaceDictionary,
  f: CardFormats,
): PendingRow {
  const tried = rosterAt !== null && rosterAt >= p.createdAt;
  return {
    uid: p.uid,
    name: p.name,
    factLines: factLines(facts, t, f),
    stored: facts,
    autoStatus: NONE,
    noData: t["nodata.mark"],
    unmatched: tried ? fill(t["pending.unmatched"], { date: f.date(rosterAt) }) : null,
    toMatch: tried,
  };
}

/** A pending member an officer deleted, kept with what was recorded (2026-11-17). */
export interface DismissedRow {
  uid: number;
  name: string;
  /** "Dismissed Mon, Nov 16". */
  dismissedOn: string;
  summary: string;
}

export const dismissedRow = (
  p: Pending & { dismissedAt: Date },
  facts: MemberFacts,
  t: WorkspaceDictionary,
  f: CardFormats,
): DismissedRow => ({
  uid: p.uid,
  name: p.name,
  dismissedOn: fill(t["pending.dismissedOn"], { date: f.date(p.dismissedAt) }),
  summary: summaryOf(factLines(facts, t, f)),
});

const DUEL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** "Alliance Duel points, week of Mon, Nov 9: 12,401,468 · Mon 2.40M": only what was saved, each day
 * kept with its number. */
function duelLine(duel: NonNullable<FormerMember["duel"]>, t: WorkspaceDictionary, f: CardFormats) {
  const { week, ...days } = duel.points;
  const parts = [
    ...(week === undefined ? [] : [f.number(week)]),
    ...DUEL_DAYS.flatMap((d) => {
      const v = days[d];
      return v === undefined ? [] : [`${t[`day.${d}`]}\u00a0${f.compact(v)}`];
    }),
  ];
  return `${fill(t["former.duel"], { date: f.date(duel.week) })}: ${parts.join(" · ")}`;
}

export interface FormerRow extends FactsCard {
  /** "Last seen Mon, Nov 9". */
  lastSeen: string;
  /** "Might 48.2M · Kills 1.2M". */
  numbers: string;
  /** The facts recorded, one line: "Notes: moved server · Main squad: 48.2M". */
  summary: string;
  /** "Alliance Duel points, week of Mon, Nov 9: Mon 2.40M · Tue 3.10M", the newest week saved; else null. */
  duel: string | null;
  /** Why they left (issue 469): the saved reason and note, its version (0: none), and its line. */
  left: { reason: LeftReasonCode | null; note: string; version: number; text: string | null };
}

/** "Joined another alliance · moved to a friend's alliance", or null when no reason was saved. */
function leftText(m: FormerMember, t: WorkspaceDictionary): string | null {
  const v = m.facts.leftReason?.value;
  if (!v) return null;
  return [t[`former.reason.${v.reason}`], v.note].filter((x) => x !== "").join(" · ");
}

export function formerRow(m: FormerMember, t: WorkspaceDictionary, f: CardFormats): FormerRow {
  const lines = factLines(m.facts, t, f);
  return {
    uid: m.uid,
    name: m.name,
    factLines: lines,
    stored: m.facts,
    autoStatus: NONE,
    noData: t["nodata.mark"],
    lastSeen: fill(t["former.lastSeen"], { date: f.date(m.lastSeen) }),
    numbers: [
      fill(t["members.meta.might"], { v: or(m.might, f.compact) }),
      fill(t["list.meta.kills"], { v: or(m.kills, f.compact) }),
    ].join(" · "),
    summary: summaryOf(lines),
    duel: m.duel && duelLine(m.duel, t, f),
    left: {
      reason: m.facts.leftReason?.value?.reason ?? null,
      note: m.facts.leftReason?.value?.note ?? "",
      version: m.facts.leftReason?.version ?? 0,
      text: leftText(m, t),
    },
  };
}

/** One month of Former members' counts, as the view shows it. Numbers only, never names. */
export interface LeftMonthLine {
  month: string;
  /** "November 2026". */
  label: string;
  /** "3 former members". */
  total: string;
  /** "Left 1 · Unknown 2": only the reasons counted, in the picker's order. */
  counts: string;
}

function leftMonthLines(
  former: readonly FormerMember[],
  t: WorkspaceDictionary,
  f: CardFormats,
): LeftMonthLine[] {
  const name = new Intl.DateTimeFormat(f.language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return leftByMonth(former).map((m) => {
    const label = name.format(new Date(`${m.month}-01T00:00:00Z`));
    return {
      month: m.month,
      label: label.charAt(0).toLocaleUpperCase(f.language) + label.slice(1),
      total: fill(
        plural(
          m.total,
          { one: t["former.months.one"], other: t["former.months.other"] },
          f.language,
        ),
        { n: f.number(m.total) },
      ),
      counts: LEFT_REASONS.filter((r) => m.counts[r] > 0)
        .map((r) => `${t[`former.reason.${r}`]}\u00a0${f.number(m.counts[r])}`)
        .join(" · "),
    };
  });
}

/** The Former members view's rows and its counts by month. */
export const formerView = (
  former: readonly FormerMember[],
  t: WorkspaceDictionary,
  f: CardFormats,
) => ({ rows: former.map((m) => formerRow(m, t, f)), months: leftMonthLines(former, t, f) });

const KEYS = [
  ...(Object.keys(lifecycleEn) as (keyof typeof lifecycleEn)[]),
  ...SHEET_KEYS,
] as const satisfies readonly WorkspaceKey[];

export type LifecycleWords = Record<(typeof KEYS)[number], string>;

/** Only the words these sections' browser code shows. */
export const lifecycleWords = (t: WorkspaceDictionary): LifecycleWords =>
  Object.fromEntries(KEYS.map((k) => [k, t[k]])) as LifecycleWords;

/** "2 new members to match" (Members and Home, 2026-11-17). */
export const toMatchLine = (n: number, t: WorkspaceDictionary, f: CardFormats) =>
  fill(
    plural(n, { one: t["pending.toMatch.one"], other: t["pending.toMatch.other"] }, f.language),
    { n },
  );
