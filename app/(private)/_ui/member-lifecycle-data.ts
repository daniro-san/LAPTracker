// The Members tab's new members waiting for the roster (D106) and former members (D107), made on the
// server in the officer's language: names, their facts as lines, and the few numbers a former member
// keeps (the last roster's public might and kills, and the day it was read). Nothing else of theirs.
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import { lifecycleEn } from "@/lib/private/dictionary.lifecycle";
import type { MemberFacts } from "@/lib/private/fact-fields";
import { NONE } from "@/lib/private/fact-text";
import type { FormerMember } from "@/lib/private/former-members";
import { factLines, or, type CardFormats } from "@/lib/private/member-card";
import type { Pending } from "@/lib/private/pending-members";

import type { FactsCard } from "./MemberCards";
import { SHEET_KEYS } from "./sheet-words";

export interface PendingRow extends FactsCard {
  /** Said once a roster read after they were added found no single match; else null. */
  unmatched: string | null;
}

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
  };
}

export interface FormerRow extends FactsCard {
  /** "Last seen Mon, Nov 9". */
  lastSeen: string;
  /** "Might 48.2M · Kills 1.2M". */
  numbers: string;
  /** The facts recorded, one line: "Notes: moved server · Main squad: 48.2M". */
  summary: string;
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
    summary: lines
      .filter((l) => l.value !== NONE)
      .map((l) => `${l.label}: ${l.value}`)
      .join(" · "),
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
