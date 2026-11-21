// The tick's share of the Raid Shield check (issue 474, D137): after the squads batch (lib/squads-tick.ts),
// on the same connection and inside the same `after`, the read that is due now for each alliance whose
// `shield_check` is on (D134): Friday's burst from 23:30 ST, Saturday's morning read from the alliance's
// morning time. Then each alliance's leaders' message is posted or edited, and its workspace's Raid prep
// filled from the readings (lib/raid-prep-fill.ts, D137 2026-11-21), and its officers notified when a read is
// over or its count changed (lib/push-uses.ts, D148). Nothing runs at other times.
import { captureServer, eventWorkspace } from "./analytics/server";
import type { Db } from "./db";
import type { Env } from "./env";
import { pushShield } from "./push-uses";
import { fillRaidPrep } from "./raid-prep-fill";
import { getDailyRead } from "./repo/daily-reads";
import { allShieldSettings } from "./repo/shield-checks";
import { settingsById } from "./repo/workspace-features";
import { shieldWindowOpen } from "./shield-check";
import { postShieldSummary, type PostDeps } from "./shield-post";
import { passesAt, shieldMorning, shieldNight, type ShieldTarget } from "./shield-read";
import type { SquadsDeps } from "./squads-read";
import { resolveFeatures } from "./workspace-features";
import { squadTargets } from "./workspace-keys";

/** The shield-check alliances, each with its own settings. */
async function shieldTargets(deps: SquadsDeps, db: Db, now: Date): Promise<ShieldTarget[]> {
  const [targets, settings] = await Promise.all([
    squadTargets(db, deps.env.WORKSPACE_KEYS_SECRET, now, "shield_check"),
    allShieldSettings(db),
  ]);
  return targets.map((t) => ({
    ...t,
    settings: t.workspaceId === null ? null : (settings.get(t.workspaceId) ?? null),
  }));
}

type TickDeps = SquadsDeps & {
  origin: string;
  env: SquadsDeps["env"] &
    Pick<
      Env,
      | "WORKSPACE_DISCORD_WEBHOOKS"
      | "SERVER_TZ"
      | "VERCEL_ENV"
      | "POSTHOG_KEY"
      | "VAPID_PUBLIC_KEY"
      | "VAPID_PRIVATE_KEY"
      | "VAPID_SUBJECT"
    >;
};

/**
 * Runs the due reads until `deadline` (epoch ms: the tick's budget), then the messages, then the Raid prep
 * fill. A read never runs past its own end: 00:00 ST for Friday's, 12:00 ST for Saturday's.
 */
export async function shieldTick(deps: TickDeps, db: Db, deadline: number): Promise<void> {
  const now = deps.now();
  // The clock first: outside Friday's and Saturday's windows no workspace or setting is read.
  if (!shieldWindowOpen(now, deps.env)) return;
  const due = passesAt(now, deps, await shieldTargets(deps, db, now));
  const [first] = due;
  if (!first) return;
  // Friday's burst reads the day's squads queue, made after the day's roster read.
  const daily = await getDailyRead(db, first.day);
  if (!daily || daily.status === "running") return;
  const night = due.filter((d) => d.pass === "night");
  if (night[0]) {
    const until = Math.min(deadline, night[0].endsAt.getTime());
    await shieldNight(deps, db, { day: first.day, targets: night.map((d) => d.target), until });
  }
  await Promise.all(
    due
      .filter((d) => d.pass === "morning")
      .map((d) =>
        shieldMorning(deps, db, {
          day: d.day,
          target: d.target,
          until: Math.min(deadline, d.endsAt.getTime()),
        }),
      ),
  );
  const post: PostDeps = { env: deps.env, fetch: deps.fetch, now: deps.now, origin: deps.origin };
  for (const d of due)
    await postShieldSummary(post, db, { day: d.day, target: d.target, pass: d.pass });
  // Each workspace's fill on its own: one that fails never stops the others, and its error leaves as a code
  // only (a query's text could hold a member's uid and mark, D71).
  let failed = false;
  for (const d of due) await fillPrep(deps, db, d.day, d.target).catch(() => (failed = true));
  // D148: the officers' notifications last, all at once (each send has its own 5 s timeout); one that
  // fails never fails the read, the summary or the fill: a code-only line.
  const pushed = await Promise.allSettled(
    due.map((d) => pushShield(deps, db, { day: d.day, target: d.target, pass: d.pass })),
  );
  if (pushed.some((p) => p.status === "rejected")) console.error("push.failed", { use: "shield" });
  if (failed) throw new Error("raid_prep_fill_failed");
}

/**
 * D137 (2026-11-21): the workspace's Raid prep gets the tracker's night check (✓) or morning check (✓ or
 * ✗ No shield seen), for an officer to check; never over an officer's mark, never to Discord. Only while
 * the Roll call tab is on too. One `ws_roll_call_marked` per fill that wrote marks: the count only.
 */
async function fillPrep(deps: TickDeps, db: Db, day: string, target: ShieldTarget) {
  if (target.workspaceId === null) return;
  const found = await settingsById(db, target.workspaceId);
  if (!found || !resolveFeatures(found.settings, []).on.has("roll_call")) return;
  const scope = { workspaceId: target.workspaceId, unionId: target.unionId };
  const marks = await fillRaidPrep(db, scope, day, { now: deps.now(), zone: deps.env.SERVER_TZ });
  if (marks === 0) return;
  await captureServer(deps.env, deps.fetch, [
    {
      event: "ws_roll_call_marked",
      properties: { how: "tracker", marks },
      where: eventWorkspace(target),
    },
  ]);
}
