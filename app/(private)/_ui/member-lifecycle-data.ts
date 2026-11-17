// The Members tab's new members waiting for the roster (D106) and former members (D107), made on the
// server in the officer's language: names, their facts as lines, and the few numbers a former member
// keeps (the last roster's public might and kills, the day it was read, and the newest week of Alliance
// Duel points saved). Nothing else of theirs. Also the pending members an officer deleted (dismissed).
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import { lifecycleEn } from "@/lib/private/dictionary.lifecycle";
import type { MemberFacts } from "@/lib/private/fact-fields";
import { NONE } from "@/lib/private/fact-text";
import type { FormerMember } from "@/lib/private/former-members";
import { factLines, or, type CardFormats } from "@/lib/private/member-card";
import { plural } from "@/lib/private/members-sheet";
import type { Pending } from "@/lib/private/pending-members";

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
}

export function formerRow(m: FormerMember, t: WorkspaceDictionary, f: CardFormats): FormerRow {
  const lines = factLines(m.facts, t, f);
  return {
    uid: m.uid,
    name: m.name,
    factLines: lines,
    stored: m.facts,
    autoStatus: NONE,
    lastSeen: fill(t["former.lastSeen"], { date: f.date(m.lastSeen) }),
    numbers: [
      fill(t["members.meta.might"], { v: or(m.might, f.compact) }),
      fill(t["list.meta.kills"], { v: or(m.kills, f.compact) }),
    ].join(" · "),
    summary: summaryOf(lines),
    duel: m.duel && duelLine(m.duel, t, f),
  };
}

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
  fill(plural(t, "pending.toMatch", n, f), { n });
