// Three of the officers' notifications (D148): the Raid Shield check's count, the night's roster read that
// failed after its retry, and a member's "This is me" claim to approve. The roll call reminders are in
// lib/push-tick.ts. Each is claimed once per trigger in `push_marks` (INVARIANT push.once-per-trigger) and
// sent only to the officers of the workspace concerned. Counts and a link only (lock screens).
import type { PushWords } from "./copy-push";
import type { DailyReadSummary } from "./daily-read";
import type { Db } from "./db";
import type { Env } from "./env";
import { notifyOfficers, pushConfig, type Notice, type PushDeps } from "./push";
import { membersOfRaid, raidPrepUrl } from "./raid-prep-fill";
import { linksToReview } from "./repo/player-links";
import { claimPushMark, workspacesOfUnions } from "./repo/push";
import { getShieldCheck, shieldReadings } from "./repo/shield-checks";
import { getSquadRead } from "./repo/squads";
import { serverDay } from "./schedule";
import { passWindows, type ShieldPass } from "./shield-check";
import { summarize } from "./shield-post";
import type { ShieldTarget } from "./shield-read";
import { fill } from "./words";

export type UseDeps = PushDeps & {
  env: PushDeps["env"] & Pick<Env, "SERVER_TZ">;
};

/** Whether the read of `pass` is over for now: Friday's squads burst not running, Saturday's done or stopped. */
async function passOver(db: Db, q: { day: string; unionId: number }, pass: ShieldPass) {
  if (pass === "night") return (await getSquadRead(db, q.day, q.unionId))?.status !== "running";
  const status = (await getShieldCheck(db, q))?.morningStatus;
  return status === "done" || status === "stopped";
}

/**
 * The Raid Shield check's notification (D137's two reads): when a read is over, or when its count changed
 * since the last one sent (a later tick read the retries). Only for alliances whose `shield_check` is on (the
 * tick's targets, D134). "{n} not seen with a shield yet": a count, never a name, away members left out.
 */
export async function pushShield(
  deps: UseDeps,
  db: Db,
  run: { day: string; target: ShieldTarget; pass: ShieldPass },
): Promise<void> {
  const { day, target, pass } = run;
  if (target.workspaceId === null || !pushConfig(deps.env)) return;
  const q = { day, unionId: target.unionId };
  if (!(await passOver(db, q, pass))) return;
  const w = passWindows(day, deps.env)[pass];
  // Away members are left out of the count, as the summary leaves them out of its names (D137, 2026-11-22).
  const { members, away } = await membersOfRaid(db, target, day, deps.env.SERVER_TZ);
  const read = summarize(members, await shieldReadings(db, target.unionId, w.from, w.to), away);
  if (read.read === 0) return;
  const n = read.notSeen.length;
  const mark = { workspaceId: target.workspaceId, key: `shield:${day}`, value: `${pass}:${n}` };
  if (!(await claimPushMark(db, mark, deps.now()))) return;
  const url = await raidPrepUrl(db, { id: target.workspaceId, slug: target.slug }, day);
  await notifyOfficers(deps, db, target.workspaceId, "shield", (words) => ({
    title: words.shieldTitle,
    // "Every member read was seen" only when no away member was left out unseen either.
    body: fill(n > 0 || read.away > 0 ? words.shieldSome : words.shieldNone, {
      read: pass === "night" ? words.fri : words.sat,
      n,
    }),
    url,
    tag: `shield-${day}`,
  }));
}

/**
 * The night's roster read failed for a workspace's alliance after its automatic retry (D72): one notification
 * per workspace and day, linking to the desk, whose status bar says the same (D135).
 */
export async function pushNightRead(deps: UseDeps, db: Db, summary: DailyReadSummary) {
  if (!pushConfig(deps.env)) return;
  const failed = await workspacesOfUnions(
    db,
    summary.failed.map((f) => f.unionId),
  );
  for (const ws of failed) {
    const mark = { workspaceId: ws.id, key: `night:${summary.day}`, value: "failed" };
    if (!(await claimPushMark(db, mark, deps.now()))) continue;
    const notice = (w: PushWords): Notice => ({
      title: w.nightTitle,
      body: w.nightBody,
      url: `/w/${ws.slug}`,
      tag: `night-${summary.day}`,
    });
    await notifyOfficers(deps, db, ws.id, "night_read", notice);
  }
}

/**
 * A member's "This is me" waits for an officer (D142): one notification per member and server day, so a
 * member who claims, drops and claims again notifies once. The count is every claim waiting.
 */
export async function pushClaim(
  deps: UseDeps,
  db: Db,
  ws: { id: number; slug: string },
  userId: number,
) {
  if (!pushConfig(deps.env)) return;
  const now = deps.now();
  const mark = { workspaceId: ws.id, key: `claim:${userId}`, value: serverDay(now, deps.env) };
  if (!(await claimPushMark(db, mark, now))) return;
  const n = (await linksToReview(db, ws.id)).length;
  if (n === 0) return;
  await notifyOfficers(deps, db, ws.id, "claim", (w) => ({
    title: w.claimTitle,
    body: fill(w.claimBody, { n }),
    url: `/w/${ws.slug}#to-review`,
    tag: "claim",
  }));
}
