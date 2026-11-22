"use client";

// The alliance page's member list (plan Phase 5c): the same StatTable, under three controls that read
// without English — sort chips (tap a figure; tap it again to flip the order), one might range on the
// roster's own steps, a name search, Joined / Left chips — and chips that show each active filter and clear
// it. The page's URL sets the first filter (`show=`, `sort=`), and the chips keep it in step, so the address
// is the link to share. The first TOP members show; "Show all" opens the rest. All data is already in the
// page; nothing is fetched.
import { useMemo, useState } from "react";

import { ROLE_TONE, RoleMark } from "@/lib/brand/components/RoleMark";
import { rankDelta } from "@/lib/compute";
import { type Dictionary } from "@/lib/copy";
import { fill } from "@/lib/words";

import { useCopy } from "./LocaleProvider";
import {
  CHANGE_SORTS,
  change,
  filterMembers,
  killsUnknownAt,
  mightSteps,
  plainFilter,
  type MemberFilter,
  type MemberView,
  type SortKey,
} from "./member-views";
import { CHIP, keepInUrl, ShowChips, ShowReads, STATUS, useShowFromUrl } from "./MemberShow";
import { MightRange } from "./MightRange";
import { Num } from "./Num";
import { PlayerAvatar } from "./Pictures";
import { ShowAllButton } from "./ShowFirst";
import { LABEL, StatTable, type StatMetric, type StatRow } from "./StatTable";

const TOP = 20;

const SORTS: { key: SortKey; label: (copy: Dictionary) => string }[] = [
  { key: "might", label: (c) => c.ledger.might },
  { key: "mightDelta", label: (c) => c.members.mightChange },
  { key: "kills", label: (c) => c.ledger.kills },
  { key: "killsDelta", label: (c) => c.members.killsChange },
  { key: "lv", label: (c) => c.ledger.level },
  { key: "name", label: (c) => c.members.byName },
];

type Field = "power" | "kills" | "lv";

/** `compared`: both rosters exist. Without it (the After has not run) there are no changes to show.
 * `sort`: the list's order, for the note on a kills change the ± Kills order counts from 0. */
type Mode = { canDelta: boolean; compared: boolean; sort: SortKey };

/** "Start unknown" or "End unknown" after a `—` kills change; "· counted as 0" while ± Kills orders the
 * list, which counts the unknown figure as 0 (D15 amendment, #692). */
function unknownKills(m: MemberView, mode: Mode, copy: Dictionary): Pick<StatMetric, "unknown"> {
  const side = killsUnknownAt(m, mode.canDelta);
  if (!side) return {};
  const text = side === "start" ? copy.members.startUnknown : copy.members.endUnknown;
  return { unknown: mode.sort === "killsDelta" ? `${text} · ${copy.members.countedAsZero}` : text };
}

function metric(m: MemberView, label: string, field: Field, mode: Mode): StatMetric {
  const now = m.after ?? m.before;
  const from = m.before && m.after && mode.canDelta ? { from: m.before[field] } : {};
  return {
    label,
    value: now?.[field] ?? null,
    ...from,
    delta: change(m, field, mode.canDelta),
    ...(mode.compared ? {} : { noChange: true }),
    base: field === "lv" ? null : (m.before?.[field] ?? null),
  };
}

export function toRow(m: MemberView, mode: Mode, copy: Dictionary): StatRow {
  const n = m.rank.after ?? m.rank.before;
  return {
    key: String(m.uid),
    href: `/players/${m.uid}`,
    rank: mode.compared
      ? { n, move: mode.canDelta ? rankDelta(m.rank.before, m.rank.after) : null }
      : { n },
    lead: m.role ? (
      <>
        <bdi>{m.name}</bdi> <RoleMark role={m.role} />
        <span className="sr-only">
          {" "}
          {m.role.kind === "officer" ? m.role.title : copy.leadership.leader}
        </span>
      </>
    ) : (
      m.name
    ),
    ...(m.role ? { tint: ROLE_TONE[m.role.kind].tint } : {}),
    icon: <PlayerAvatar uid={m.uid} photo={m} />,
    sub: (
      <>
        {m.status && (
          <span className={`font-medium ${STATUS[m.status].tone}`}>
            <span aria-hidden="true">{STATUS[m.status].sign} </span>
            {copy.members[m.status]}
          </span>
        )}
        {m.status && m.wasName && " · "}
        {m.wasName && fill(copy.ledger.was, { name: m.wasName })}
      </>
    ),
    metrics: [
      metric(m, copy.ledger.might, "power", mode),
      { ...metric(m, copy.ledger.kills, "kills", mode), ...unknownKills(m, mode, copy) },
      metric(m, copy.ledger.level, "lv", mode),
    ],
  };
}

function SortChips({
  f,
  set,
  compared,
}: {
  f: MemberFilter;
  set: (p: Partial<MemberFilter>) => void;
  compared: boolean;
}) {
  const copy = useCopy();
  return (
    <div
      role="group"
      aria-label={copy.members.sort}
      className="-mx-4 -my-2 flex gap-2 overflow-x-auto px-4 py-2 sm:-mx-2 sm:flex-wrap sm:px-2"
    >
      {SORTS.filter((s) => compared || !CHANGE_SORTS.includes(s.key)).map((s) => {
        const on = f.sort === s.key;
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={on}
            className={`${CHIP} ${on ? "bg-plum text-paper" : "text-plum"}`}
            onClick={() => set(on ? { desc: !f.desc } : { sort: s.key, desc: s.key !== "name" })}
          >
            {s.label(copy)}
            {on && (
              <>
                <span aria-hidden="true">{f.desc ? "↓" : "↑"}</span>
                <span className="sr-only">
                  {f.desc ? copy.members.highFirst : copy.members.lowFirst}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ActiveChips({
  f,
  steps,
  reset,
  set,
}: {
  f: MemberFilter;
  steps: number[];
  reset: () => void;
  set: (p: Partial<MemberFilter>) => void;
}) {
  const copy = useCopy();
  const ranged = f.lo > 0 || f.hi < steps.length - 1;
  const named = f.name.trim() !== "";
  if (!ranged && !named) return null;
  const chip = `${CHIP} text-plum`;
  return (
    <div className="flex flex-wrap gap-2">
      {named && (
        <button type="button" className={chip} onClick={() => set({ name: "" })}>
          <span aria-hidden="true">✕</span>
          <span className="sr-only">{copy.members.clear}</span> “{f.name.trim()}”
        </button>
      )}
      {ranged && (
        <button
          type="button"
          className={`${chip} tabular-nums`}
          onClick={() => set({ lo: 0, hi: steps.length - 1 })}
        >
          <span aria-hidden="true">✕</span>
          <span className="sr-only">{copy.members.clear}</span> {copy.ledger.might}{" "}
          <Num n={steps[f.lo] ?? null} /> – <Num n={steps[f.hi] ?? null} />
        </button>
      )}
      {ranged && named && (
        <button type="button" className={`${CHIP} text-ink/70`} onClick={reset}>
          {copy.members.clearAll}
        </button>
      )}
    </div>
  );
}

/** `Members 97 / 100`: people in the alliance now over what it holds at most (no capacity: just the
 * count). `shown`, only while a filter is on: how many of them the list keeps. */
export function MemberCount({
  count,
  capacity,
  shown,
}: {
  count: number;
  capacity: number | null;
  shown: number | null;
}) {
  const copy = useCopy();
  return (
    <p className="text-sm tabular-nums text-ink/70">
      <span className={LABEL}>{copy.ledger.members}</span> {count}
      {capacity !== null && ` / ${capacity}`}
      {shown !== null && <span> · {fill(copy.members.shown, { n: String(shown) })}</span>}
    </p>
  );
}

export function MembersExplorer({
  members,
  canDelta,
  compared,
  capacity,
  initial,
  reads,
}: {
  members: MemberView[];
  canDelta: boolean;
  /** Both rosters exist; otherwise the list is the one roster there is, with no changes. */
  compared: boolean;
  /** The most members the alliance can hold, as the upstream reports it; null when not stored. */
  capacity: number | null;
  /** The filter the page's URL asks for (`filterFromUrl`). */
  initial: Pick<MemberFilter, "show" | "sort" | "desc">;
  /** When the Start and End member lists were read, as the page writes them; for the Joined / Left line. */
  reads: { from: string; to: string };
}) {
  const copy = useCopy();
  const steps = useMemo(() => mightSteps(members), [members]);
  const plain = plainFilter(steps);
  const [f, setF] = useState<MemberFilter>({ ...plain, ...initial });
  useShowFromUrl(members, { canDelta, compared }, (show) => setF({ ...f, show }));
  const [all, setAll] = useState(false);
  const kept = useMemo(
    () => filterMembers(members, f, steps, canDelta),
    [members, f, steps, canDelta],
  );
  const shown = all ? kept : kept.slice(0, TOP);
  const set = (patch: Partial<MemberFilter>) => {
    const next = { ...f, ...patch };
    if (next.show !== f.show || next.sort !== f.sort) keepInUrl(next);
    setF(next);
  };
  const mode = { canDelta, compared, sort: f.sort };
  // No Joined / Left against a stale side (REVIEW item 1), nor with one roster (D32).
  const shows = canDelta && compared && members.some((m) => m.status !== "");
  const filtered = f.name.trim() !== "" || f.lo > 0 || f.hi < steps.length - 1 || f.show !== "";
  return (
    <div>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <input
          className="drawn-field min-h-11 w-full px-3 text-base"
          type="search"
          placeholder={copy.members.search}
          aria-label={copy.members.search}
          value={f.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <div className="min-w-0 sm:order-last sm:col-span-2">
          <SortChips f={f} set={set} compared={compared} />
        </div>
        <MightRange f={f} steps={steps} set={set} />
        {shows && (
          <div className="sm:col-span-2">
            <ShowChips f={f} set={set} members={members} />
          </div>
        )}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <MemberCount
          count={members.filter((m) => m.status !== "left").length}
          capacity={capacity}
          shown={filtered ? kept.length : null}
        />
        <ActiveChips f={f} steps={steps} reset={() => set(plain)} set={set} />
      </div>
      <ShowReads show={f.show} reads={reads} />
      <StatTable
        leadLabel={copy.ledger.member}
        columns={[copy.ledger.might, copy.ledger.kills, copy.ledger.level]}
        rows={shown.map((m) => toRow(m, mode, copy))}
        empty={copy.empty.noMembers}
        copy={copy}
      />
      {shown.length < kept.length && <ShowAllButton n={kept.length} onClick={() => setAll(true)} />}
    </div>
  );
}
