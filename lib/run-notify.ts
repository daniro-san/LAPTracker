// The Discord messages of a finished run (D31): one message per channel per event, posted by the
// first phase and edited by the next, so each message shows the event so far. With several windows
// (D160): the public message is posted by window 1's Before and edited only by the last window's After;
// the admin message is edited at each window's end.
import type { AppContext } from "./app-context";
import type { RunSummary } from "./collector";
import { windowedStartRows } from "./compute";
import { copy } from "./copy";
import type { Db } from "./db";
import { eventImage } from "./event-image";
import { flagsOf } from "./flags";
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
import { getEventDetail, memberTurnout } from "./queries";
import { eventMatchup } from "./queries/kvk";
import { rehearsalVerdict } from "./rehearsal";
import type { Phase } from "./repo";
import {
  getEventWindows,
  setDiscordMessageId,
  type EventInfo,
  type EventWindow,
} from "./repo/events";
import { loadVerdictInput } from "./repo/rehearsals";
import { listPhaseReports, otherShortSample, type PhaseReport } from "./repo/snapshots";
import { reportError } from "./report-error";
import { fill } from "./words";

interface Request {
  event: EventInfo;
  phase: Phase;
  /** The event window of this phase (D160); 1 when left out. */
  window?: number;
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
  /** The event's windows (D160): one for most events. */
  windows: EventWindow[];
}

/** This run's window (D160). */
const windowOf = (req: Request) => req.window ?? 1;

async function storeId(db: Db, shared: Shared, channel: "public" | "admin", id: string | null) {
  const { event } = shared.req;
  const old = channel === "public" ? event.discordPublicMessageId : event.discordAdminMessageId;
  if (id && id !== old) await setDiscordMessageId(db, event.id, channel, id).catch(() => undefined);
}

/** The End's turnout (#271), read once for the picture and the text; null for the Start, an unread detail,
 * a failed read or while the `war-turnout` flag is off (D91). */
async function endTurnout(
  db: Db,
  eventId: number,
  phase: Phase,
  detail: {
    snapshots: Parameters<typeof memberTurnout>[1];
    between?: Parameters<typeof memberTurnout>[2];
  } | null,
  ctx: Pick<AppContext, "env" | "fetch">,
) {
  if (phase !== "after" || !detail || !(await flagsOf(ctx.env, ctx.fetch)).has("war-turnout"))
    return null;
  return memberTurnout(db, detail.snapshots, detail.between).catch((error: unknown) => {
    console.error("notify.turnout_failed", { event_id: eventId });
    reportError(ctx, { route: "lib/run-notify.ts", kind: "notify.turnout_failed", error });
    return null;
  });
}

/** The End picture's KvK block (D152): each side's Start to End, while the `kvk-matchup` flag is on; null
 * otherwise, for the Start, or when the read fails (the picture goes without it). */
async function endKvk(
  db: Db,
  eventId: number,
  phase: Phase,
  ctx: Pick<AppContext, "env" | "fetch">,
) {
  if (phase !== "after" || !(await flagsOf(ctx.env, ctx.fetch)).has("kvk-matchup")) return null;
  const m = await eventMatchup(db, eventId).catch((error: unknown) => {
    reportError(ctx, { route: "lib/run-notify.ts", kind: "notify.kvk_failed", error });
    return null;
  });
  const { us, them } = m?.matchup ?? {};
  if (!m || !us?.change || !them?.change) return null;
  return { server: m.server, us: us.change, them: them.change };
}

type Detail = Awaited<ReturnType<typeof getEventDetail>>;

/** This phase's rows and, on the End, the Start's rows its changes are measured from: shifted by what
 * changed between the windows (D160), so each change is the sum of the windows' changes. Never shown. */
function publicSides(detail: Detail, phase: Phase) {
  const rowsOf = (p: Phase) => detail?.snapshots.find((x) => x.phase === p)?.alliances ?? null;
  const start = phase === "after" ? rowsOf("before") : null;
  return {
    alliances: rowsOf(phase),
    before: start && windowedStartRows(start, detail?.between ?? []),
  };
}

/** When the event's Start finished, on the End's message (window 1's Before). */
const startFinishedAt = (s: Shared) =>
  s.req.phase === "after"
    ? (s.reports.find((r) => r.phase === "before" && r.window === 1)?.finishedAt ?? null)
    : null;

async function notifyPublic(db: Db, s: Shared, ctx: Pick<AppContext, "env" | "fetch">) {
  const { event, phase, origin } = s.req;
  // getEventDetail reads real events only: the public message never sees a rehearsal.
  const detail = await getEventDetail(db, event.id).catch((error: unknown) => {
    console.error("notify.detail_failed", { event_id: event.id });
    reportError(ctx, { route: "lib/run-notify.ts", kind: "notify.detail_failed", error });
    return null;
  });
  const { alliances, before } = publicSides(detail, phase);
  // The next update the public message names is the event's End (the last window's After).
  const nextAt = phase === "before" && !event.manual ? event.afterAt : null;
  const beforeAt = startFinishedAt(s);
  const [turnout, kvk] = await Promise.all([
    endTurnout(db, event.id, phase, detail, ctx),
    endKvk(db, event.id, phase, ctx),
  ]);
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
          turnout,
          kvk,
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
      turnout,
    }),
    event.discordPublicMessageId,
    image,
  );
  await storeId(db, s, "public", id);
}

/** One block per phase run so far, window by window (D160): the current one from this run, the others from
 * their rows. `only`: this run's block alone. */
function phaseBlocks(s: Shared, only?: Phase): string[] {
  const { event, phase: current } = s.req;
  const roundName = event.manual ? event.name : null;
  const slots = s.windows.flatMap((w) =>
    (["before", "after"] as const).map((phase) => ({
      phase,
      window: w.n,
      at: phase === "before" ? w.beforeAt : w.afterAt,
    })),
  );
  const own = (x: { phase: Phase; window: number }) =>
    x.phase === current && x.window === windowOf(s.req);
  return slots.flatMap((slot) => {
    if (only && !own(slot)) return [];
    if (own(slot))
      return [
        adminSnapshotMessage(s.run.summary, {
          ...blockTimes(s, slot, s.run.summary.snapshotId, roundName),
          startedAt: s.run.startedAt,
          finishedAt: s.finishedAt,
          logWriteFailures: s.run.logWriteFailures,
        }),
      ];
    const row = s.reports.find((r) => r.phase === slot.phase && r.window === slot.window);
    // The other phases' alliance lists live on their run pages, so their blocks carry none.
    if (!row) return [];
    return [
      adminSnapshotMessage(
        { ...row, stale: [], failed: [] },
        {
          ...blockTimes(s, slot, row.snapshotId, roundName),
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          logWriteFailures: 0,
        },
      ),
    ];
  });
}

/** An admin block's clock, phase, scheduled time, run link and round name. */
const blockTimes = (
  s: Shared,
  slot: { phase: Phase; at: Date },
  snapshotId: number,
  roundName: string | null,
) => ({
  clock: s.clock,
  phase: slot.phase,
  runUrl: `${s.req.origin}/admin/runs/${snapshotId}`,
  scheduledAt: slot.at,
  roundName,
});

async function notifyAdmin(ctx: AppContext, db: Db, s: Shared) {
  const { event, phase, origin } = s.req;
  // D160 (owner answer 16): the event's message is edited at each window's end, not at a later window's
  // Before; a later Before that falls short still posts its own message below.
  if (phase === "before" && windowOf(s.req) > 1) {
    if (s.run.summary.status !== "complete") await postShort(s, phaseBlocks(s, phase));
    return;
  }
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
  if (s.run.summary.status !== "complete" && !posted) await postShort(s, phaseBlocks(s, phase));
}

/** A run that ended partly or failed: its own admin message, which notifies (D31). */
async function postShort(s: Shared, blocks: string[]) {
  const { event } = s.req;
  await s.notifier.admin(adminEventMessage(event.name, blocks), {
    test: event.isTest,
    manual: event.manual,
  });
}

/** The public message is posted by the event's Start and edited only by its End (D160): a Before or After
 * between windows posts nothing public. */
const publicTurn = (req: Request, windows: EventWindow[]) =>
  req.phase === "before" ? windowOf(req) === 1 : windowOf(req) === windows.length;

/**
 * A sample's Discord rule (D69): nothing public; on the admin channel, the first sample of the event that
 * ends partial or failed posts one message of its own, and later ones post nothing (their runs are on
 * /admin/runs), so a long outage is one message per event, never one per sample. The event's own message
 * (D31) is not edited: it keeps its Before and After blocks.
 */
export async function notifySample(
  ctx: AppContext,
  db: Db,
  req: { event: EventInfo; slotAt: Date; window?: number; origin: string },
  run: Run,
): Promise<void> {
  const { summary } = run;
  if (summary.status === "complete") return;
  // INVARIANT notify.sample-once-per-event, per window since D160 (owner answer 16).
  if (await otherShortSample(db, req.event.id, summary.snapshotId, req.window ?? 1)) return;
  const clock = discordClock(ctx.env.SERVER_TZ);
  const block = adminSnapshotMessage(summary, {
    clock,
    phase: "sample",
    runUrl: `${req.origin}/admin/runs/${summary.snapshotId}`,
    scheduledAt: req.slotAt,
    startedAt: run.startedAt,
    finishedAt: ctx.now(),
    logWriteFailures: run.logWriteFailures,
  });
  const once = fill(copy.discord.admin.sampleOnce, { url: `${req.origin}/admin/runs` });
  await createNotifier(ctx.env, ctx.fetch).admin(
    adminEventMessage(req.event.name, [`${block}\n${once}`]),
    { test: req.event.isTest },
  );
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
    // A failed read is one window, as the event's own times give it: the message still goes.
    windows: await getEventWindows(db, req.event).catch(() => [
      { n: 1, beforeAt: req.event.beforeAt, afterAt: req.event.afterAt },
    ]),
  };
  // INVARIANT notify.test-events-admin-only
  // A manual round posts publicly only when its toggle is on (D28); the server never allows that
  // together with "admin only", and getEventDetail also refuses an admin-only event.
  if (
    !req.event.isTest &&
    (!req.event.manual || req.event.postPublic) &&
    publicTurn(req, shared.windows)
  ) {
    await notifyPublic(db, shared, ctx);
  }
  await notifyAdmin(ctx, db, shared);
}
