// /admin/runs/[id]: one snapshot run: its upstream calls (the trace), then its run_logs timeline.
import { notFound } from "next/navigation";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { RunTrace } from "@/app/_ui/admin/RunTrace";
import { phaseWord, seconds, stateWord } from "@/app/_ui/admin/words";
import { requestServerClock } from "@/app/_ui/locale";
import { Chip } from "@/lib/brand/components/Chip";
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
      <p className="break-words">
        {run.isTest && `${t.rehearsal} `}
        {clock.stamp(run.eventAtUtc)} · {phaseWord(run.phase)} · {stateWord(run.status)}
      </p>
      <p className="mb-1 text-sm text-ink/70">
        {fill(t.started, { at: clock.stamp(run.startedAt) })}
        {run.finishedAt && ` · ${fill(t.finished, { at: clock.stamp(run.finishedAt) })}`}
        {run.durationMs !== null && ` · ${fill(t.seconds, { n: seconds(run.durationMs) })}`}
        {" · "}
        {fill(t.calls, { n: run.callsUsed })}
      </p>
      {run.deadline && (
        <Chip tone="seal" icon={<DroppedStitch />}>
          {t.deadline}
        </Chip>
      )}
      {run.error && !run.deadline && <p className="mb-3 break-words text-seal">{run.error}</p>}
      <RunTrace trace={trace} deadline={run.deadline} />
      <h2 className="mb-1 mt-6 font-subhead text-display-md font-semibold">{t.trace.log}</h2>
      <ol>
        {logs.map((l) => (
          <li key={l.id} className="border-b border-rule py-2 text-sm">
            <span className="tabular-nums text-ink/70">{time(l.at)}</span>{" "}
            <span className={`font-semibold uppercase ${LEVEL[l.level]}`}>{l.level}</span>{" "}
            <span className="font-mono">{l.code}</span>
            {l.unionId !== null && <span> · {tags.get(l.unionId) ?? l.unionId}</span>}
            <span className="block break-words font-mono text-xs">{fields(l.data)}</span>
          </li>
        ))}
        {logs.length === 0 && <li>{t.noLogs}</li>}
      </ol>
    </AdminShell>
  );
}
