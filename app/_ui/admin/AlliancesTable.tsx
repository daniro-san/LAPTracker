// /admin's Alliances table (issue 485, D144): one card per workspace below 640, a table from 640 whose
// columns appear by width (ResponsiveTable, D122). Each row opens its workspace's own section below
// (`#w-<slug>` in the Workspaces card). Rows are built in alliances-view.ts. English only (D48).
import type { ReactNode } from "react";

import { LABEL } from "@/app/_ui/StatTable";
import { Chip } from "@/lib/brand/components/Chip";
import { type Column, ResponsiveTable } from "@/lib/brand/components/layout/ResponsiveTable";
import { DroppedStitch } from "@/lib/brand/components/StatusIcons";
import { copy } from "@/lib/copy";
import { ALLOWANCES } from "@/lib/workspace-features";

import type { AllianceRow } from "./alliances-view";
import { AdminSection } from "./parts";

const t = copy.admin.workspaces.alliances;
const NOTE = "block text-body-sm text-ink/70";

const Attention = ({ row }: { row: AllianceRow }) =>
  row.attention.length > 0 && (
    <Chip tone="seal" icon={<DroppedStitch />}>
      {t.attention}
    </Chip>
  );

const href = (row: AllianceRow) => `#w-${row.slug}`;

const NameText = ({ row }: { row: AllianceRow }) => (
  <>
    <span className="block font-semibold text-plum">/w/{row.slug}</span>
    <bdi className="block text-ink/80">{row.alliance}</bdi>
  </>
);

/** The alliance, as the link that opens its workspace on this page. */
const Name = ({ row }: { row: AllianceRow }) => (
  <a
    href={href(row)}
    className="inline-flex min-h-11 flex-col justify-center underline-offset-2 hover:underline"
  >
    <NameText row={row} />
  </a>
);

const Calls = ({ row }: { row: AllianceRow }) => (
  <>
    <span className="block">{row.calls.today}</span>
    <span className={NOTE}>
      {row.calls.week} · {row.calls.planned}
    </span>
  </>
);

const Key = ({ row }: { row: AllianceRow }) => (
  <>
    <span className={`block font-medium ${row.key.state === "ok" ? "" : "text-seal"}`}>
      {row.key.text}
    </span>
    {row.key.note && <span className={NOTE}>{row.key.note}</span>}
  </>
);

const Limits = ({ row }: { row: AllianceRow }) => (
  <>
    {ALLOWANCES.map((a) => (
      <span key={a} className={`block ${row.allowances[a].usedUp ? "text-seal" : ""}`}>
        {t.allowance[a]}: {row.allowances[a].text}
        {row.allowances[a].usedUp && ` · ${t.usedUp}`}
      </span>
    ))}
  </>
);

const Errors = ({ row }: { row: AllianceRow }) => (
  <span className={row.errors > 0 ? "font-semibold text-seal" : ""}>{row.errors}</span>
);

const COLUMNS: Column<AllianceRow>[] = [
  {
    key: "alliance",
    head: t.head.alliance,
    cell: (r) => (
      <>
        <Name row={r} />
        <Attention row={r} />
      </>
    ),
  },
  { key: "calls", head: t.head.calls, cell: (r) => <Calls row={r} /> },
  { key: "key", head: t.head.key, cell: (r) => <Key row={r} /> },
  { key: "limits", head: t.head.limits, cell: (r) => <Limits row={r} /> },
  { key: "errors", head: t.head.errors, cell: (r) => <Errors row={r} />, numeric: true },
  { key: "posts", head: t.head.posts, cell: (r) => r.posts, priority: "lg", numeric: true },
  { key: "seen", head: t.head.seen, cell: (r) => r.seen, priority: "lg" },
  { key: "changed", head: t.head.changed, cell: (r) => r.changed, priority: "lg" },
];

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL}>{label}</dt>
      <dd className="break-words text-body-sm tabular-nums">{children}</dd>
    </div>
  );
}

/** One alliance below 640: the whole card opens its workspace. */
function Card({ row }: { row: AllianceRow }) {
  return (
    <a
      href={href(row)}
      className={`block border p-3 ${row.attention.length > 0 ? "border-seal" : "border-rule"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0">
          <NameText row={row} />
        </span>
        <Attention row={row} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        <Fact label={t.head.calls}>
          <Calls row={row} />
        </Fact>
        <Fact label={t.head.key}>
          <Key row={row} />
        </Fact>
        <Fact label={t.head.limits}>
          <Limits row={row} />
        </Fact>
        <Fact label={t.card.errors}>
          <Errors row={row} />
        </Fact>
        <Fact label={t.card.posts}>{row.posts}</Fact>
        <Fact label={t.card.seen}>{row.seen}</Fact>
        <Fact label={t.head.changed}>{row.changed}</Fact>
      </dl>
    </a>
  );
}

export function Alliances({ rows }: { rows: AllianceRow[] }) {
  return (
    <AdminSection id="alliances" title={t.title} help={t.help}>
      {rows.length === 0 ? (
        <p className="text-ink/70">{t.none}</p>
      ) : (
        <ResponsiveTable
          caption={t.caption}
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => String(r.id)}
          card={(r) => <Card row={r} />}
        />
      )}
    </AdminSection>
  );
}
