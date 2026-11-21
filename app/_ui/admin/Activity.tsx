// /admin's Activity section (D145, issue 484): each workspace's last 7 days from PostHog, and its setup steps
// from our own tables (D145, amended 2026-11-21). An async server component the page streams inside Suspense,
// so PostHog never holds up /admin. No key, PostHog down or no workspace answered: nothing at all, not even
// the frame. English only (D48).
import { LABEL } from "@/app/_ui/StatTable";
import { getAppContext } from "@/lib/app-context";
import { copy, fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import {
  ACTIVITY_TOTALS,
  allianceActivity,
  PEOPLE_TOTALS,
  type ActivityTotal,
  type AllianceActivity,
} from "@/lib/queries/admin-activity";
import { SETUP_STEPS, type AllianceUsage, type StepTime } from "@/lib/queries/admin-alliances";

import { AdminSection } from "./parts";

const t = copy.admin.workspaces.alliances.activity;
const DAY_MS = 86_400_000;

/** People: "at least n" or "under 5". Actions: the count as it is. */
const total = (k: ActivityTotal, n: number | null) =>
  n === null
    ? t.under
    : PEOPLE_TOTALS.includes(k)
      ? fill(t.atLeast, { n: n.toLocaleString("en") })
      : n.toLocaleString("en");

/** The step's UTC date, with "day 2" counted from Created; "done" when no table keeps when; "not yet". */
function stepText(at: StepTime, created: StepTime): string {
  if (at === null) return t.notYet;
  if (at === "done") return t.done;
  const date = at.toISOString().slice(0, 10);
  if (!(created instanceof Date)) return date;
  const n = Math.max(0, Math.floor((at.getTime() - created.getTime()) / DAY_MS));
  return `${date} · ${fill(t.day, { n })}`;
}

function Card({
  row,
  alliance,
  setup,
}: {
  row: AllianceActivity;
  alliance: string;
  setup: AllianceUsage["setup"];
}) {
  return (
    <li className="min-w-0 border border-rule p-3">
      {/* The alliance opens its workspace below, as the Alliances table's rows do (D144). */}
      <a
        href={`#w-${row.slug}`}
        className="inline-flex min-h-11 flex-col justify-center break-words underline-offset-2 hover:underline"
      >
        <bdi className="block font-semibold text-plum">{alliance}</bdi>
        <span className="block text-body-sm text-ink/70">/w/{row.slug}</span>
      </a>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {ACTIVITY_TOTALS.map((k) => (
          <div key={k} className="min-w-0">
            <dt className={LABEL}>{t.totals[k]}</dt>
            <dd
              className={`text-body-sm tabular-nums ${row.totals[k] === null ? "text-ink/70" : ""}`}
            >
              {total(k, row.totals[k])}
            </dd>
          </div>
        ))}
      </dl>
      <h3 className={`${LABEL} mt-3`}>{t.setup}</h3>
      <ol className="mt-1 grid gap-1 text-body-sm">
        {SETUP_STEPS.map((k) => (
          <li key={k} className="flex flex-wrap justify-between gap-x-3 border-t border-rule pt-1">
            <span>{t.steps[k]}</span>
            <span className={`tabular-nums ${setup[k] ? "" : "text-ink/70"}`}>
              {stepText(setup[k], setup.created)}
            </span>
          </li>
        ))}
      </ol>
    </li>
  );
}

export async function Activity({
  workspaces,
}: {
  workspaces: { slug: string; alliance: string; setup: AllianceUsage["setup"] }[];
}) {
  const rows = await allianceActivity(
    getEnv(),
    getAppContext().fetch,
    workspaces.map((w) => w.slug),
  );
  if (rows.length === 0) return null;
  const bySlug = new Map(workspaces.map((w) => [w.slug, w]));
  return (
    <AdminSection id="activity" title={t.title} help={t.help}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => {
          const w = bySlug.get(r.slug);
          return w && <Card key={r.slug} row={r} alliance={w.alliance} setup={w.setup} />;
        })}
      </ul>
    </AdminSection>
  );
}
