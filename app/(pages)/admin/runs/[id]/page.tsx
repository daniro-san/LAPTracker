// /admin/runs/[id]: one snapshot run: its upstream calls (the trace), then its run_logs timeline.
import { notFound } from "next/navigation";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { AdminSection, StateChip } from "@/app/_ui/admin/parts";
import { RunTrace } from "@/app/_ui/admin/RunTrace";
import { eventWord, phaseWord, seconds, stateWord } from "@/app/_ui/admin/words";
import { requestServerClock } from "@/app/_ui/locale";
import { Chip } from "@/lib/brand/components/Chip";
import { FactList } from "@/lib/brand/components/FactList";
import { DroppedStitch } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { getRun } from "@/lib/queries/admin";

const LEVEL = {
  info: "text-ink/70",
  warn: "text-plum",
  error: "text-seal",
} as const;

/** The data fields that matter, as `key=value`; objects are skipped (the log carries counts and codes). */
function fields(data: unknown): string {
  if (data === null || typeof data !== "object") return "";
  return Object.entries(data)
    .filter(([, v]) => v !== null && typeof v !== "object")
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
}

const time = (d: Date) => d.toISOString().slice(11, 23);

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  if (!/^\d{1,9}$/.test(raw)) notFound();
  const [found, clock] = await Promise.all([
    withPageDb((db) => getRun(db, Number(raw))),
    requestServerClock(),
  ]);
  if (!found) notFound();
  const { run, logs, tags, trace } = found;
  const t = copy.admin.runs;
  return (
    <AdminShell title={fill(t.run, { id: run.id })}>
      <AdminSection
        id="run-summary"
        title={`${eventWord(run, clock)} · ${phaseWord(run.phase)}`}
        aside={<StateChip status={run.status}>{stateWord(run.status)}</StateChip>}
      >
        <FactList
          items={[
            { label: t.event, value: clock.stamp(run.eventAtUtc) },
            { label: t.startedLabel, value: clock.stamp(run.startedAt) },
            ...(run.finishedAt
              ? [{ label: t.finishedLabel, value: clock.stamp(run.finishedAt) }]
              : []),
            ...(run.durationMs !== null
              ? [{ label: t.duration, value: fill(t.seconds, { n: seconds(run.durationMs) }) }]
              : []),
            { label: t.callsLabel, value: String(run.callsUsed) },
          ]}
        />
        {run.deadline && (
          <p className="mt-3">
            <Chip tone="seal" icon={<DroppedStitch />}>
              {t.deadline}
            </Chip>
          </p>
        )}
        {run.error && !run.deadline && <p className="mt-3 break-words text-seal">{run.error}</p>}
      </AdminSection>
      <RunTrace trace={trace} deadline={run.deadline} />
      <AdminSection id="run-log" title={t.trace.log}>
        <ol>
          {logs.map((l) => (
            <li key={l.id} className="border-b border-rule py-2 text-body-sm last:border-0">
              <span className="tabular-nums text-ink/70">{time(l.at)}</span>{" "}
              <span className={`font-semibold uppercase ${LEVEL[l.level]}`}>{l.level}</span>{" "}
              <span className="font-mono">{l.code}</span>
              {l.unionId !== null && <span> · {tags.get(l.unionId) ?? l.unionId}</span>}
              <span className="block break-words font-mono text-xs">{fields(l.data)}</span>
            </li>
          ))}
          {logs.length === 0 && <li>{t.noLogs}</li>}
        </ol>
      </AdminSection>
    </AdminShell>
  );
}
