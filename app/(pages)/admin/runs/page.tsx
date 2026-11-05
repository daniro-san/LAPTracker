// /admin/runs: every snapshot run, newest first, rehearsals included.
import Link from "next/link";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listRuns } from "@/lib/queries/admin";

export default async function RunsPage() {
  const runs = await withPageDb((db) => listRuns(db));
  const t = copy.admin.runs;
  return (
    <AdminShell title={t.title}>
      {runs.length === 0 && <p>{t.none}</p>}
      <ul>
        {runs.map((r) => (
          <li key={r.id} className="border-b border-rule">
            <Link href={`/admin/runs/${r.id}`} className="block min-h-11 py-2">
              <span className="font-semibold">
                {r.phase === "before" ? t.before : t.after} · {r.status}
              </span>{" "}
              <span className="text-sm text-ink/70">
                {utcStamp(r.startedAt)} · {fill(t.calls, { n: r.callsUsed })}
                {r.quotaRemainingAfter !== null &&
                  ` · ${fill(t.quotaLeft, { n: r.quotaRemainingAfter })}`}
                {r.durationMs !== null &&
                  ` · ${fill(t.seconds, { n: (r.durationMs / 1000).toFixed(1) })}`}
              </span>
              <span className="block break-words text-sm">
                {r.isTest && `${t.rehearsal} `}
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
