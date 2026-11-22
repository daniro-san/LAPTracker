// The tick's share of the Raid Shield check (issue 474, D137): after the squads batch (lib/squads-tick.ts),
// on the same connection and inside the same `after`, the read that is due now for each alliance whose
// `shield_check` is on (D134): Friday's burst from 23:30 ST, Saturday's morning read from the alliance's
// morning time. Then each alliance's leaders' message is posted or edited, and its officers notified when a
// read is over or its count changed (lib/push-uses.ts, D148). Nothing runs at other times. The tick no
// longer marks Raid prep from the readings (D137, 2026-11-22, issue 726): officers mark, the tiles show the
// readings, until the officers' marks and the readings are shown to agree (lib/raid-prep-fill.ts keeps the
// fill for that day).
import type { Db } from "./db";
import type { Env } from "./env";
import { pushShield } from "./push-uses";
import { getDailyRead } from "./repo/daily-reads";
import { allShieldSettings } from "./repo/shield-checks";
import { shieldWindowOpen } from "./shield-check";
import { postShieldSummary, type PostDeps } from "./shield-post";
import { passesAt, shieldMorning, shieldNight, type ShieldTarget } from "./shield-read";
import type { SquadsDeps } from "./squads-read";
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
 * Runs the due reads until `deadline` (epoch ms: the tick's budget), then the messages, then the officers'
 * notifications. A read never runs past its own end: 00:00 ST for Friday's, 12:00 ST for Saturday's.
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
  // D148: the officers' notifications last, all at once (each send has its own 5 s timeout); one that
  // fails never fails the read or the summary: a code-only line.
  const pushed = await Promise.allSettled(
    due.map((d) => pushShield(deps, db, { day: d.day, target: d.target, pass: d.pass })),
  );
  if (pushed.some((p) => p.status === "rejected")) console.error("push.failed", { use: "shield" });
}
