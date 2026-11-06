// The run page's upstream calls (DESIGN.md `run-trace`, issue #94; framed as an `admin-section`, #91): one line per `v1.fetch` in the order
// the calls finished, then a total. Cards below 640 px, a table above, like `stat-table`. The slowest
// call carries a word, not only a colour. Read-only: nothing here is a control.
import type { ReactNode } from "react";

import { LABEL } from "@/app/_ui/StatTable";
import { Chip } from "@/lib/brand/components/Chip";
import { copy, fill } from "@/lib/copy";
import type { RunTrace as Trace, TraceCall } from "@/lib/queries/admin";

import { AdminSection } from "./parts";

const t = copy.admin.runs.trace;
const DASH = "—";

const secs = (n: number | null) => (n === null ? DASH : n.toFixed(1));
const yesNo = (b: boolean | null) => (b === null ? DASH : b ? t.yes : t.no);
const count = (n: number | null) => (n === null ? DASH : String(n));
const callName = (c: TraceCall) => c.alliance ?? t.quota;

function Http({ status }: { status: number | null }) {
  if (status === null) return <>{DASH}</>;
  return <span className={status === 200 ? "" : "font-semibold text-seal"}>{status}</span>;
}

const Slowest = () => <Chip tone="ink">{t.slowest}</Chip>;

function Card({ c }: { c: TraceCall }) {
  const values: [string, ReactNode][] = [
    [t.heads.seconds, secs(c.seconds)],
    [t.heads.http, <Http key="h" status={c.httpStatus} />],
    [t.heads.cached, yesNo(c.cached)],
    [t.heads.retries, count(c.retries)],
  ];
  return (
    <li className="mb-2 border border-rule p-3">
      <p className="flex min-h-8 flex-wrap items-center gap-2 border-b border-rule pb-2 font-semibold">
        <span className="break-words">{callName(c)}</span>
        {c.slowest && <Slowest />}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {values.map(([label, value], i) => (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <dt className={LABEL}>{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function TraceCards({ calls, total, totalName }: Trace & { totalName: string }) {
  return (
    <ul className="sm:hidden">
      {calls.map((c) => (
        <Card key={c.id} c={c} />
      ))}
      <li className="border border-rule p-3">
        <p className="border-b border-rule pb-2 font-semibold">{totalName}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3">
          <div className="flex items-baseline justify-between gap-2">
            <dt className={LABEL}>{t.heads.seconds}</dt>
            <dd className="tabular-nums">{secs(total.seconds)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className={LABEL}>{t.heads.retries}</dt>
            <dd className="tabular-nums">{total.retries}</dd>
          </div>
        </dl>
      </li>
    </ul>
  );
}

function TraceTable({ calls, total, totalName }: Trace & { totalName: string }) {
  return (
    <table className="hidden w-full sm:table">
      <thead>
        <tr className={`border-b border-rule ${LABEL}`}>
          <th scope="col" className="py-2 pr-3 text-left">
            {t.heads.call}
          </th>
          {[t.heads.seconds, t.heads.http, t.heads.cached, t.heads.retries].map((h, i) => (
            <th key={i} scope="col" className="py-2 pl-3 text-right">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {calls.map((c) => (
          <tr key={c.id} className="h-11 border-b border-rule">
            <th scope="row" className="pr-3 text-left font-semibold">
              <span className="inline-flex flex-wrap items-center gap-2">
                {callName(c)}
                {c.slowest && <Slowest />}
              </span>
            </th>
            <td className="pl-3 text-right tabular-nums">{secs(c.seconds)}</td>
            <td className="pl-3 text-right tabular-nums">
              <Http status={c.httpStatus} />
            </td>
            <td className="pl-3 text-right">{yesNo(c.cached)}</td>
            <td className="pl-3 text-right tabular-nums">{count(c.retries)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="h-11 font-semibold">
          <th scope="row" className="pr-3 text-left">
            {totalName}
          </th>
          <td className="pl-3 text-right tabular-nums">{secs(total.seconds)}</td>
          <td />
          <td />
          <td className="pl-3 text-right tabular-nums">{total.retries}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function RunTrace({ trace, deadline }: { trace: Trace; deadline: boolean }) {
  const totalName = fill(t.total, { n: trace.total.calls });
  return (
    <AdminSection id="run-trace" title={t.title} {...(trace.calls.length > 0 && { help: t.help })}>
      {trace.calls.length === 0 ? (
        <p className="text-body-sm text-ink/70">{t.none}</p>
      ) : (
        <>
          <TraceCards {...trace} totalName={totalName} />
          <TraceTable {...trace} totalName={totalName} />
          <p className="mt-2 text-body-sm text-ink/70">{t.overlap}</p>
        </>
      )}
      {deadline && <p className="mt-1 text-body-sm text-seal">{t.cut}</p>}
    </AdminSection>
  );
}
