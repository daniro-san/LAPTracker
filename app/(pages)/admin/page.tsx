// /admin (plan Phase 4): the effective schedule, the data requests left, the rehearsal, the run buttons.
// Dates through the request's clock like the public pages (07c S3a): the viewer's locale, server time
// with the word, no UTC twin.
import { AdminActions } from "@/app/_ui/admin/AdminActions";
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { phaseWord, stateWord } from "@/app/_ui/admin/words";
import type { Clock } from "@/app/_ui/format";
import { requestClock, requestLocale } from "@/app/_ui/locale";
import { FactList } from "@/lib/brand/components/FactList";
import { copy, fill } from "@/lib/copy";
import { getEnv, type Env } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import {
  latestManualEvent,
  latestQuota,
  latestRehearsal,
  listRuns,
  runningSnapshots,
  type RehearsalStatus,
} from "@/lib/queries/admin";
import { currentEvent, lastOccurrence, nextEvent } from "@/lib/schedule";

const t = copy.admin;

const MUTED = "text-ink/70";

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

function Rehearsal({ r, clock }: { r: RehearsalStatus | null; clock: Clock }) {
  if (!r) return <p className={MUTED}>{t.rehearsal.none}</p>;
  return (
    <div>
      {r.verdict && (
        <p className="text-lg font-semibold">
          {r.verdict.pass ? t.rehearsal.pass : t.rehearsal.fail}
        </p>
      )}
      <p className="break-words font-medium">
        {t.runs.rehearsal} {clock.stamp(r.eventAtUtc)}
      </p>
      <ul className="mb-3 text-sm">
        {(["before", "after"] as const).map((phase) => {
          const p = r.phases.find((x) => x.phase === phase);
          return (
            <li key={phase}>
              {fill(t.rehearsal.phase, {
                phase: phaseWord(phase),
                state: p
                  ? `${stateWord(p.status)}${p.error ? ` (${p.error})` : ""}`
                  : t.rehearsal.notRun,
                at: clock.stamp(phase === "before" ? r.beforeAt : r.afterAt),
              })}
            </li>
          );
        })}
      </ul>
      {r.verdict && (
        <>
          <h3 className="mb-1 text-sm font-semibold">{t.rehearsal.checks}</h3>
          <ul className="text-sm">
            {r.verdict.lines.map((l) => (
              <li key={l.text} className="border-b border-rule py-1">
                {l.ok ? "✓" : "✗"} {l.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** An event in words: a manual round by its name, a rehearsal tagged, a real event by its time. */
function eventWord(
  r: { manual: boolean; isTest: boolean; eventName: string; eventAtUtc: Date },
  clock: Clock,
): string {
  return `${r.isTest ? `${t.runs.rehearsal} ` : ""}${r.manual ? r.eventName : clock.stamp(r.eventAtUtc)}`;
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
    <>
      <h2 className="mb-1 mt-10 font-subhead text-display-md font-semibold">{s.title}</h2>
      <p className={`mb-2 text-sm ${MUTED}`}>{s.help}</p>
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
    </>
  );
}

export default async function AdminPage() {
  const env = getEnv();
  const now = new Date();
  const next = nextEvent(now, env);
  const current = currentEvent(now, env);
  const [[rehearsal, quota, manual, running, [lastRun]], clock] = await Promise.all([
    withPageDb((db) =>
      Promise.all([
        latestRehearsal(db, env.SNAPSHOT_WINDOW_MIN),
        latestQuota(db),
        latestManualEvent(db),
        runningSnapshots(db, now),
        listRuns(db, 1),
      ]),
    ),
    requestClock(),
  ]);
  const nextRun = [
    { phase: "before" as const, at: current.beforeAt },
    { phase: "after" as const, at: current.afterAt },
    { phase: "before" as const, at: next.beforeAt },
    { phase: "after" as const, at: next.afterAt },
  ].find((c) => c.at > now);
  return (
    <AdminShell title={t.title}>
      <h2 className="mb-1 font-subhead text-display-md font-semibold">{t.quota.title}</h2>
      <p>
        {quota?.remaining != null
          ? fill(t.quota.left, { n: quota.remaining, at: clock.stamp(quota.at) })
          : t.quota.none}
      </p>
      <h2 className="mb-1 mt-10 font-subhead text-display-md font-semibold">{t.run.title}</h2>
      <p className={`text-sm ${MUTED}`}>{t.run.intro}</p>
      <p className="text-sm">{fill(t.run.event, { event: clock.stamp(current.eventAtUtc) })}</p>
      {nextRun && (
        <p className="text-sm">
          {fill(t.run.live.next, { phase: phaseWord(nextRun.phase), at: clock.stamp(nextRun.at) })}
        </p>
      )}
      <AdminActions
        beforeAtText={clock.stamp(current.beforeAt)}
        manual={manual}
        running={running.map((r) => ({
          phase: phaseWord(r.phase),
          event: eventWord(r, clock),
          startedText: clock.stamp(r.startedAt),
        }))}
        latest={
          lastRun
            ? { event: eventWord(lastRun, clock), phase: lastRun.phase, status: lastRun.status }
            : null
        }
      />
      <h2 className="mb-1 mt-10 font-subhead text-display-md font-semibold">{t.rehearsal.title}</h2>
      <p className={`mb-2 text-sm ${MUTED}`}>{t.rehearsal.help}</p>
      <Rehearsal r={rehearsal} clock={clock} />
      <Schedule env={env} next={next} clock={clock} />
    </AdminShell>
  );
}
