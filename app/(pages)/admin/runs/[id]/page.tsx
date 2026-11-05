// /admin/runs/[id]: the run_logs timeline of one snapshot.
import { notFound } from "next/navigation";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
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
  const found = await withPageDb((db) => getRun(db, Number(raw)));
  if (!found) notFound();
  const { run, logs, tags } = found;
  const t = copy.admin.runs;
  return (
    <AdminShell title={fill(t.run, { id: run.id })}>
      <p className="break-words">
        {run.isTest && `${t.rehearsal} `}
        {run.eventName} · {run.phase} · {run.status}
      </p>
      <p className="mb-1 text-sm text-ink/70">
        {utcStamp(run.startedAt)} · {fill(t.calls, { n: run.callsUsed })}
        {run.durationMs !== null &&
          ` · ${fill(t.seconds, { n: (run.durationMs / 1000).toFixed(1) })}`}
      </p>
      {run.error && <p className="mb-3 break-words text-seal">{run.error}</p>}
      <ol className="mt-3">
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
