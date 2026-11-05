// /admin/errors: app_errors grouped by digest, newest first.
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { utcStamp } from "@/app/_ui/format";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listErrorGroups } from "@/lib/queries/admin";

export default async function ErrorsPage() {
  const groups = await withPageDb((db) => listErrorGroups(db));
  const t = copy.admin.errors;
  return (
    <AdminShell title={t.title}>
      {groups.length === 0 && <p>{t.none}</p>}
      <ul>
        {groups.map((g) => (
          <li key={g.key} className="border-b border-rule py-2">
            <p className="break-words font-semibold">{g.message}</p>
            <p className="text-sm text-ink/70">
              {g.route} · {g.count}× · {fill(t.last, { at: utcStamp(g.lastAt) })}
              {g.count > 1 && ` · ${fill(t.first, { at: utcStamp(g.firstAt) })}`}
              {g.digest && ` · ${fill(t.digest, { digest: g.digest })}`}
            </p>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
