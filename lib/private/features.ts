// The workspace's feature switches and daily allowances (D126), at every server door: `featureOn` on the
// features its access carries (read with the session, so a page or route adds no query), and `useAllowance`
// before anything that spends the owner's Groq limit or a Discord translation. A refusal is a code for the
// routes and a plain line in the officer's language for pages and Discord; nothing fails silently.
import type { Db } from "../db";
import {
  giveBack,
  pausedAllowances,
  settingsById,
  settingsBySlug,
  spend,
} from "../repo/workspace-features";
import {
  resolveFeatures,
  usageDay,
  type Allowance,
  type Feature,
  type WorkspaceFeatures,
} from "../workspace-features";
import { privateLog } from "./log";

/** Anything that carries a workspace's served features: a WorkspaceAccess, a BoardAccess, a guild's workspace. */
export interface WithFeatures {
  readonly workspaceId: number;
  readonly features: WorkspaceFeatures;
}

/** The workspace's features as served now, by its address; null when no workspace has it. */
export async function featuresBySlug(db: Db, slug: string): Promise<WorkspaceFeatures | null> {
  const [found, paused] = await Promise.all([settingsBySlug(db, slug), pausedAllowances(db)]);
  return found ? resolveFeatures(found.settings, paused) : null;
}

/** The same, by id (the Discord commands find their workspace by its server). */
export async function featuresById(db: Db, workspaceId: number): Promise<WorkspaceFeatures> {
  const [found, paused] = await Promise.all([settingsById(db, workspaceId), pausedAllowances(db)]);
  // The id comes from a row just read; a workspace deleted in between serves nothing.
  return found
    ? resolveFeatures(found.settings, paused)
    : { on: new Set(), caps: { ai: 0, translate: 0 } };
}

export const featureOn = (ws: Pick<WithFeatures, "features">, feature: Feature): boolean =>
  ws.features.on.has(feature);

/** The thanks sheet's switches (D126): the members' board, and the thanks draft's writing help. */
export const thanksSwitches = (ws: Pick<WithFeatures, "features">) => ({
  board: featureOn(ws, "board"),
  writing: featureOn(ws, "thanks_draft"),
});

/** The notice editor's writing helps turned off for the workspace, by the editor's own names. */
export const writingOff = (ws: Pick<WithFeatures, "features">) =>
  (["translate", "improve", "fit"] as const).filter((kind) => !featureOn(ws, `notice_${kind}`));

/**
 * Counts `units` of the workspace's daily allowance (one per Groq text asked, one per Discord language),
 * or says the day's cap is reached: then nothing is counted and the caller asks nothing. The count resets
 * at 00:00 UTC. The log carries a code and numbers only.
 */
export async function useAllowance(
  db: Db,
  ws: WithFeatures,
  allowance: Allowance,
  units: number,
  now: Date,
): Promise<"ok" | "cap_reached"> {
  const cap = ws.features.caps[allowance];
  const used = await spend(db, ws.workspaceId, allowance, usageDay(now), units, cap);
  if (used !== null) return "ok";
  privateLog(`features.cap_reached.${allowance}`, { workspace: ws.workspaceId, cap: cap ?? 0 });
  return "cap_reached";
}

/**
 * Gives back the units `useAllowance` counted at `countedAt` when the model did not answer (busy, timeout,
 * failed): the owner's limit was not spent, so the alliance's count is not either (owner, 2026-11-19).
 */
export async function giveBackAllowance(
  db: Db,
  ws: WithFeatures,
  allowance: Allowance,
  units: number,
  countedAt: Date,
): Promise<void> {
  await giveBack(db, ws.workspaceId, allowance, usageDay(countedAt), units);
}
