// /admin/errors: app_errors grouped by digest, newest first.
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { withPageDb } from "@/lib/page";
import { listErrorGroups } from "@/lib/queries/admin";

export default async function ErrorsPage() {
  const groups = await withPageDb((db) => listErrorGroups(db));
  return (
    <AdminShell title="App errors">
      {groups.length === 0 && <p>No errors recorded. Nothing has broken outside a snapshot run.</p>}
      <ul>
        {groups.map((g) => (
          <li key={g.key} className="border-b border-zinc-200 py-2 dark:border-zinc-800">
            <p className="break-words font-semibold">{g.message}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {g.route} · {g.count}× · last {utcStamp(g.lastAt)}
              {g.count > 1 && ` · first ${utcStamp(g.firstAt)}`}
              {g.digest && ` · digest ${g.digest}`}
            </p>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
