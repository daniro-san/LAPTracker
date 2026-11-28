// Members say "I'm in" for a KvK plan's roles, officers confirm or decline (issue 831, D161 amended). The
// member's side takes a MeAccess (an approved link, D142): the uid is the link's, never the request's. The
// open KvK is the next one members can see: a KvK calendar entry marked "Members can see this" (D105), with
// a saved plan, on a KvK day (not Origin of Chaos, #806), before its start. Confirm puts the uid into the
// plan's role (a new `rev`, so an officer's open editor is told to reload) and deletes the ask; Decline and
// Withdraw delete it. Roles are jobs, never a ranking (D75): people in a role are in name order.
import { z } from "zod";

import type { Db } from "../db";
import { calendarRows } from "../repo/calendar";
import { addClaim, claimsOf, removeClaim } from "../repo/kvk-claims";
import { findKvkPlan, writeKvkPlan } from "../repo/kvk-plans";
import { anyRoster } from "../repo/workspace-any-roster";
import { isKvkDay } from "../schedule";
import type { MeAccess, WorkspaceAccess } from "./access";
import { layOut } from "./calendar-model";
import { addDays, dayIn, mondayOf, zonedInstant } from "./calendar-time";
import { ROLE_NAME_MAX } from "./kvk-plan-message";

const id = z.number().int().positive();
const roleName = z.string().min(1).max(ROLE_NAME_MAX);

/** A member's write from their own page: no uid, it is the link's. */
export const kvkClaimInput = z
  .object({ entry: id, role: roleName, action: z.enum(["ask", "withdraw"]) })
  .strict();
export type KvkClaimInput = z.infer<typeof kvkClaimInput>;

/** An officer's answer to one ask, on the KvK plan's page. */
export const kvkAnswerInput = z
  .object({
    action: z.literal("answer"),
    entry: id,
    role: roleName,
    uid: id,
    answer: z.enum(["confirm", "decline"]),
  })
  .strict();
export type KvkAnswerInput = z.infer<typeof kvkAnswerInput>;

export interface MeKvkView {
  entry: number;
  /** The KvK's server day and time (minutes), and its start (epoch ms). */
  day: string;
  minute: number;
  at: number;
  /** The plan's roles in the officers' order: the confirmed people by public name, and the member's own state. */
  roles: { name: string; names: string[]; mine: "in" | "asked" | null }[];
}

const byName = (a: string, b: string) => a.localeCompare(b, "en");

const namesOf = async (db: Db, unionId: number) =>
  new Map(((await anyRoster(db, unionId))?.members ?? []).map((m) => [m.uid, m.name]));

/** The next KvK members can see, with its saved plan, from today through the next week; null when none. */
async function openKvk(db: Db, me: MeAccess, now: Date, zone: string) {
  const today = dayIn(zone, now.getTime());
  const monday = mondayOf(today);
  const last = addDays(today, 13);
  const { entries, rows } = await calendarRows(db, me.workspaceId, monday, today, last);
  const coming = layOut(entries, rows, monday, last).filter(
    (p) =>
      p.entry.kind === "kvk" &&
      p.entry.forMembers &&
      p.minute !== null &&
      isKvkDay(p.day) &&
      zonedInstant(p.day, p.minute, zone) > now.getTime(),
  );
  for (const placed of coming) {
    const plan = await findKvkPlan(db, me.workspaceId, placed.entry.id);
    if (plan && plan.roles.length > 0) return { placed, plan, minute: placed.minute as number };
  }
  return null;
}

/** The "KvK roles" card on the member's own page, or null when no KvK is open. */
export async function meKvkView(
  db: Db,
  me: MeAccess,
  now: Date,
  zone: string,
): Promise<MeKvkView | null> {
  const open = await openKvk(db, me, now, zone);
  if (!open) return null;
  const { placed, plan, minute } = open;
  const [names, claims] = await Promise.all([
    namesOf(db, me.unionId),
    claimsOf(db, me.workspaceId, placed.entry.id),
  ]);
  const asked = new Set(claims.filter((c) => c.uid === me.uid).map((c) => c.role));
  return {
    entry: placed.entry.id,
    day: placed.day,
    minute,
    at: zonedInstant(placed.day, minute, zone),
    roles: plan.roles.map((r) => ({
      name: r.name,
      names: r.uids.flatMap((u) => names.get(u) ?? []).sort(byName),
      mine: r.uids.includes(me.uid) ? "in" : asked.has(r.name) ? "asked" : null,
    })),
  };
}

export type ClaimResult = { ok: true } | { ok: false; code: "not_found" | "left" | "confirmed" };

/** The member's "I'm in" or Withdraw, for their own link's uid, on the open KvK's role. */
export async function claimKvkRole(
  db: Db,
  me: MeAccess,
  input: KvkClaimInput,
  now: Date,
  zone: string,
): Promise<ClaimResult> {
  const open = await openKvk(db, me, now, zone);
  const role =
    open?.placed.entry.id === input.entry
      ? open.plan.roles.find((r) => r.name === input.role)
      : undefined;
  if (!role) return { ok: false, code: "not_found" };
  if (!(await namesOf(db, me.unionId)).has(me.uid)) return { ok: false, code: "left" };
  // Once confirmed, the member is in the plan: only an officer takes them out.
  if (role.uids.includes(me.uid)) return { ok: false, code: "confirmed" };
  const key = { workspaceId: me.workspaceId, entryId: input.entry, role: role.name, uid: me.uid };
  if (input.action === "ask") await addClaim(db, key, now);
  else await removeClaim(db, key);
  return { ok: true };
}

/**
 * The asks an officer answers on the plan's page: roles still in the plan, members still on the roster, in
 * name order (D75: never in the order they asked).
 */
export async function asksOf(
  db: Db,
  access: WorkspaceAccess,
  entry: number,
  roles: readonly { name: string; uids: number[] }[] | null,
  names: ReadonlyMap<number, string>,
): Promise<{ role: string; uid: number; name: string }[]> {
  const claims = await claimsOf(db, access.workspaceId, entry);
  return claims
    .flatMap((c) => {
      const role = roles?.find((r) => r.name === c.role);
      const name = names.get(c.uid);
      return role && name !== undefined && !role.uids.includes(c.uid)
        ? [{ role: c.role, uid: c.uid, name }]
        : [];
    })
    .sort((a, b) => byName(a.name, b.name) || a.uid - b.uid);
}

export type AnswerResult =
  { ok: true; rev: number } | { ok: false; code: "not_found" | "invalid" | "stale" };

/**
 * An officer's Confirm (the uid goes into the role, over the plan's current `rev`) or Decline of one ask.
 * Either way the ask is gone afterwards.
 */
export async function answerKvkClaim(
  db: Db,
  access: WorkspaceAccess,
  input: KvkAnswerInput,
  now: Date,
): Promise<AnswerResult> {
  const plan = await findKvkPlan(db, access.workspaceId, input.entry);
  const asked = (await claimsOf(db, access.workspaceId, input.entry)).some(
    (c) => c.role === input.role && c.uid === input.uid,
  );
  if (!plan || !asked) return { ok: false, code: "not_found" };
  const key = { workspaceId: access.workspaceId, entryId: input.entry };
  const claim = { ...key, role: input.role, uid: input.uid };
  if (input.answer === "decline") {
    await removeClaim(db, claim);
    return { ok: true, rev: plan.rev };
  }
  const at = plan.roles.findIndex((r) => r.name === input.role);
  if (at < 0) return { ok: false, code: "not_found" };
  if (!(await namesOf(db, access.unionId)).has(input.uid)) return { ok: false, code: "invalid" };
  const roles = plan.roles.map((r, i) =>
    i === at && !r.uids.includes(input.uid) ? { ...r, uids: [...r.uids, input.uid] } : r,
  );
  const row = await writeKvkPlan(
    db,
    key,
    plan.rev,
    { roles, note: plan.note },
    access.user.id,
    now,
  );
  if (!row) return { ok: false, code: "stale" };
  await removeClaim(db, claim);
  return { ok: true, rev: row.rev };
}
