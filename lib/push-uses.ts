// Three of the officers' notifications (D148): the Raid Shield check's count, the night's roster read that
// failed after its retry, and a member's "This is me" claim to approve. The roll call reminders are in
// lib/push-tick.ts. Each is claimed once per trigger in `push_marks` (INVARIANT push.once-per-trigger) and
// sent only to the officers of the workspace concerned. Counts and a link only (lock screens).
import { fill, type PushWords } from "./copy-push";
import type { DailyReadSummary } from "./daily-read";
import type { Db } from "./db";
import type { Env } from "./env";
import { notifyOfficers, pushConfig, type Notice, type PushDeps } from "./push";
import { linksToReview } from "./repo/player-links";
import { claimPushMark, workspacesOfUnions } from "./repo/push";
import { getShieldCheck, shieldReadings } from "./repo/shield-checks";
import { getSquadRead } from "./repo/squads";
import { anyRoster } from "./repo/workspace-any-roster";
import { serverDay } from "./schedule";
import { passWindows, type ShieldPass } from "./shield-check";
import { summarize } from "./shield-post";
import type { ShieldTarget } from "./shield-read";

export type UseDeps = PushDeps & {
  env: PushDeps["env"] & Pick<Env, "SERVER_TZ">;
};

/** The Monday of the week holding `day`: the Roll call page of that week (Raid prep). */
const mondayOf = (day: string) => {
  const t = Date.parse(`${day}T00:00:00Z`);
  const back = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
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
 * tick's targets, D134). "{n} not seen with a shield yet": a count, never a name.
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
  const members = (await anyRoster(db, target.unionId))?.members ?? [];
  const read = summarize(members, await shieldReadings(db, target.unionId, w.from, w.to));
  if (read.read === 0) return;
  const n = read.notSeen.length;
  const mark = { workspaceId: target.workspaceId, key: `shield:${day}`, value: `${pass}:${n}` };
  if (!(await claimPushMark(db, mark, deps.now()))) return;
  await notifyOfficers(deps, db, target.workspaceId, "shield", (words) => ({
    title: words.shieldTitle,
    body: fill(n > 0 ? words.shieldSome : words.shieldNone, {
      read: pass === "night" ? words.fri : words.sat,
      n,
    }),
    url: `/w/${target.slug}/roll-call?week=${mondayOf(day)}`,
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
