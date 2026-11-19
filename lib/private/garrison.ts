// An Undead Siege's garrison plan (issue 423, D121): the read behind its page and the officers' saves. Only
// the workspace's own alliance (D71): its newest roster, its stored squads (D117) and its own signals. The
// plan is the officers' saved pairs, else the suggestion; a save names the version it started from, and a
// newer save by another officer refuses it (409).
import { z } from "zod";

import type { Db } from "../db";
import {
  findPlan,
  lastEnemyMight,
  saveEnemy,
  savePlan,
  type GarrisonRow,
  type Siege,
} from "../repo/garrison";
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

/**
 * The page's writes: set the siege's enemy might, save the edited pairs (each with the version seen), or
 * post the plan to the members' or the leaders' Discord channel.
 */
export const garrisonInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("enemy"),
      entry: id,
      week: MONDAY,
      version: z.number().int().min(0),
      /** The game's number in full: 11.5M is 11500000. */
      value: z.number().int().positive().max(1e11),
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      entry: id,
      week: MONDAY,
      rev: z.number().int().min(0),
      pairs: z.array(pair).max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal("post"),
      entry: id,
      week: MONDAY,
      channel: z.enum(["members", "leaders"]).default("members"),
      requestId: z.uuid(),
    })
    .strict(),
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
  /** This siege's enemy might, else the last one saved for an earlier siege (`carriedFrom`). */
  enemyMight: number | null;
  /** The week of the earlier siege the enemy might comes from; null when this siege has its own. */
  carriedFrom: string | null;
  /** This siege's enemy might version, for its 409 check (issue 293). */
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
  /** The enemy might the stored pairs were made at, when it is not the current one; else null. */
  madeFor: number | null;
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
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.uid - b.uid);
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

const siegeKey = (access: WorkspaceAccess, entry: number, week: string): Siege => ({
  workspaceId: access.workspaceId,
  entryId: entry,
  week,
});

/** The page's view, or null when the entry is not an Undead Siege of this workspace in that week. */
export async function garrisonView(
  db: Db,
  access: WorkspaceAccess,
  entry: number,
  week: string,
): Promise<{ view: GarrisonView; row: GarrisonRow | null } | null> {
  const placed = await siegeOf(db, access, entry, week);
  if (!placed) return null;
  const siege = siegeKey(access, entry, week);
  const [members, row] = await Promise.all([
    readSignals(db, access, week).then((s) => planMembers(db, access, s)),
    findPlan(db, siege),
  ]);
  const { t, carried } = await thresholdOf(db, siege, row);
  const view: GarrisonView = {
    placed,
    enemyMight: t,
    carriedFrom: carried?.week ?? null,
    ...(t === null ? EMPTY : planOf(members, row, t)),
    names: Object.fromEntries(members.map((m) => [m.uid, m.name])),
    ...storedOf(row),
    madeFor: row?.pairs && row.pairsEnemyMight !== t ? row.pairsEnemyMight : null,
  };
  return { view, row };
}

/** The siege's enemy might; a siege with none of its own starts from the last one saved (owner, 2026-11-19). */
async function thresholdOf(db: Db, siege: Siege, row: GarrisonRow | null) {
  const carried = row?.enemyMight == null ? await lastEnemyMight(db, siege) : null;
  return { t: row?.enemyMight ?? carried?.value ?? null, carried };
}

const EMPTY = { members: [], spares: [], pairs: [], suggested: [] };

/** Who needs help, the spares and the pairs at enemy might `t`: the stored pairs, else the suggestion. */
function planOf(members: PlanMember[], row: GarrisonRow | null, t: number) {
  const suggested = suggestPairs(members, t);
  // A stored pair is dropped when its member or squad has left the roster (a save would trip on it), or
  // when its member no longer needs help at this enemy might.
  const helped = new Set(membersOf(members, t).map((m) => m.uid));
  const kept = (p: GarrisonPair) => pairsOk([p], members) && helped.has(p.member);
  const pairs = row?.pairs ? row.pairs.filter(kept) : suggested;
  return { members: membersOf(members, t), spares: sparesIn(members, t, pairs), pairs, suggested };
}

/** The stored versions and the last post. */
const storedOf = (row: GarrisonRow | null) => ({
  version: row?.enemyRev ?? 0,
  rev: row?.rev ?? 0,
  posted: row?.postStatus === "posted" ? row.postedAt : null,
});

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
  const siege = siegeKey(access, input.entry, input.week);
  const { t } = await thresholdOf(db, siege, await findPlan(db, siege));
  const plan = { pairs: input.pairs, t };
  const row = await savePlan(db, siege, input.rev, plan, access.user.id, now);
  return row ? { ok: true, rev: row.rev } : { ok: false, code: "stale" };
}

export type EnemyResult =
  | { ok: true; version: number }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "stale"; value: number | null };

/** Sets this siege's enemy might over version `version`; every save stays in its history. */
export async function saveEnemyMight(
  db: Db,
  access: WorkspaceAccess,
  input: Extract<GarrisonInput, { action: "enemy" }>,
  now: Date,
): Promise<EnemyResult> {
  if (!(await siegeOf(db, access, input.entry, input.week)))
    return { ok: false, code: "not_found" };
  const siege = siegeKey(access, input.entry, input.week);
  const row = await saveEnemy(db, siege, input.version, input.value, access.user.id, now);
  if (row) return { ok: true, version: row.enemyRev };
  return { ok: false, code: "stale", value: (await findPlan(db, siege))?.enemyMight ?? null };
}
