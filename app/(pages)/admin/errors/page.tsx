// /admin/errors: app_errors grouped by digest, newest first (#91: framed like the runs list, the count
// as a seal chip), each with the workspace addresses it happened under; `?w=<slug>` keeps that workspace's
// only (F34), the Alliances row's "Page errors" link.
import { AdminShell } from "@/app/_ui/admin/AdminShell";
import { AppErrorDetails, GuideNote } from "@/app/_ui/admin/ErrorDetail";
import { requestServerClock } from "@/app/_ui/locale";
import { isAdmin } from "@/lib/admin-session";
import { Chip } from "@/lib/brand/components/Chip";
import { DroppedStitch } from "@/lib/brand/components/StatusIcons";
import { TextLink } from "@/lib/brand/components/TextLink";
import { copy } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { errorsSlug, listErrorGroups } from "@/lib/queries/admin-errors";
import { fill } from "@/lib/words";

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = copy.admin.errors;
  // Session first (issue 218): locked, the PIN card and no database read.
  if (!(await isAdmin())) return <AdminShell section="/admin/errors" title={t.title} />;
  // Only an address a workspace could have: anything else lists every error.
  const slug = errorsSlug((await searchParams).w);
  const [groups, clock] = await Promise.all([
    withPageDb((db) => listErrorGroups(db, slug)),
    requestServerClock(),
  ]);
  return (
    <AdminShell section="/admin/errors" title={t.title}>
      {slug && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3">
          {fill(t.only, { slug })}
          <TextLink
            href="/admin/errors"
            prefetch={false}
            className="inline-flex min-h-11 items-center"
          >
            {t.all}
          </TextLink>
        </p>
      )}
      {groups.length === 0 && <p>{slug ? fill(t.noneFor, { slug }) : t.none}</p>}
      <ul className="flex flex-col gap-3 sm:gap-0 sm:border sm:border-rule sm:px-6">
        {groups.map((g) => (
          <li
            key={g.key}
            className="flex flex-col gap-1 border border-rule p-3 sm:border-0 sm:border-b sm:px-0 sm:last:border-0"
          >
            <p className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-words font-semibold">{g.message}</span>
              <Chip tone="seal" icon={<DroppedStitch />}>
                {fill(t.count, { n: g.count })}
              </Chip>
            </p>
            <p className="break-words text-body-sm text-ink/70">
              {[
                ...g.workspaces.map((w) => `/w/${w}`),
                g.route,
                fill(t.last, { at: clock.stamp(g.lastAt) }),
                g.count > 1 && fill(t.first, { at: clock.stamp(g.firstAt) }),
                g.digest && fill(t.digest, { digest: g.digest }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <GuideNote error={g.message} />
            {g.detail && <AppErrorDetails detail={g.detail} />}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
