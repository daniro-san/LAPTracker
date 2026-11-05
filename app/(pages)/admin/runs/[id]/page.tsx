// /admin/runs/[id]: the run_logs timeline of one snapshot.
import { notFound } from "next/navigation";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { withPageDb } from "@/lib/page";
import { getRun } from "@/lib/queries/admin";

const LEVEL = {
  info: "text-zinc-600 dark:text-zinc-400",
  warn: "text-amber-800 dark:text-amber-300",
  error: "text-red-800 dark:text-red-300",
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
  return (
    <AdminShell title={`Run ${run.id}`}>
      <p className="break-words">
        {run.isTest && "[rehearsal] "}
        {run.eventName} · {run.phase} · {run.status}
      </p>
      <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
        {utcStamp(run.startedAt)} · {run.callsUsed} calls
        {run.durationMs !== null && ` · ${(run.durationMs / 1000).toFixed(1)} s`}
      </p>
      {run.error && <p className="mb-3 break-words text-red-800 dark:text-red-300">{run.error}</p>}
      <ol className="mt-3">
        {logs.map((l) => (
          <li key={l.id} className="border-b border-zinc-200 py-2 text-sm dark:border-zinc-800">
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{time(l.at)}</span>{" "}
            <span className={`font-semibold uppercase ${LEVEL[l.level]}`}>{l.level}</span>{" "}
            <span className="font-mono">{l.code}</span>
            {l.unionId !== null && <span> · {tags.get(l.unionId) ?? l.unionId}</span>}
            <span className="block break-words font-mono text-xs">{fields(l.data)}</span>
          </li>
        ))}
        {logs.length === 0 && <li>No log lines.</li>}
      </ol>
    </AdminShell>
  );
}
