// /admin/runs: every snapshot run, newest first, rehearsals included (#91: framed cards below 640 px,
// ruled rows above; each run titled by its event's name, its state as a chip).
import Link from "next/link";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { StateChip } from "@/app/_ui/admin/parts";
import { eventWord, phaseWord, seconds, stateWord } from "@/app/_ui/admin/words";
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
      {runs.length === 0 ? (
        <p>{t.none}</p>
      ) : (
        <p className="mb-3 text-body-sm text-ink/70">{t.help}</p>
      )}
      <ul className="flex flex-col gap-3 sm:gap-0 sm:border sm:border-rule sm:px-6">
        {runs.map((r) => (
          <li key={r.id} className="border border-rule sm:border-0 sm:border-b sm:last:border-0">
            <Link
              href={`/admin/runs/${r.id}`}
              className="flex min-h-11 flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-0"
            >
              <span className="flex min-w-0 flex-col sm:w-72">
                <span className="break-words font-semibold text-plum">
                  {eventWord(r, clock)} · {phaseWord(r.phase)}
                </span>
                <span className="text-body-sm">{clock.stamp(r.eventAtUtc)}</span>
              </span>
              <span className="text-body-sm tabular-nums text-ink/70 sm:flex-1">
                <span className="block">
                  {[
                    fill(t.started, { at: clock.stamp(r.startedAt) }),
                    r.finishedAt && fill(t.finished, { at: clock.hhmm(r.finishedAt) }),
                    r.durationMs !== null && fill(t.seconds, { n: seconds(r.durationMs) }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="block">
                  {[
                    fill(t.calls, { n: r.callsUsed }),
                    r.quotaRemainingAfter !== null &&
                      fill(t.quotaLeft, { n: r.quotaRemainingAfter }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {r.error && !r.deadline && (
                  <span className="block break-words text-seal">{r.error}</span>
                )}
              </span>
              <span className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                <StateChip status={r.status}>{stateWord(r.status)}</StateChip>
                {r.deadline && (
                  <Chip tone="seal" icon={<DroppedStitch />}>
                    {t.deadline}
                  </Chip>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
