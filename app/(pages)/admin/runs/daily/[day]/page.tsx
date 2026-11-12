// /admin/runs/daily/[day]: one daily roster read (D60), laid out like a snapshot run's page: the summary,
// the alliances that failed by reason (D61), its upstream calls (the trace) and its run_logs timeline.
import { notFound } from "next/navigation";

import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { AdminSection, StateChip } from "@/app/_ui/admin/parts";
import { RunLog } from "@/app/_ui/admin/RunLog";
import { DailyFailures } from "@/app/_ui/admin/RunRows";
import { RunTrace } from "@/app/_ui/admin/RunTrace";
import { readDayDate, seconds, stateWord } from "@/app/_ui/admin/words";
import { requestServerClock } from "@/app/_ui/locale";
import { isAdmin } from "@/lib/admin-session";
import { Chip } from "@/lib/brand/components/Chip";
import { FactList } from "@/lib/brand/components/FactList";
import { DroppedStitch } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { getDailyRun } from "@/lib/queries/daily-runs";

export default async function DailyRunPage({ params }: { params: Promise<{ day: string }> }) {
  const t = copy.admin.runs;
  // Session first (issue 218): locked, the PIN card whatever the day, and no database read.
  if (!(await isAdmin())) return <AdminShell title={t.title} />;
  const { day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  const [found, clock] = await Promise.all([
    withPageDb((db) => getDailyRun(db, day)),
    requestServerClock(),
  ]);
  if (!found) notFound();
  const { run, logs, tags, trace } = found;
  const title = fill(t.dailyRun, { read: t.daily, day: clock.weekday(readDayDate(run.day)) });
  return (
    <AdminShell title={title}>
      <AdminSection
        id="run-summary"
        title={title}
        aside={<StateChip status={run.status}>{stateWord(run.status)}</StateChip>}
      >
        <FactList
          items={[
            { label: t.startedLabel, value: clock.stamp(run.startedAt) },
            ...(run.finishedAt
              ? [{ label: t.finishedLabel, value: clock.stamp(run.finishedAt) }]
              : []),
            ...(run.durationMs !== null
              ? [{ label: t.duration, value: fill(t.seconds, { n: seconds(run.durationMs) }) }]
              : []),
            { label: t.callsLabel, value: String(run.callsUsed) },
            ...(run.quotaRemainingBefore !== null
              ? [{ label: t.quotaBeforeLabel, value: String(run.quotaRemainingBefore) }]
              : []),
          ]}
        />
        {run.deadline && (
          <p className="mt-3">
            <Chip tone="seal" icon={<DroppedStitch />}>
              {t.deadline}
            </Chip>
          </p>
        )}
      </AdminSection>
      {(run.error || run.problems.some((p) => p.error)) && (
        <AdminSection id="run-problems" title={t.problems.title}>
          <DailyFailures r={run} />
        </AdminSection>
      )}
      <RunTrace trace={trace} deadline={run.deadline} />
      <RunLog logs={logs} tags={tags} />
    </AdminShell>
  );
}
