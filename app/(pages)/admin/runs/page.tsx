// /admin/runs: every snapshot run, newest first, rehearsals included.
import Link from "next/link";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { withPageDb } from "@/lib/page";
import { listRuns } from "@/lib/queries/admin";

export default async function RunsPage() {
  const runs = await withPageDb((db) => listRuns(db));
  return (
    <AdminShell title="Snapshot runs">
      {runs.length === 0 && <p>No snapshot runs yet.</p>}
      <ul>
        {runs.map((r) => (
          <li key={r.id} className="border-b border-rule">
            <Link href={`/admin/runs/${r.id}`} className="block min-h-11 py-2">
              <span className="font-semibold">
                {r.phase === "before" ? "Before" : "After"} snapshot · {r.status}
              </span>{" "}
              <span className="text-sm text-ink/70">
                {utcStamp(r.startedAt)} · {r.callsUsed} calls
                {r.durationMs !== null && ` · ${(r.durationMs / 1000).toFixed(1)} s`}
              </span>
              <span className="block break-words text-sm">
                {r.isTest && "[rehearsal] "}
                {r.eventName}
              </span>
              {r.error && <span className="block break-words text-sm text-seal">{r.error}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
