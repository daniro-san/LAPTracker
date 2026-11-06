// /admin/runs: every snapshot run, newest first, rehearsals included.
import Link from "next/link";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { phaseWord, seconds, stateWord } from "@/app/_ui/admin/words";
import { requestServerClock } from "@/app/_ui/locale";
import { Chip } from "@/lib/brand/components/Chip";
import { DroppedStitch } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listRuns } from "@/lib/queries/admin";

export default async function RunsPage() {
  const [runs, clock] = await Promise.all([withPageDb((db) => listRuns(db)), requestServerClock()]);
  const t = copy.admin.runs;
  return (
    <AdminShell title={t.title}>
      {runs.length === 0 ? <p>{t.none}</p> : <p className="mb-2 text-sm text-ink/70">{t.help}</p>}
      <ul>
        {runs.map((r) => (
          <li key={r.id} className="border-b border-rule">
            <Link href={`/admin/runs/${r.id}`} className="block min-h-11 py-2">
              <span className="block break-words font-semibold">
                {phaseWord(r.phase)} · {stateWord(r.status)}
              </span>
              <span className="block break-words text-sm">
                {r.isTest && `${t.rehearsal} `}
                {r.manual ? r.eventName : clock.stamp(r.eventAtUtc)}
              </span>
              <span className="block text-sm text-ink/70">
                {[
                  fill(t.started, { at: clock.stamp(r.startedAt) }),
                  r.finishedAt && fill(t.finished, { at: clock.stamp(r.finishedAt) }),
                  r.durationMs !== null && fill(t.seconds, { n: seconds(r.durationMs) }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="block text-sm text-ink/70">
                {[
                  fill(t.calls, { n: r.callsUsed }),
                  r.quotaRemainingAfter !== null && fill(t.quotaLeft, { n: r.quotaRemainingAfter }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {r.deadline && (
                <span className="mt-1 block">
                  <Chip tone="seal" icon={<DroppedStitch />}>
                    {t.deadline}
                  </Chip>
                </span>
              )}
              {r.error && !r.deadline && (
                <span className="block break-words text-sm text-seal">{r.error}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
