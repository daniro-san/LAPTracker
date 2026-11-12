// /admin/runs: every snapshot run and every daily roster read (D60), newest first, rehearsals included
// (#91: framed cards below 640 px, ruled rows above; each run titled by its event's name, its state as a
// chip). `?show=events` keeps the snapshot runs, `?show=daily` the daily reads; none shows both.
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import {
  DailyRunRow,
  RUN_FILTERS,
  RunsFilter,
  SnapshotRunRow,
  type DailyRun,
  type SnapshotRun,
} from "@/app/_ui/admin/RunRows";
import { requestServerClock } from "@/app/_ui/locale";
import { isAdmin } from "@/lib/admin-session";
import { copy } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listRuns } from "@/lib/queries/admin";
import { listDailyReads } from "@/lib/queries/daily-runs";

const LIMIT = 60;

type Entry = { kind: "snapshot"; run: SnapshotRun } | { kind: "daily"; run: DailyRun };

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = copy.admin.runs;
  // Session first (issue 218): locked, the PIN card and no database read.
  if (!(await isAdmin())) return <AdminShell title={t.title} />;
  const sp = await searchParams;
  const show = RUN_FILTERS.find((f) => f === sp.show) ?? null;
  const [[runs, daily], clock] = await Promise.all([
    withPageDb((db) =>
      Promise.all([
        show === "daily" ? [] : listRuns(db, LIMIT),
        show === "events" ? [] : listDailyReads(db, LIMIT),
      ]),
    ),
    requestServerClock(),
  ]);
  const entries: Entry[] = [
    ...runs.map((run) => ({ kind: "snapshot" as const, run })),
    ...daily.map((run) => ({ kind: "daily" as const, run })),
  ]
    .sort((a, b) => b.run.startedAt.getTime() - a.run.startedAt.getTime())
    .slice(0, LIMIT);
  return (
    <AdminShell title={t.title}>
      <RunsFilter show={show} />
      {entries.length === 0 ? (
        <p>{show ? t.noneShown : t.none}</p>
      ) : (
        <p className="mb-3 text-body-sm text-ink/70">{t.help}</p>
      )}
      <ul className="flex flex-col gap-3 sm:gap-0 sm:border sm:border-rule sm:px-6">
        {entries.map((e) => (
          <li
            key={e.kind === "snapshot" ? `s${e.run.id}` : `d${e.run.day}`}
            className="border border-rule sm:border-0 sm:border-b sm:last:border-0"
          >
            {e.kind === "snapshot" ? (
              <SnapshotRunRow r={e.run} clock={clock} />
            ) : (
              <DailyRunRow r={e.run} clock={clock} />
            )}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
