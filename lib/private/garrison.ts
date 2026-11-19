// An Undead Siege's garrison plan (issue 423, D121): the read behind its page and the officers' saves. Only
// the workspace's own alliance (D71): its newest roster, its stored squads (D117) and its own signals. The
// plan is the officers' saved pairs, else the suggestion; a save names the version it started from, and a
// newer save by another officer refuses it (409).
import { z } from "zod";

import type { Db } from "../db";
import { findPlan, savePlan, type GarrisonRow } from "../repo/garrison";
import { allLatestSquads } from "../repo/squads";
import { latestRoster } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import type { Placed } from "./calendar-model";
import { isDay, mondayOf } from "./calendar-time";
import {
  helpOrder,
  needOf,
  pairsOk,
  sparesOf,
  strongest,
  suggestPairs,
  type GarrisonPair,
  type Need,
  type PlanMember,
  type Signals,
  type Spare,
} from "./garrison-plan";
import { readSignals } from "./garrison-signals";
import { placedOf } from "./roll-call";

const id = z.number().int().positive();
const MONDAY = z.string().refine((d) => isDay(d) && mondayOf(d) === d);
const pair = z.object({ helper: id, squad: z.number().int().min(1).max(9), member: id }).strict();

/** The page's writes: save the edited pairs (with the version seen), or post the plan to Discord. */
export const garrisonInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      entry: id,
      week: MONDAY,
      rev: z.number().int().min(0),
      pairs: z.array(pair).max(200),
    })
    .strict(),
  z.object({ action: z.literal("post"), entry: id, week: MONDAY, requestId: z.uuid() }).strict(),
]);
export type GarrisonInput = z.infer<typeof garrisonInput>;

/** The good signals, as names the page turns into words; never the values behind them (D76). */
export type Good = keyof Signals;

export interface GarrisonMember {
  uid: number;
  name: string;
  need: Need;
  /** The strongest squad's power; null with no squad data. */
  top: number | null;
  good: Good[];
}

export interface GarrisonView {
  placed: Placed;
  enemyMight: number | null;
  /** The enemy might's version, for its 409 check (issue 293). */
  version: number;
  /** "Needs help" then "close" in the suggestion order, then "no squad data" by name. */
  members: GarrisonMember[];
  /** Every squad that can be lent, strongest first, plus any other squad the plan lends. */
  spares: (Spare & { name: string })[];
  pairs: GarrisonPair[];
  /** The suggestion, for "Start again from the suggestion". */
  suggested: GarrisonPair[];
  /** Every roster member's name by uid, for the pairs and the share text. */
  names: Record<number, string>;
  /** The stored plan's version; 0 while it is the suggestion. */
  rev: number;
  posted: Date | null;
}

/** The roster's members with their newest squads; the signals only when asked for. */
async function planMembers(
  db: Db,
  access: WorkspaceAccess,
  signals: ((uid: number) => Signals) | null,
): Promise<PlanMember[]> {
  const [roster, rows] = await Promise.all([
    latestRoster(db, access.unionId),
    allLatestSquads(db, access.unionId),
  ]);
  const unknown: Signals = { active: null, growing: null, tookPart: null };
  return roster.map(({ uid, name }) => ({
    uid,
    name,
    squads: rows.filter((r) => r.uid === uid).map(({ squad, power }) => ({ squad, power })),
    signals: signals?.(uid) ?? unknown,
  }));
}

/** The Undead Siege of this entry in this week, or null. */
async function siegeOf(db: Db, access: WorkspaceAccess, entry: number, week: string) {
  const placed = await placedOf(db, access, entry, week);
  return placed?.entry.kind === "undead" ? placed : null;
}

const GOOD: Good[] = ["active", "growing", "tookPart"];

function membersOf(members: PlanMember[], t: number): GarrisonMember[] {
  const view = (m: PlanMember): GarrisonMember => ({
    uid: m.uid,
    name: m.name,
    need: needOf(m.squads, t),
    top: strongest(m.squads)?.power ?? null,
    good: GOOD.filter((g) => m.signals[g] === true),
  });
  const unknown = members
    .filter((m) => m.squads.length === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  return [...helpOrder(members, t), ...unknown].map(view);
}

function sparesIn(members: PlanMember[], t: number, pairs: GarrisonPair[]) {
  const name = new Map(members.map((m) => [m.uid, m.name]));
  const spares = members.flatMap((m) => sparesOf(m, t));
  const lentElsewhere = pairs.flatMap((p) => {
    if (spares.some((s) => s.helper === p.helper && s.squad === p.squad)) return [];
    const power = members
      .find((m) => m.uid === p.helper)
      ?.squads.find((s) => s.squad === p.squad)?.power;
    return power === undefined ? [] : [{ helper: p.helper, squad: p.squad, power }];
  });
  return [...spares, ...lentElsewhere]
    .sort((a, b) => b.power - a.power || a.helper - b.helper || a.squad - b.squad)
    .map((s) => ({ ...s, name: name.get(s.helper) ?? "" }));
}

/** The page's view, or null when the entry is not an Undead Siege of this workspace in that week. */
export async function garrisonView(
  db: Db,
  access: WorkspaceAccess,
  entry: number,
  week: string,
): Promise<{ view: GarrisonView; row: GarrisonRow | null } | null> {
  const placed = await siegeOf(db, access, entry, week);
  if (!placed) return null;
  const [members, row] = await Promise.all([
    readSignals(db, access, week).then((s) => planMembers(db, access, s)),
    findPlan(db, access.workspaceId, entry, week),
  ]);
  const t = placed.entry.enemyMight;
  // A stored pair whose member or squad has left the roster is dropped, so a save never trips on it.
  const suggested = t === null ? [] : suggestPairs(members, t);
  const pairs = row ? row.pairs.filter((p) => pairsOk([p], members)) : suggested;
  const view: GarrisonView = {
    placed,
    enemyMight: t,
    version: placed.entry.edits.enemyMight?.v ?? 0,
    members: t === null ? [] : membersOf(members, t),
    spares: t === null ? [] : sparesIn(members, t, pairs),
    pairs,
    suggested,
    names: Object.fromEntries(members.map((m) => [m.uid, m.name])),
    rev: row?.rev ?? 0,
    posted: row?.postStatus === "posted" ? row.postedAt : null,
  };
  return { view, row };
}

export type SaveResult =
  { ok: true; rev: number } | { ok: false; code: "not_found" | "invalid" | "stale" };

/** Saves the officer's pairs over version `rev` (INVARIANT garrison.one-squad-one-member). */
export async function saveGarrison(
  db: Db,
  access: WorkspaceAccess,
  input: Extract<GarrisonInput, { action: "save" }>,
  now: Date,
): Promise<SaveResult> {
  const placed = await siegeOf(db, access, input.entry, input.week);
  if (!placed) return { ok: false, code: "not_found" };
  if (!pairsOk(input.pairs, await planMembers(db, access, null))) {
    return { ok: false, code: "invalid" };
  }
  const plan = { workspaceId: access.workspaceId, entryId: input.entry, week: input.week };
  const row = await savePlan(db, plan, input.rev, input.pairs, access.user.id, now);
  return row ? { ok: true, rev: row.rev } : { ok: false, code: "stale" };
}
