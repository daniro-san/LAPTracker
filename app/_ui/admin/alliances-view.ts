// /admin's Alliances table (issue 485, D144) in words: one row per workspace, from the reads /admin already
// makes (the key's status, the switches, today's allowance use) and allianceUsage's one statement. The rows
// that need a look come first: a key that cannot be used, then errors, then a daily limit used up. Counts
// and times only (D71): no name, no key, its last 4 or its quota, no webhook. English only (D48).
import { OWN_ALLIANCE_ID } from "@/config/alliances";
import { copy, fill } from "@/lib/copy";
import type { AllianceUsage } from "@/lib/queries/admin-alliances";
import type { AdminFeatures } from "@/lib/queries/workspace-features";
import type { AdminWorkspace } from "@/lib/queries/workspaces";
import {
  ALLOWANCES,
  ESTIMATE_MEMBERS,
  resolveFeatures,
  trackerEstimate,
  type Allowance,
} from "@/lib/workspace-features";
import { keyUsable } from "@/lib/workspace-keys";

import { settingsFor } from "./features-view";
import type { FeaturesView } from "./WorkspaceFeatures";

const t = copy.admin.workspaces.alliances;
const n = (x: number) => x.toLocaleString("en");

export type KeyState = "ok" | "paused" | "reenter" | "none";

export interface AllianceRow {
  id: number;
  slug: string;
  alliance: string;
  /** Why it comes first, in order: the key, errors, a daily limit used up. Empty: nothing to look at. */
  attention: ("key" | "errors" | "cap")[];
  calls: { today: string; week: string; planned: string };
  key: { state: KeyState; text: string; note: string };
  allowances: Record<Allowance, { text: string; usedUp: boolean }>;
  posts: string;
  errors: number;
  seen: string;
  changed: string;
}

/**
 * The key as the squads read sees it (D124), without opening it: sealed under another master key or marked
 * `reenter` → re-enter; usable now → ok; refused or out of quota → paused; none saved → none (the own
 * alliance then reads on the site's key). `wanted`: the squads read is on but has no key it can use.
 */
export function keyState(
  w: AdminWorkspace,
  squadsOn: boolean,
  current: string | null,
  now: Date,
): AllianceRow["key"] & { which: "own" | "site" | "none"; bad: boolean } {
  const k = w.trackerKey;
  if (k.set) {
    const which = "own" as const;
    if (k.masterFp !== current || k.status === "reenter")
      return { state: "reenter", text: t.key.reenter, note: t.key.own, which, bad: true };
    if (keyUsable(k.status, k.statusAt, now))
      return { state: "ok", text: t.key.ok, note: t.key.own, which, bad: false };
    const why = k.status === "invalid" || k.status === "out_of_quota" ? t.key[k.status] : "";
    return { state: "paused", text: t.key.paused, note: why, which, bad: true };
  }
  if (w.unionId === OWN_ALLIANCE_ID)
    return { state: "none", text: t.key.none, note: t.key.site, which: "site", bad: false };
  return {
    state: "none",
    text: t.key.none,
    note: squadsOn ? t.key.wanted : t.key.noKey,
    which: "none",
    bad: squadsOn,
  };
}

/** "12 of 50", "12 · no cap"; used up at a cap above 0 that today's use reached. */
function allowance(view: FeaturesView, a: Allowance) {
  const used = view.used[a];
  const cap = view.caps[a];
  if (cap === null) return { text: fill(t.usedNoCap, { used: n(used) }), usedUp: false };
  return { text: fill(t.used, { used: n(used), cap: n(cap) }), usedUp: cap > 0 && used >= cap };
}

export function allianceRow(input: {
  w: AdminWorkspace;
  alliance: string;
  features: AdminFeatures;
  view: FeaturesView;
  usage: AllianceUsage | undefined;
  current: string | null;
  now: Date;
  ago: (at: Date) => string;
}): AllianceRow {
  const { w, features, view, now } = input;
  const u = input.usage ?? { callsToday: 0, calls7d: 0, postsToday: 0, errors24h: 0 };
  const on = resolveFeatures(settingsFor(features, w), features.paused).on;
  const key = keyState(w, on.has("squads"), input.current, now);
  const members = features.members.get(w.unionId) ?? ESTIMATE_MEMBERS;
  const allowances = Object.fromEntries(
    ALLOWANCES.map((a) => [a, allowance(view, a)]),
  ) as AllianceRow["allowances"];
  const changed = view.changed.length + view.changedCaps.length;
  const calls = fill(t.calls[key.which], { today: n(u.callsToday) });
  return {
    id: w.id,
    slug: w.slug,
    alliance: input.alliance,
    attention: [
      ...(key.bad ? ["key" as const] : []),
      ...(u.errors24h > 0 ? ["errors" as const] : []),
      ...(ALLOWANCES.some((a) => allowances[a].usedUp) ? ["cap" as const] : []),
    ],
    calls: {
      today: calls,
      week: fill(t.calls.week, { n: n(u.calls7d) }),
      planned: fill(t.calls.planned, { n: n(trackerEstimate(on, members).daily) }),
    },
    key: { state: key.state, text: key.text, note: key.note },
    allowances,
    posts: fill(t.posts, { n: n(u.postsToday) }),
    errors: u.errors24h,
    seen: input.usage?.officerSeenAt ? input.ago(input.usage.officerSeenAt) : t.seenNever,
    changed: [
      changed === 0 ? t.changedNone : fill(t.changed, { n: changed }),
      ...(view.allianceOff.length > 0 ? [fill(t.allianceOff, { n: view.allianceOff.length })] : []),
    ].join(" · "),
  };
}

const RANK = ["key", "errors", "cap"] as const;

/** Needs a look first, by the first reason (key, then errors, then a cap), then by address. */
export function byAttention(a: AllianceRow, b: AllianceRow): number {
  const rank = (r: AllianceRow) => {
    const first = r.attention[0];
    return first ? RANK.indexOf(first) : RANK.length;
  };
  return rank(a) - rank(b) || a.slug.localeCompare(b.slug);
}
