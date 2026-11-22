// /admin (plan Phase 4, #91): "Needs you" first (issue 585, F11: what waits on the owner, with counts and
// where each is done), then Status, facts only (quota, what runs, the next scheduled run, the last result);
// "Run something now" holds every action with its cost; the last rehearsal; the schedule as read-only
// reference; the workspaces. Dates through the request's clock like the public
// pages (07c S3a): the viewer's locale, server time with the word, no UTC twin.

import { AdminActions } from "@/app/_ui/admin/AdminActions";
import { AdminShell, errorsLastDay } from "@/app/_ui/admin/AdminShell";
import { needsYou } from "@/app/_ui/admin/needs-you";
import { AdminSection, Fact, StateChip } from "@/app/_ui/admin/parts";
import { Rehearsal } from "@/app/_ui/admin/Rehearsal";
import { NeedsYou, QuotaFact, TickFact } from "@/app/_ui/admin/StatusFacts";
import { TrackedCard } from "@/app/_ui/admin/TrackedCard";
import {
  eventWord,
  phaseWord,
  runWord,
  roundView,
  seconds,
  settledRun,
  stateWord,
  currentView,
  dailyView,
  watchViews,
} from "@/app/_ui/admin/words";
import { alliancesOf, readWorkspaces, Workspaces } from "@/app/_ui/admin/Workspaces";
import type { Clock } from "@/app/_ui/format";
import { requestServerClock, requestLocale } from "@/app/_ui/locale";
import { isAdmin } from "@/lib/admin-session";
import { Chip } from "@/lib/brand/components/Chip";
import { FactList } from "@/lib/brand/components/FactList";
import { TextLink } from "@/lib/brand/components/TextLink";
import { copy, fill } from "@/lib/copy";
import { dailyReadEndsInDay } from "@/lib/daily-read";
import { getEnv, type Env } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { ownerTodo } from "@/lib/patch-notes";
import { listRuns, type recentTicks } from "@/lib/queries/admin";
import { loadAdminPage } from "@/lib/queries/admin-page";
import { countWaitingRequests } from "@/lib/queries/alliance-invites";
import { isGeneratedName, lastOccurrence, nextEvent } from "@/lib/schedule";

const t = copy.admin;
const st = t.status;

/** "every Friday, 20:00 server time" for each "fri 20:00" slot of a weekly env value. */
async function weekly(slots: string, env: Env, clock: Clock): Promise<string> {
  const dayName = new Intl.DateTimeFormat(await requestLocale(), {
    weekday: "long",
    timeZone: env.SERVER_TZ,
  });
  return slots
    .split(",")
    .filter((slot) => slot.trim() !== "")
    .map((slot) => {
      const at = lastOccurrence(slot, new Date(), env);
      return fill(t.schedule.weekly, {
        day: dayName.format(at),
        time: `${clock.hhmm(at)} ${copy.time.serverTime}`,
      });
    })
    .join(" · ");
}

type Run = Awaited<ReturnType<typeof listRuns>>[number];
type Tick = Awaited<ReturnType<typeof recentTicks>>[number];

function Status({
  quota,
  running,
  next,
  recent,
  ticks,
  now,
  clock,
}: {
  quota: { remaining: number | null; at: Date } | null;
  now: Date;
  running: ReturnType<typeof watchViews>["running"];
  next: { phase: "before" | "after"; at: Date; event: string; eventAt: Date } | undefined;
  recent: Run[];
  ticks: Tick[];
  clock: Clock;
}) {
  const last = recent[0];
  const durations = recent.flatMap((r) =>
    r.durationMs === null ? [] : [fill(t.runs.seconds, { n: seconds(r.durationMs) })],
  );
  return (
    <AdminSection id="status" title={st.title}>
      <div className="grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
        <QuotaFact quota={quota} now={now} clock={clock} />
        <Fact
          label={st.running}
          value={
            running.length === 0
              ? st.nothing
              : running.map((r) => `${r.phase} · ${r.event}`).join(", ")
          }
          chip={running[0] && <StateChip status="running">{running[0].startedText}</StateChip>}
          note={running.length > 0 ? t.run.live.note : undefined}
        />
        {next && (
          <Fact
            label={st.next}
            value={fill(st.nextValue, { phase: phaseWord(next.phase), at: clock.stamp(next.at) })}
            note={
              isGeneratedName(next.event)
                ? fill(st.nextNoteDated, { at: clock.stamp(next.eventAt) })
                : fill(st.nextNote, { event: next.event, at: clock.stamp(next.eventAt) })
            }
          />
        )}
        <Fact
          label={st.last}
          value={last ? `${eventWord(last, clock)} · ${runWord(last, clock)}` : st.noRun}
          chip={
            last && (
              <StateChip status={last.status}>
                {stateWord(last.status)}
                {last.finishedAt && ` ${clock.hhmm(last.finishedAt)}`}
              </StateChip>
            )
          }
          note={last && <LastRunNote id={last.id} durations={durations} />}
        />
        <TickFact ticks={ticks} now={now} clock={clock} />
      </div>
    </AdminSection>
  );
}

/** "Open" to the last run (no prefetch: the run watch's refreshes would fetch it again, issue 521). */
function LastRunNote({ id, durations }: { id: number; durations: string[] }) {
  return (
    <>
      <TextLink
        href={`/admin/runs/${id}`}
        prefetch={false}
        className="inline-flex min-h-11 items-center"
      >
        {st.open}
      </TextLink>
      {durations.length > 0 && (
        <span className="block tabular-nums">
          {fill(t.runs.recent, { n: durations.length, list: durations.join(" · ") })}
        </span>
      )}
    </>
  );
}

/** The effective schedule, as read from the environment: reference, not controls. */
async function Schedule({
  env,
  next,
  clock,
}: {
  env: Env;
  next: ReturnType<typeof nextEvent>;
  clock: Clock;
}) {
  const s = t.schedule;
  return (
    <AdminSection
      id="schedule"
      title={s.title}
      help={s.help}
      aside={<Chip tone="muted">{s.reference}</Chip>}
    >
      <FactList
        items={[
          { label: s.timeZone, value: env.SERVER_TZ },
          { label: s.nextEvent, value: clock.stamp(next.eventAtUtc) },
          { label: phaseWord("before"), value: clock.stamp(next.beforeAt) },
          { label: phaseWord("after"), value: clock.stamp(next.afterAt) },
          { label: s.grace, value: fill(s.graceValue, { min: env.SNAPSHOT_WINDOW_MIN }) },
          { label: s.quotaCheck, value: await weekly(env.QUOTA_CHECK_AT, env, clock) },
          {
            label: s.rehearsals,
            value:
              env.REHEARSAL_AT === ""
                ? s.rehearsalsOff
                : fill(s.rehearsalsValue, {
                    at: await weekly(env.REHEARSAL_AT, env, clock),
                    keep: env.REHEARSAL_KEEP,
                  }),
          },
        ]}
      />
    </AdminSection>
  );
}

export default async function AdminPage() {
  // Session first (issue 218): locked, the PIN card and no database read.
  if (!(await isAdmin())) return <AdminShell section="/admin" title={t.title} />;
  const env = getEnv();
  const now = new Date();
  const next = nextEvent(now, env);
  const [
    [current, rehearsal, quota, manual, running, runs, row, ticks, daily, cleanups],
    clock,
    ws,
    requests,
    errors,
  ] = await Promise.all([
    withPageDb((db) => loadAdminPage(db, now, env)),
    requestServerClock(),
    readWorkspaces(now),
    withPageDb(countWaitingRequests),
    errorsLastDay(),
  ]);
  // A run left running past RUN_STALE_AFTER_MS is not under "Running now", so not "running" anywhere.
  const recent = runs.map((r) => settledRun(r, now));
  const views = watchViews(running, recent[0], daily, now, clock);
  const nextRun = [
    { phase: "before" as const, at: current.beforeAt, event: current },
    { phase: "after" as const, at: current.afterAt, event: current },
    { phase: "before" as const, at: next.beforeAt, event: next },
    { phase: "after" as const, at: next.afterAt, event: next },
  ].find((c) => c.at > now);
  // No Retry that could run past the server reset (D72): the route refuses it too.
  const dailyRetry = dailyReadEndsInDay(now, env) ? dailyView(daily, now, clock) : null;
  const view = alliancesOf(ws, now);
  const { alliances } = view;
  const needs = needsYou({
    now,
    tick: {
      last: ticks[0]?.startedAt ?? null,
      lastText: ticks[0] ? clock.stamp(ticks[0].startedAt) : null,
    },
    dailyRetry: dailyRetry !== null,
    requests,
    errors24h: errors,
    cleanups: cleanups.map((c) => ({ ...c, dayText: clock.weekday(c.at) })),
    workspaces: alliances,
    deletions: ws.rows.filter((w) => w.deletion).length,
    morningQuota: quota.morning,
    todos: ownerTodo.filter((x) => !x.done).length,
  });
  return (
    <AdminShell section="/admin" title={t.title}>
      <NeedsYou rows={needs} />
      <Status
        quota={quota.newest}
        running={views.running}
        next={
          nextRun && {
            phase: nextRun.phase,
            at: nextRun.at,
            event: nextRun.event === current && row ? row.name : nextRun.event.name,
            eventAt: nextRun.event.eventAtUtc,
          }
        }
        recent={recent}
        ticks={ticks}
        now={now}
        clock={clock}
      />
      <AdminSection id="run" title={t.run.title} help={t.run.intro}>
        <AdminActions
          beforeAtText={clock.stamp(current.beforeAt)}
          current={currentView(current, row, now, clock)}
          manual={manual && roundView(manual, clock)}
          daily={dailyRetry}
          running={views.running}
        />
      </AdminSection>
      <Rehearsal r={rehearsal} clock={clock} />
      <TrackedCard now={now} clock={clock} />
      <Schedule env={env} next={next} clock={clock} />
      <Workspaces now={now} data={ws} view={view} />
    </AdminShell>
  );
}
