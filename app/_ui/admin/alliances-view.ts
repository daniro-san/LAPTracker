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
type Look = "key" | "errors" | "cap";

export interface AllianceRow {
  id: number;
  slug: string;
  alliance: string;
  /** Why it comes first, in order: the key, errors, a daily limit used up. Empty: nothing to look at. */
  attention: Look[];
  /** The first reason in words, for the "Needs a look" chip; empty when there is none. */
  reason: string;
  calls: { today: string; week: string; planned: string };
  /** `look`: whether the key is a reason to look (the cell is then in red). */
  key: { state: KeyState; text: string; note: string; look: Look | null };
  allowances: Record<Allowance, { text: string; usedUp: boolean }>;
  posts: string;
  errors: number;
  seen: string;
  changed: string;
}

/**
 * The key as the squads read sees it (D124), without opening it: sealed under another master key or marked
 * `reenter` → re-enter; usable now → ok; refused or out of quota → paused; none saved → none (the own
 * alliance then reads on the site's key), wanted when the squads read is on but has no key it can use.
 * `look`: a key an officer must enter again is a key reason; out of quota today mends itself at 00:00 UTC,
 * so it ranks with a used-up daily limit (product panel, 2026-11-21). With the keys off (no
 * WORKSPACE_KEYS_SECRET: `current` null) no saved key is used, as `squadsKey` rules: the own alliance reads
 * on the site's key and the others are not read, which is the site's setting, not the workspace's to mend.
 */
export function keyState(
  w: AdminWorkspace,
  squadsOn: boolean,
  current: string | null,
  now: Date,
): AllianceRow["key"] & { which: "own" | "site" | "none"; look: "key" | "cap" | null } {
  const k = w.trackerKey;
  if (k.set && current) return savedKey(k, current, now);
  if (w.unionId === OWN_ALLIANCE_ID)
    return { state: "none", text: t.key.none, note: t.key.site, which: "site", look: null };
  if (!current)
    return { state: "none", text: t.key.none, note: t.key.off, which: "none", look: null };
  return {
    state: "none",
    text: t.key.none,
    note: squadsOn ? t.key.wanted : t.key.noKey,
    which: "none",
    look: squadsOn ? "key" : null,
  };
}

/** A saved key while the keys are on: re-enter, ok or paused (refused, or out of quota today). */
function savedKey(
  k: AdminWorkspace["trackerKey"],
  current: string,
  now: Date,
): ReturnType<typeof keyState> {
  const which = "own" as const;
  if (k.masterFp !== current || k.status === "reenter")
    return { state: "reenter", text: t.key.reenter, note: t.key.own, which, look: "key" };
  if (keyUsable(k.status, k.statusAt, now))
    return { state: "ok", text: t.key.ok, note: t.key.own, which, look: null };
  const empty = k.status === "out_of_quota";
  const why = k.status === "invalid" || k.status === "out_of_quota" ? t.key[k.status] : "";
  return { state: "paused", text: t.key.paused, note: why, which, look: empty ? "cap" : "key" };
}

/** The reasons in rank order, and the first one in words. */
function attentionOf(
  key: ReturnType<typeof keyState>,
  u: Pick<AllianceUsage, "errors24h" | "postsFailed">,
  capUsedUp: boolean,
): { attention: Look[]; reason: string } {
  const attention: Look[] = [];
  if (key.look === "key") attention.push("key");
  if (u.errors24h > 0 || u.postsFailed > 0) attention.push("errors");
  if (capUsedUp || key.look === "cap") attention.push("cap");
  const reason = {
    key: fill(t.reason.key, { state: key.text }),
    errors:
      u.errors24h > 0
        ? fill(t.reason.errors, { n: u.errors24h })
        : fill(t.reason.failed, { n: u.postsFailed }),
    cap: capUsedUp ? t.reason.cap : t.reason.quota,
  };
  const first = attention[0];
  return { attention, reason: first ? reason[first] : "" };
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
  const u = input.usage ?? {
    callsToday: 0,
    calls7d: 0,
    postsToday: 0,
    postsFailed: 0,
    errors24h: 0,
  };
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
    ...attentionOf(
      key,
      u,
      ALLOWANCES.some((a) => allowances[a].usedUp),
    ),
    calls: {
      today: calls,
      week: fill(t.calls.week, { n: n(u.calls7d) }),
      planned: fill(t.calls.planned, { n: n(trackerEstimate(on, members).daily) }),
    },
    key: { state: key.state, text: key.text, note: key.note, look: key.look },
    allowances,
    posts: [
      fill(t.posts, { n: n(u.postsToday) }),
      ...(u.postsFailed > 0 ? [fill(t.postsFailed, { n: n(u.postsFailed) })] : []),
    ].join(" · "),
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
