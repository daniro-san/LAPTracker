// /admin (plan Phase 4, #91): four framed sections. Status is facts only (quota, what runs, the next
// scheduled run, the last result); "Run something now" holds every action with its cost; the last
// rehearsal; the schedule as read-only reference. Dates through the request's clock like the public
// pages (07c S3a): the viewer's locale, server time with the word, no UTC twin.
import Link from "next/link";

import { AdminActions } from "@/app/_ui/admin/AdminActions";
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { AdminSection, Fact, StateChip } from "@/app/_ui/admin/parts";
import { Rehearsal } from "@/app/_ui/admin/Rehearsal";
import {
  eventWord,
  phaseWord,
  roundView,
  seconds,
  stateWord,
  currentView,
  watchViews,
} from "@/app/_ui/admin/words";
import type { Clock } from "@/app/_ui/format";
import { requestServerClock, requestLocale } from "@/app/_ui/locale";
import { isAdmin } from "@/lib/admin-session";
import { Chip } from "@/lib/brand/components/Chip";
import { FactList } from "@/lib/brand/components/FactList";
import { DroppedStitch, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";
import { getEnv, type Env } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { listRuns, recentTicks } from "@/lib/queries/admin";
import { loadAdminPage } from "@/lib/queries/admin-page";
import { QUOTA_WARN_BELOW } from "@/lib/run";
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

/** Quota: OK at 900 or more, Low under it (plan §3.1, the Friday warning), Unknown before any run. */
function QuotaFact({
  quota,
  now,
  clock,
}: {
  quota: { remaining: number | null; at: Date } | null;
  now: Date;
  clock: Clock;
}) {
  const n = quota?.remaining ?? null;
  if (n === null) {
    return (
      <Fact
        label={st.quota}
        value={<Chip tone="muted">{st.quotaUnknown}</Chip>}
        note={st.quotaNone}
      />
    );
  }
  // The quota resets every UTC day: an older reading says when it is from and carries no verdict.
  if (!quota || quota.at.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10)) {
    return (
      <Fact
        label={st.quota}
        value={fill(st.quotaValue, { n })}
        chip={<Chip tone="muted">{st.quotaOld}</Chip>}
        note={quota && fill(st.quotaNoteOld, { at: clock.stamp(quota.at) })}
      />
    );
  }
  const low = n < QUOTA_WARN_BELOW;
  return (
    <Fact
      label={st.quota}
      value={fill(st.quotaValue, { n })}
      chip={
        <Chip tone={low ? "seal" : "ink"} icon={low ? <DroppedStitch /> : <StitchedCheck />}>
          {low ? fill(st.quotaLow, { n: QUOTA_WARN_BELOW }) : st.quotaOk}
        </Chip>
      }
      note={quota && fill(st.quotaNote, { at: clock.stamp(quota.at) })}
    />
  );
}

type Run = Awaited<ReturnType<typeof listRuns>>[number];
type Tick = Awaited<ReturnType<typeof recentTicks>>[number];

/** The scheduler's heartbeat (D45): the newest tick in server time, and what the last few did. */
function TickFact({ ticks, clock }: { ticks: Tick[]; clock: Clock }) {
  const outcome = (o: string | null) =>
    st.tickOutcome[(o ?? "none") as keyof typeof st.tickOutcome] ?? o;
  return (
    <Fact
      label={st.tick}
      value={ticks[0] ? clock.stamp(ticks[0].startedAt) : st.noTick}
      note={
        ticks.length > 0 &&
        fill(st.tickNote, { list: ticks.map((k) => outcome(k.outcome)).join(" · ") })
      }
    />
  );
}

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
          value={last ? `${eventWord(last, clock)} · ${phaseWord(last.phase)}` : st.noRun}
          chip={
            last && (
              <StateChip status={last.status}>
                {stateWord(last.status)}
                {last.finishedAt && ` ${clock.hhmm(last.finishedAt)}`}
              </StateChip>
            )
          }
          note={
            last && (
              <>
                <Link
                  href={`/admin/runs/${last.id}`}
                  className="inline-flex min-h-11 items-center text-plum underline"
                >
                  {st.open}
                </Link>
                {durations.length > 0 && (
                  <span className="block tabular-nums">
                    {fill(t.runs.recent, { n: durations.length, list: durations.join(" · ") })}
                  </span>
                )}
              </>
            )
          }
        />
        <TickFact ticks={ticks} clock={clock} />
      </div>
    </AdminSection>
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
  if (!(await isAdmin())) return <AdminShell title={t.title} />;
  const env = getEnv();
  const now = new Date();
  const next = nextEvent(now, env);
  const [[current, rehearsal, quota, manual, running, recent, row, ticks], clock] =
    await Promise.all([withPageDb((db) => loadAdminPage(db, now, env)), requestServerClock()]);
  const views = watchViews(running, recent[0], clock);
  const nextRun = [
    { phase: "before" as const, at: current.beforeAt, event: current },
    { phase: "after" as const, at: current.afterAt, event: current },
    { phase: "before" as const, at: next.beforeAt, event: next },
    { phase: "after" as const, at: next.afterAt, event: next },
  ].find((c) => c.at > now);
  return (
    <AdminShell title={t.title}>
      <Status
        quota={quota}
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
          running={views.running}
        />
      </AdminSection>
      <Rehearsal r={rehearsal} clock={clock} />
      <Schedule env={env} next={next} clock={clock} />
    </AdminShell>
  );
}
