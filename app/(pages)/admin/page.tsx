// /admin (plan Phase 4): the effective schedule, the data requests left, the rehearsal, the run buttons.
const t = copy.admin;
import { AdminActions } from "@/app/_ui/admin/AdminActions";
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { copy, fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { latestQuota, latestRehearsal, type RehearsalStatus } from "@/lib/queries/admin";
import { currentEvent, describeInstant, nextEvent } from "@/lib/schedule";

const MUTED = "text-ink/70";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-rule py-2 sm:flex-row sm:gap-4">
      <dt className={`shrink-0 text-sm sm:w-48 ${MUTED}`}>{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function Rehearsal({ r }: { r: RehearsalStatus | null }) {
  if (!r) return <p className={MUTED}>{t.rehearsal.none}</p>;
  return (
    <div>
      <p className="break-words font-medium">{r.name}</p>
      <ul className="mb-2 text-sm">
        {(["before", "after"] as const).map((phase) => {
          const p = r.phases.find((x) => x.phase === phase);
          return (
            <li key={phase}>
              {fill(t.rehearsal.phase, {
                phase,
                state: p ? `${p.status}${p.error ? ` (${p.error})` : ""}` : t.rehearsal.notRun,
                at: utcStamp(phase === "before" ? r.beforeAt : r.afterAt),
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
  const [rehearsal, quota] = await withPageDb((db) =>
    Promise.all([latestRehearsal(db, env.SNAPSHOT_WINDOW_MIN), latestQuota(db)]),
  );
  const s = t.schedule;
  return (
    <AdminShell title={t.title}>
      <h2 className="mb-1 font-subhead text-display-md font-semibold">{s.title}</h2>
      <dl className="mb-6">
        <Row label={s.timeZone} value={env.SERVER_TZ} />
        <Row label={s.nextEvent} value={describeInstant(next.eventAtUtc, env)} />
        <Row label={s.beforeDue} value={describeInstant(next.beforeAt, env)} />
        <Row label={s.afterDue} value={describeInstant(next.afterAt, env)} />
        <Row label={s.grace} value={fill(s.graceValue, { min: env.SNAPSHOT_WINDOW_MIN })} />
        <Row label={s.quotaCheck} value={env.QUOTA_CHECK_AT} />
        <Row
          label={s.rehearsals}
          value={
            env.REHEARSAL_AT === ""
              ? s.rehearsalsOff
              : fill(s.rehearsalsValue, { at: env.REHEARSAL_AT, keep: env.REHEARSAL_KEEP })
          }
        />
      </dl>
      <h2 className="mb-1 font-subhead text-display-md font-semibold">{t.quota.title}</h2>
      <p className="mb-6">
        {quota?.remaining != null
          ? `${fill(t.quota.left, { n: quota.remaining })} (${utcStamp(quota.at)})`
          : t.quota.none}
      </p>
      <h2 className="mb-2 font-subhead text-display-md font-semibold">{t.run.title}</h2>
      <p className={`mb-3 text-sm ${MUTED}`}>
        {fill(t.run.intro, { event: describeInstant(current.eventAtUtc, env) })}
      </p>
      <AdminActions beforeAtText={describeInstant(current.beforeAt, env)} />
      <h2 className="mb-2 mt-8 font-subhead text-display-md font-semibold">{t.rehearsal.title}</h2>
      <Rehearsal r={rehearsal} />
    </AdminShell>
  );
}
