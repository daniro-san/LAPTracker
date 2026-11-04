// /admin (plan Phase 4): the effective schedule, the rehearsal, the run buttons.
import { AdminActions } from "@/app/_ui/admin/AdminActions";
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { latestRehearsal, type RehearsalStatus } from "@/lib/queries/admin";
import { currentEvent, describeInstant, nextEvent } from "@/lib/schedule";

const MUTED = "text-zinc-500 dark:text-zinc-400";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-zinc-200 py-2 sm:flex-row sm:gap-4 dark:border-zinc-800">
      <dt className={`shrink-0 text-sm sm:w-48 ${MUTED}`}>{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function Rehearsal({ r }: { r: RehearsalStatus | null }) {
  if (!r) return <p className={MUTED}>No rehearsal yet.</p>;
  return (
    <div>
      <p className="break-words font-medium">{r.name}</p>
      <ul className="mb-2 text-sm">
        {(["before", "after"] as const).map((phase) => {
          const p = r.phases.find((x) => x.phase === phase);
          return (
            <li key={phase}>
              {phase}: {p ? `${p.status}${p.error ? ` (${p.error})` : ""}` : "not run"} · due{" "}
              {utcStamp(phase === "before" ? r.beforeAt : r.afterAt)}
            </li>
          );
        })}
      </ul>
      {r.verdict && (
        <>
          <p className="font-semibold">{r.verdict.pass ? "✅ PASS" : "❌ FAIL"}</p>
          <ul className="text-sm">
            {r.verdict.lines.map((l) => (
              <li key={l.text}>
                {l.ok ? "✅" : "❌"} {l.text}
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
  const rehearsal = await withPageDb((db) => latestRehearsal(db, env.SNAPSHOT_WINDOW_MIN));
  return (
    <AdminShell title="Admin">
      <h2 className="mb-1 text-lg font-bold">Schedule</h2>
      <dl className="mb-6">
        <Row label="Server time zone" value={env.SERVER_TZ} />
        <Row label="Next event" value={describeInstant(next.eventAtUtc, env)} />
        <Row label="BEFORE due" value={describeInstant(next.beforeAt, env)} />
        <Row label="AFTER due" value={describeInstant(next.afterAt, env)} />
        <Row label="Window" value={`${env.SNAPSHOT_WINDOW_MIN} min after each due time`} />
        <Row label="Friday quota check" value={env.QUOTA_CHECK_AT} />
        <Row
          label="Rehearsals"
          value={
            env.REHEARSAL_AT === "" ? "off" : `${env.REHEARSAL_AT} (keep ${env.REHEARSAL_KEEP})`
          }
        />
      </dl>
      <h2 className="mb-2 text-lg font-bold">Run now</h2>
      <p className={`mb-3 text-sm ${MUTED}`}>
        Current event: {describeInstant(current.eventAtUtc, env)}
      </p>
      <AdminActions beforeAtText={describeInstant(current.beforeAt, env)} />
      <h2 className="mb-2 mt-8 text-lg font-bold">Last rehearsal</h2>
      <Rehearsal r={rehearsal} />
    </AdminShell>
  );
}
