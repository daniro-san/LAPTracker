// events table. An event carries its own phase times (before_at, after_at): scheduled events get them from
// the env when the tick creates the row, rehearsals from the moment they are created (plan §3.1).
import { and, eq, gt, gte, isNull, lt, lte, or } from "drizzle-orm";

import type { Db } from "../db";
import { events, snapshots } from "../schema";
import type { EventRow, Phase } from "./index";
import { findSnapshot } from "./snapshots";

export type ManualVisibility = "admin" | "standalone" | "history";

export async function getEvent(db: Db, eventId: number): Promise<EventRow | null> {
  const [row] = await db
    .select({ id: events.id, allianceIds: events.allianceIds })
    .from(events)
    .where(eq(events.id, eventId));
  return row ?? null;
}

export async function setEventAllianceIds(db: Db, eventId: number, ids: number[]): Promise<void> {
  await db.update(events).set({ allianceIds: ids }).where(eq(events.id, eventId));
}

/** What a run needs to know about its event. */
export interface EventInfo {
  id: number;
  /** `events.name`: a manual round's name goes in its Discord messages. */
  name: string;
  isTest: boolean;
  /** D28: a manual event is run only by the admin buttons and has no schedule. */
  manual: boolean;
  /** Manual rounds: post the public Discord message when a run finishes. */
  postPublic: boolean;
  /** D31: Discord's id of this event's message in each channel; null until the first post. */
  discordPublicMessageId: string | null;
  discordAdminMessageId: string | null;
  beforeAt: Date;
  afterAt: Date;
}

const infoColumns = {
  id: events.id,
  name: events.name,
  isTest: events.isTest,
  manual: events.manual,
  postPublic: events.postPublic,
  discordPublicMessageId: events.discordPublicMessageId,
  discordAdminMessageId: events.discordAdminMessageId,
  beforeAt: events.beforeAt,
  afterAt: events.afterAt,
};

export interface NewEvent {
  name: string;
  eventAtUtc: Date;
  beforeAt: Date;
  afterAt: Date;
}

/**
 * The scheduled event at `eventAtUtc`, created on first use with no alliances (the BEFORE run copies
 * them). Insert-or-nothing then select, so two concurrent ticks end up with the same row.
 */
export async function findOrCreateEvent(db: Db, event: NewEvent): Promise<EventInfo> {
  await db
    .insert(events)
    .values({ ...event, allianceIds: [] })
    .onConflictDoNothing({ target: events.eventAtUtc });
  const [row] = await db
    .select(infoColumns)
    .from(events)
    .where(eq(events.eventAtUtc, event.eventAtUtc));
  if (!row) throw new Error("event row missing after insert");
  return row;
}

export async function getEventInfo(db: Db, eventId: number): Promise<EventInfo | null> {
  const [row] = await db.select(infoColumns).from(events).where(eq(events.id, eventId));
  return row ?? null;
}

/** A public event with no schedule: both phase times are its creation time, so nothing is "not due". */
export async function createManualEvent(
  db: Db,
  name: string,
  now: Date,
  options: { visibility?: ManualVisibility; postPublic?: boolean } = {},
): Promise<EventInfo> {
  const [row] = await db
    .insert(events)
    .values({
      name,
      eventAtUtc: now,
      beforeAt: now,
      afterAt: now,
      allianceIds: [],
      manual: true,
      ...options,
    })
    .returning(infoColumns);
  if (!row) throw new Error("manual event row missing after insert");
  return row;
}

/** D28 controls of a manual round. "admin" and a public Discord post cannot go together. */
export async function setManualSettings(
  db: Db,
  eventId: number,
  change: { visibility?: ManualVisibility; postPublic?: boolean },
): Promise<"ok" | "not-found" | "admin-cannot-post"> {
  const [row] = await db
    .select({ visibility: events.visibility, postPublic: events.postPublic })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.manual, true)));
  if (!row) return "not-found";
  const next = { ...row, ...change };
  if (next.visibility === "admin" && next.postPublic) return "admin-cannot-post";
  await db.update(events).set(next).where(eq(events.id, eventId));
  return "ok";
}

/**
 * Renames a public event (D39): a scheduled event at any time its row exists, a manual round once a
 * snapshot of it exists (D28). A rehearsal is never renamed. The result says why not otherwise.
 */
export async function renameEvent(
  db: Db,
  eventId: number,
  name: string,
): Promise<"ok" | "not-found" | "no-snapshot"> {
  const event = await getEventInfo(db, eventId);
  if (!event || event.isTest) return "not-found";
  if (!event.manual) {
    await db.update(events).set({ name }).where(eq(events.id, eventId));
    return "ok";
  }
  const [any] = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(eq(snapshots.eventId, eventId))
    .limit(1);
  if (!any) return "no-snapshot";
  await db.update(events).set({ name }).where(eq(events.id, eventId));
  return "ok";
}

export async function setDiscordMessageId(
  db: Db,
  eventId: number,
  channel: "public" | "admin",
  messageId: string,
): Promise<void> {
  await db
    .update(events)
    .set(
      channel === "public"
        ? { discordPublicMessageId: messageId }
        : { discordAdminMessageId: messageId },
    )
    .where(eq(events.id, eventId));
}

export interface DuePhase {
  event: EventInfo;
  phase: Phase;
  at: Date;
}

/**
 * Phases of any event (scheduled or rehearsal) whose window [x_at, x_at + window) holds `now` and
 * that have no snapshot row yet, earliest first. The tick runs only the first.
 */
export async function duePhases(db: Db, now: Date, windowMs: number): Promise<DuePhase[]> {
  const opened = new Date(now.getTime() - windowMs);
  const open = (col: typeof events.beforeAt) => and(lte(col, now), gt(col, opened));
  const rows = await db
    .select(infoColumns)
    .from(events)
    // INVARIANT tick.skips-manual: a manual event is never run by the tick (D28).
    .where(and(eq(events.manual, false), or(open(events.beforeAt), open(events.afterAt))));
  const candidates = rows.flatMap((event) =>
    (["before", "after"] as const)
      .map((phase) => ({ event, phase, at: phase === "before" ? event.beforeAt : event.afterAt }))
      .filter(({ at }) => at <= now && at > opened),
  );
  const due: DuePhase[] = [];
  for (const c of candidates) {
    // INVARIANT tick.once-per-phase: the tick never re-runs a phase that has a snapshot row.
    if (!(await findSnapshot(db, c.event.id, c.phase))) due.push(c);
  }
  return due.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Claims the event's Friday check; true for exactly one caller. */
export async function claimQuotaCheck(db: Db, eventId: number, at: Date): Promise<boolean> {
  // INVARIANT tick.friday-check-once
  const rows = await db
    .update(events)
    .set({ quotaCheckedAt: at })
    .where(and(eq(events.id, eventId), isNull(events.quotaCheckedAt)))
    .returning({ id: events.id });
  return rows.length > 0;
}

/** Both snapshots of the scheduled event at this time are complete (not partial, failed or missing). */
export async function scheduledEventDone(db: Db, eventAtUtc: Date): Promise<boolean> {
  const rows = await db
    .select({ phase: snapshots.phase })
    .from(events)
    .innerJoin(snapshots, eq(snapshots.eventId, events.id))
    .where(
      and(
        eq(events.eventAtUtc, eventAtUtc),
        eq(events.manual, false),
        eq(events.isTest, false),
        eq(snapshots.status, "complete"),
      ),
    );
  return new Set(rows.map((r) => r.phase)).size === 2;
}

/** A scheduled event (not a manual round, not a rehearsal) with its Before in [from, to) (D60). */
export async function hasScheduledEvent(db: Db, from: Date, to: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.manual, false),
        eq(events.isTest, false),
        gte(events.beforeAt, from),
        lt(events.beforeAt, to),
      ),
    )
    .limit(1);
  return row !== undefined;
}
