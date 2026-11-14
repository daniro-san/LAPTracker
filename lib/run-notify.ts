// The Discord messages of a finished run (D31): one message per channel per event, posted by the
// first phase and edited by the next, so each message shows the event so far.
import type { AppContext } from "./app-context";
import type { RunSummary } from "./collector";
import type { Db } from "./db";
import { eventImage } from "./event-image";
import {
  adminEventMessage,
  adminSnapshotMessage,
  createNotifier,
  discordClock,
  publicSnapshotMessage,
  rehearsalVerdictMessage,
  type DiscordClock,
  type Notifier,
} from "./notify";
import { getEventDetail } from "./queries";
import { rehearsalVerdict } from "./rehearsal";
import type { Phase } from "./repo";
import { setDiscordMessageId, type EventInfo } from "./repo/events";
import { loadVerdictInput } from "./repo/rehearsals";
import { listPhaseReports, type PhaseReport } from "./repo/snapshots";

interface Request {
  event: EventInfo;
  phase: Phase;
  origin: string;
}
interface Run {
  summary: RunSummary;
  startedAt: Date;
  logWriteFailures: number;
}
interface Shared {
  req: Request;
  run: Run;
  clock: DiscordClock;
  finishedAt: Date;
  notifier: Notifier;
  reports: PhaseReport[];
}

async function storeId(db: Db, shared: Shared, channel: "public" | "admin", id: string | null) {
  const { event } = shared.req;
  const old = channel === "public" ? event.discordPublicMessageId : event.discordAdminMessageId;
  if (id && id !== old) await setDiscordMessageId(db, event.id, channel, id).catch(() => undefined);
}

async function notifyPublic(db: Db, s: Shared) {
  const { event, phase, origin } = s.req;
  // getEventDetail reads real events only: the public message never sees a rehearsal.
  const detail = await getEventDetail(db, event.id).catch(() => {
    console.error("notify.detail_failed", { event_id: event.id });
    return null;
  });
  const rowsOf = (p: Phase) => detail?.snapshots.find((x) => x.phase === p)?.alliances ?? null;
  const alliances = rowsOf(phase);
  const before = phase === "after" ? rowsOf("before") : null;
  const nextAt = phase === "before" && !event.manual ? event.afterAt : null;
  const beforeAt =
    phase === "after" ? (s.reports.find((r) => r.phase === "before")?.finishedAt ?? null) : null;
  // The picture (D58) needs this phase's rows; a failed run or an unread detail sends the text alone.
  const image =
    alliances && alliances.length > 0 && s.run.summary.status !== "failed"
      ? await eventImage({
          eventId: event.id,
          name: event.name,
          manual: event.manual,
          phase,
          clock: s.clock,
          at: s.finishedAt,
          beforeAt,
          nextAt,
          alliances,
          before: before ?? [],
        })
      : null;
  const id = await s.notifier.public(
    publicSnapshotMessage(s.run.summary, {
      clock: s.clock,
      eventUrl: `${origin}/events/${event.id}`,
      finishedAt: s.finishedAt,
      nextAt,
      alliances,
      before,
      roundName: event.manual ? event.name : null,
      beforeAt,
      image: image !== null,
    }),
    event.discordPublicMessageId,
    image,
  );
  await storeId(db, s, "public", id);
}

/** One block per phase run so far: the current one from this run, the other from its row. */
function phaseBlocks(s: Shared, only?: Phase): string[] {
  const { event, phase: current, origin } = s.req;
  const roundName = event.manual ? event.name : null;
  const scheduled = { before: event.beforeAt, after: event.afterAt };
  const phases = (["before", "after"] as const).filter((p) => !only || p === only);
  return phases.flatMap((phase) => {
    const row = s.reports.find((r) => r.phase === phase);
    // The other phase's alliance lists live on its run page, so its block carries none.
    const mine = phase === current;
    const summary = mine ? s.run.summary : row && { ...row, stale: [], failed: [] };
    if (!summary) return [];
    return [
      adminSnapshotMessage(summary, {
        clock: s.clock,
        phase,
        runUrl: `${origin}/admin/runs/${summary.snapshotId}`,
        scheduledAt: scheduled[phase],
        startedAt: mine ? s.run.startedAt : (row?.startedAt ?? s.run.startedAt),
        finishedAt: mine ? s.finishedAt : (row?.finishedAt ?? s.finishedAt),
        logWriteFailures: mine ? s.run.logWriteFailures : 0,
        roundName,
      }),
    ];
  });
}

async function notifyAdmin(ctx: AppContext, db: Db, s: Shared) {
  const { event, phase, origin } = s.req;
  const blocks = phaseBlocks(s);
  if (event.isTest && phase === "after") {
    const verdict = rehearsalVerdict(
      await loadVerdictInput(db, event.id),
      ctx.env.SNAPSHOT_WINDOW_MIN,
    );
    blocks.push(
      rehearsalVerdictMessage(verdict, s.clock.stamp(s.finishedAt), `${origin}/admin/runs`),
    );
  }
  const id = await s.notifier.admin(adminEventMessage(event.name, blocks), {
    test: event.isTest,
    manual: event.manual,
    messageId: event.discordAdminMessageId,
  });
  await storeId(db, s, "admin", id);
  // An edit does not notify, so a run that ended partly or failed also posts a message of its own:
  // problems are never hidden inside an edit, and this one can be linked to (D31). When the event's
  // message was just posted (the first phase, or the old one was gone), it already notified: no copy.
  const posted = id !== null && id !== event.discordAdminMessageId;
  if (s.run.summary.status !== "complete" && !posted) {
    await s.notifier.admin(adminEventMessage(event.name, phaseBlocks(s, phase)), {
      test: event.isTest,
      manual: event.manual,
    });
  }
}

/**
 * Sent only after the snapshot row is final. A test event (rehearsal) never reaches the public
 * channel, its admin message starts with [rehearsal] and ends with the verdict after the AFTER.
 */
export async function notifyFinished(
  ctx: AppContext,
  db: Db,
  req: Request,
  run: Run,
): Promise<void> {
  const shared: Shared = {
    req,
    run,
    clock: discordClock(ctx.env.SERVER_TZ),
    finishedAt: ctx.now(),
    notifier: createNotifier(ctx.env, ctx.fetch),
    reports: await listPhaseReports(db, req.event.id).catch(() => []),
  };
  // INVARIANT notify.test-events-admin-only
  // A manual round posts publicly only when its toggle is on (D28); the server never allows that
  // together with "admin only", and getEventDetail also refuses an admin-only event.
  if (!req.event.isTest && (!req.event.manual || req.event.postPublic)) {
    await notifyPublic(db, shared);
  }
  await notifyAdmin(ctx, db, shared);
}
