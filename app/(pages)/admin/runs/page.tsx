// /admin/runs: every snapshot run, newest first, rehearsals included.
import Link from "next/link";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { withPageDb } from "@/lib/page";
import { listRuns } from "@/lib/queries/admin";

export default async function RunsPage() {
  const runs = await withPageDb((db) => listRuns(db));
  return (
    <AdminShell title="Runs">
      {runs.length === 0 && <p>No runs yet.</p>}
      <ul>
        {runs.map((r) => (
          <li key={r.id} className="border-b border-zinc-200 dark:border-zinc-800">
            <Link href={`/admin/runs/${r.id}`} className="block min-h-11 py-2">
              <span className="font-semibold">
                {r.phase} · {r.status}
              </span>{" "}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {utcStamp(r.startedAt)} · {r.callsUsed} calls
                {r.durationMs !== null && ` · ${(r.durationMs / 1000).toFixed(1)} s`}
              </span>
              <span className="block break-words text-sm">
                {r.isTest && "[rehearsal] "}
                {r.eventName}
              </span>
              {r.error && (
                <span className="block break-words text-sm text-red-800 dark:text-red-300">
                  {r.error}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
