// A KvK calendar entry's plan (issue 790, D161): the read behind its page, the officers' save and "Make the
// message". Only the workspace's own alliance (D71): its newest roster, by uid and public name, and its
// away notes to leave out the members away that day (D103). A save names the `rev` it started from; a
// newer save by another officer refuses it (409). The message is a new notice draft made from the saved
// plan, so the notice flow does the languages, the copy and Discord (D81, D102, D113). No private roster
// field, away note or uid is in it.
import { z } from "zod";

import type { Db } from "../db";
import { findEntry } from "../repo/calendar";
import { findKvkPlan, setPlanNotice, writeKvkPlan } from "../repo/kvk-plans";
import { noticeInWorkspace } from "../repo/notices";
import type { KvkRole } from "../schema";
import type { WorkspaceAccess } from "./access";
import type { Placed } from "./calendar-model";
import { isDay, mondayOf } from "./calendar-time";
import { calendarDates, stOf } from "./calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import { awayOn } from "./fact-fields";
import { NOTE_MAX, PEOPLE_MAX, planMessage, ROLE_MAX, ROLE_NAME_MAX } from "./kvk-plan-message";
import { factsOf } from "./member-facts";
import { saveNotice } from "./notices";
import { placedOf, rosterOf } from "./roll-call";

const id = z.number().int().positive();
const MONDAY = z.string().refine((d) => isDay(d) && mondayOf(d) === d);
const role = z
  .object({
    name: z.string().trim().min(1).max(ROLE_NAME_MAX),
    uids: z
      .array(id)
      .max(PEOPLE_MAX)
      .refine((u) => new Set(u).size === u.length),
  })
  .strict();

/** The page's writes: save the roles and the note over version `rev`, or make the message. */
export const kvkPlanInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      entry: id,
      rev: z.number().int().min(0),
      roles: z
        .array(role)
        .max(ROLE_MAX)
        .refine((rs) => rs.reduce((n, r) => n + r.uids.length, 0) <= PEOPLE_MAX),
      note: z.string().trim().max(NOTE_MAX),
    })
    .strict(),
  z.object({ action: z.literal("message"), entry: id, week: MONDAY, requestId: z.uuid() }).strict(),
]);
export type KvkPlanInput = z.infer<typeof kvkPlanInput>;

export interface KvkPlanView {
  placed: Placed;
  /** The saved roles, members still on the roster only; null before the first save (the page suggests). */
  roles: KvkRole[] | null;
  note: string;
  rev: number;
  /** The newest roster in name order, public name only; `away` on the KvK's day (D103). */
  members: { uid: number; name: string; away: boolean }[];
  /** The last notice made from the plan, while it is not deleted. */
  noticeId: number | null;
}

/** The KvK of this entry in this week, or null. */
async function kvkOf(db: Db, access: WorkspaceAccess, entry: number, week: string) {
  const placed = await placedOf(db, access, entry, week);
  return placed?.entry.kind === "kvk" ? placed : null;
}

const names = async (db: Db, access: WorkspaceAccess) =>
  new Map((await rosterOf(db, access)).map((m) => [m.uid, m.name]));

/** The page's view, or null when the entry is not a KvK of this workspace in that week. */
export async function kvkPlanView(
  db: Db,
  access: WorkspaceAccess,
  entry: number,
  week: string,
  zone: string,
): Promise<KvkPlanView | null> {
  const placed = await kvkOf(db, access, entry, week);
  if (!placed) return null;
  const [roster, facts, row] = await Promise.all([
    rosterOf(db, access),
    factsOf(db, access),
    findKvkPlan(db, access.workspaceId, entry),
  ]);
  const onRoster = new Set(roster.map((m) => m.uid));
  const noticeId =
    row?.noticeId != null && (await noticeInWorkspace(db, access.workspaceId, row.noticeId))
      ? row.noticeId
      : null;
  return {
    placed,
    roles: row && row.roles.map((r) => ({ ...r, uids: r.uids.filter((u) => onRoster.has(u)) })),
    note: row?.note ?? "",
    rev: row?.rev ?? 0,
    members: roster
      .map((m) => ({
        uid: m.uid,
        name: m.name,
        away: awayOn(facts.get(m.uid), placed.day, zone) !== null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en") || a.uid - b.uid),
    noticeId,
  };
}

export type SaveResult =
  { ok: true; rev: number } | { ok: false; code: "not_found" | "invalid" | "stale" };

/** Saves the officer's roles and note over version `rev`; every uid must be on the newest roster. */
export async function saveKvkPlan(
  db: Db,
  access: WorkspaceAccess,
  input: Extract<KvkPlanInput, { action: "save" }>,
  now: Date,
): Promise<SaveResult> {
  const entry = await findEntry(db, access.workspaceId, input.entry);
  if (entry?.kind !== "kvk") return { ok: false, code: "not_found" };
  const roster = await names(db, access);
  if (input.roles.some((r) => r.uids.some((u) => !roster.has(u)))) {
    return { ok: false, code: "invalid" };
  }
  const key = { workspaceId: access.workspaceId, entryId: input.entry };
  const plan = { roles: input.roles, note: input.note };
  const row = await writeKvkPlan(db, key, input.rev, plan, access.user.id, now);
  return row ? { ok: true, rev: row.rev } : { ok: false, code: "stale" };
}

export type MessageResult = { ok: true; id: number } | { ok: false; code: "not_found" };

/**
 * Makes a new notice draft from the saved plan, in the officer's language, once per request id (D100): the
 * KvK's server day and time, each role with people in it by public name, and the note.
 */
export async function makeKvkMessage(
  db: Db,
  access: WorkspaceAccess,
  input: Extract<KvkPlanInput, { action: "message" }>,
  now: Date,
  words: { t: WorkspaceDictionary; language: WorkspaceLanguage },
): Promise<MessageResult> {
  const placed = await kvkOf(db, access, input.entry, input.week);
  if (!placed) return { ok: false, code: "not_found" };
  const [row, roster] = await Promise.all([
    findKvkPlan(db, access.workspaceId, input.entry),
    names(db, access),
  ]);
  const { t, language } = words;
  const roles = (row?.roles ?? []).map((r) => ({
    name: r.name,
    names: r.uids.flatMap((u) => roster.get(u) ?? []),
  }));
  const when = {
    day: calendarDates(language).short(placed.day),
    time: stOf("kvk", placed.minute ?? 0, t),
  };
  const message = planMessage(t, when, roles, row?.note ?? "");
  const changes = [
    { field: "title" as const, value: message.title, version: 0 },
    { field: language, value: message.text, version: 0 },
  ];
  const saved = await saveNotice(db, access, null, changes, now, input.requestId);
  if (!saved.ok) throw new Error(`kvk_plan_notice_${saved.reason}`);
  if (row) await setPlanNotice(db, access.workspaceId, input.entry, saved.id);
  return { ok: true, id: saved.id };
}
