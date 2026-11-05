// /admin/runs: every snapshot run, newest first, rehearsals included.
import Link from "next/link";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { phaseWord, stateWord } from "@/app/_ui/admin/words";
import { requestClock } from "@/app/_ui/locale";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listRuns } from "@/lib/queries/admin";

export default async function RunsPage() {
  const [runs, clock] = await Promise.all([withPageDb((db) => listRuns(db)), requestClock()]);
  const t = copy.admin.runs;
  return (
    <AdminShell title={t.title}>
      {runs.length === 0 && <p>{t.none}</p>}
      <ul>
        {runs.map((r) => (
          <li key={r.id} className="border-b border-rule">
            <Link href={`/admin/runs/${r.id}`} className="block min-h-11 py-2">
              <span className="font-semibold">
                {phaseWord(r.phase)} · {stateWord(r.status)}
              </span>{" "}
              <span className="text-sm text-ink/70">
                {clock.stamp(r.startedAt)} · {fill(t.calls, { n: r.callsUsed })}
                {r.quotaRemainingAfter !== null &&
                  ` · ${fill(t.quotaLeft, { n: r.quotaRemainingAfter })}`}
                {r.durationMs !== null &&
                  ` · ${fill(t.seconds, { n: (r.durationMs / 1000).toFixed(1) })}`}
              </span>
              <span className="block break-words text-sm">
                {r.isTest && `${t.rehearsal} `}
                {clock.stamp(r.eventAtUtc)}
              </span>
              {r.error && <span className="block break-words text-sm text-seal">{r.error}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
