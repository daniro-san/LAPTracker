"use client";

// The alliance page's member table (plan Phase 5c): the same StatTable, with client-side sort,
// min/max might inputs and a name filter. All data is already in the page; nothing is fetched.
import { useMemo, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";

import { PlayerAvatar } from "./Pictures";
import { StatTable, type StatMetric, type StatRow } from "./StatTable";

type Stats = { power: number | null; kills: number | null; lv: number | null };

export interface MemberView {
  uid: number;
  name: string;
  hasAvatar: boolean;
  wasName: string | null;
  status: "joined" | "left" | "";
  before: Stats | null;
  after: Stats | null;
}

type SortKey = "might" | "mightDelta" | "kills" | "killsDelta" | "lv" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "might", label: "Might" },
  { key: "mightDelta", label: "Might change" },
  { key: "kills", label: "Kills" },
  { key: "killsDelta", label: "Kills change" },
  { key: "lv", label: "Level" },
  { key: "name", label: "Name" },
];

const FIELD = "drawn-field min-h-11 w-full px-3 text-base";

/** "50000000", "50M", "1.2b", "300k" → a number; null when empty or unreadable. */
export function parseMight(text: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([kmb])?\s*$/i.exec(text);
  if (!m) return null;
  const unit = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ?? 1;
  return Number(m[1]) * unit;
}

const gap = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? null : b - a;

/** Changes exist only for members present in both rosters, and only when both snapshots are fresh. */
function change(m: MemberView, field: keyof Stats, canDelta: boolean): number | null {
  return canDelta ? gap(m.before?.[field], m.after?.[field]) : null;
}

function sortValue(m: MemberView, key: SortKey, canDelta: boolean): number | string {
  const now = m.after ?? m.before;
  const values: Record<SortKey, number | string | null | undefined> = {
    might: now?.power,
    mightDelta: change(m, "power", canDelta),
    kills: now?.kills,
    killsDelta: change(m, "kills", canDelta),
    lv: now?.lv,
    name: m.name.toLowerCase(),
  };
  return values[key] ?? (key === "name" ? "" : Number.NEGATIVE_INFINITY);
}

function metric(m: MemberView, label: string, field: keyof Stats, canDelta: boolean): StatMetric {
  const now = m.after ?? m.before;
  const both = m.before !== null && m.after !== null;
  return {
    label,
    value: now?.[field] ?? null,
    ...(both && canDelta ? { from: m.before?.[field] ?? null } : {}),
    delta: change(m, field, canDelta),
    base: field === "lv" ? null : (m.before?.[field] ?? null),
  };
}

function toRow(m: MemberView, canDelta: boolean): StatRow {
  return {
    key: String(m.uid),
    href: `/players/${m.uid}`,
    lead: m.name,
    icon: <PlayerAvatar uid={m.uid} hasAvatar={m.hasAvatar} />,
    sub: (
      <>
        {m.status && <span className="font-medium">{m.status}</span>}
        {m.status && m.wasName && " · "}
        {m.wasName && `(was ${m.wasName})`}
      </>
    ),
    metrics: [
      metric(m, "Might", "power", canDelta),
      metric(m, "Kills", "kills", canDelta),
      metric(m, "Level", "lv", canDelta),
    ],
  };
}

interface Filters {
  sort: SortKey;
  desc: boolean;
  name: string;
  min: string;
  max: string;
}

function visibleRows(members: MemberView[], f: Filters, canDelta: boolean): StatRow[] {
  const lo = parseMight(f.min);
  const hi = parseMight(f.max);
  const text = f.name.trim().toLowerCase();
  const sign = f.desc ? -1 : 1;
  const inRange = (m: MemberView) => {
    const might = (m.after ?? m.before)?.power ?? 0;
    return (lo === null || might >= lo) && (hi === null || might <= hi);
  };
  return members
    .filter((m) => inRange(m) && m.name.toLowerCase().includes(text))
    .sort((a, b) => {
      const x = sortValue(a, f.sort, canDelta);
      const y = sortValue(b, f.sort, canDelta);
      return x < y ? -sign : x > y ? sign : 0;
    })
    .map((m) => toRow(m, canDelta));
}

function Controls({ f, set }: { f: Filters; set: (patch: Partial<Filters>) => void }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
      <input
        className={`${FIELD} col-span-2 sm:col-span-1`}
        type="search"
        placeholder="Search members by name"
        aria-label="Search members by name"
        value={f.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <input
        className={FIELD}
        inputMode="numeric"
        placeholder="Min might, e.g. 50M"
        aria-label="Minimum might"
        value={f.min}
        onChange={(e) => set({ min: e.target.value })}
      />
      <input
        className={FIELD}
        inputMode="numeric"
        placeholder="Max might"
        aria-label="Maximum might"
        value={f.max}
        onChange={(e) => set({ max: e.target.value })}
      />
      <select
        className={FIELD}
        aria-label="Sort by"
        value={f.sort}
        onChange={(e) => set({ sort: e.target.value as SortKey })}
      >
        {SORTS.map((s) => (
          <option key={s.key} value={s.key}>
            Sort by {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={buttonClass("secondary")}
        onClick={() => set({ desc: !f.desc })}
      >
        {f.desc ? "Highest first" : "Lowest first"}
      </button>
    </div>
  );
}

export function MembersExplorer({
  members,
  canDelta,
}: {
  members: MemberView[];
  canDelta: boolean;
}) {
  const [f, setF] = useState<Filters>({ sort: "might", desc: true, name: "", min: "", max: "" });
  const rows = useMemo(() => visibleRows(members, f, canDelta), [members, f, canDelta]);
  return (
    <div>
      <Controls f={f} set={(patch) => setF({ ...f, ...patch })} />
      <p className="mb-2 text-sm text-ink/70">
        Showing {rows.length} of {members.length} members
      </p>
      <StatTable
        leadLabel="Member"
        columns={["Might", "Kills", "Level"]}
        rows={rows}
        empty="No members match your filters."
      />
    </div>
  );
}
