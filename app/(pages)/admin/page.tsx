// /admin (plan Phase 4): the effective schedule, the data requests left, the rehearsal, the run buttons.
// Dates through the request's clock like the public pages (07c S3a): the viewer's locale, server time
// with the word, no UTC twin.
import { AdminActions } from "@/app/_ui/admin/AdminActions";
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { phaseWord, stateWord } from "@/app/_ui/admin/words";
import type { Clock } from "@/app/_ui/format";
import { requestClock, requestLocale } from "@/app/_ui/locale";
import { copy, fill } from "@/lib/copy";
import { getEnv, type Env } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import {
  latestManualEvent,
  latestQuota,
  latestRehearsal,
  type RehearsalStatus,
} from "@/lib/queries/admin";
import { currentEvent, lastOccurrence, nextEvent } from "@/lib/schedule";

const t = copy.admin;

const MUTED = "text-ink/70";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-rule py-2 sm:flex-row sm:gap-4">
      <dt className={`shrink-0 text-sm sm:w-48 ${MUTED}`}>{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

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
      <p className="break-words font-medium">
        {t.runs.rehearsal} {clock.stamp(r.eventAtUtc)}
      </p>
      <ul className="mb-2 text-sm">
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
          <p className="font-semibold">{r.verdict.pass ? t.rehearsal.pass : t.rehearsal.fail}</p>
          <ul className="text-sm">
            {r.verdict.lines.map((l) => (
              <li key={l.text}>
                {l.ok ? "✓" : "✗"} {l.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default async function AdminPage() {
  const env = getEnv();
  const now = new Date();
  const next = nextEvent(now, env);
  const current = currentEvent(now, env);
  const [[rehearsal, quota, manual], clock] = await Promise.all([
    withPageDb((db) =>
      Promise.all([
        latestRehearsal(db, env.SNAPSHOT_WINDOW_MIN),
        latestQuota(db),
        latestManualEvent(db),
      ]),
    ),
    requestClock(),
  ]);
  const s = t.schedule;
  return (
    <AdminShell title={t.title}>
      <h2 className="mb-1 font-subhead text-display-md font-semibold">{s.title}</h2>
      <dl className="mb-6">
        <Row label={s.timeZone} value={env.SERVER_TZ} />
        <Row label={s.nextEvent} value={clock.stamp(next.eventAtUtc)} />
        <Row label={phaseWord("before")} value={clock.stamp(next.beforeAt)} />
        <Row label={phaseWord("after")} value={clock.stamp(next.afterAt)} />
        <Row label={s.grace} value={fill(s.graceValue, { min: env.SNAPSHOT_WINDOW_MIN })} />
        <Row label={s.quotaCheck} value={await weekly(env.QUOTA_CHECK_AT, env, clock)} />
        <Row
          label={s.rehearsals}
          value={
            env.REHEARSAL_AT === ""
              ? s.rehearsalsOff
              : fill(s.rehearsalsValue, {
                  at: await weekly(env.REHEARSAL_AT, env, clock),
                  keep: env.REHEARSAL_KEEP,
                })
          }
        />
      </dl>
      <h2 className="mb-1 font-subhead text-display-md font-semibold">{t.quota.title}</h2>
      <p className="mb-6">
        {quota?.remaining != null
          ? `${fill(t.quota.left, { n: quota.remaining })} (${clock.stamp(quota.at)})`
          : t.quota.none}
      </p>
      <h2 className="mb-2 font-subhead text-display-md font-semibold">{t.run.title}</h2>
      <p className={`text-sm ${MUTED}`}>{t.run.intro}</p>
      <p className="text-sm">{fill(t.run.event, { event: clock.stamp(current.eventAtUtc) })}</p>
      <AdminActions beforeAtText={clock.stamp(current.beforeAt)} manual={manual} />
      <h2 className="mb-2 mt-8 font-subhead text-display-md font-semibold">{t.rehearsal.title}</h2>
      <Rehearsal r={rehearsal} clock={clock} />
    </AdminShell>
  );
}
