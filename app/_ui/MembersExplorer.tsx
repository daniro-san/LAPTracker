"use client";

// The alliance page's member list (plan Phase 5c): the same StatTable, under three controls that read
// without English — sort chips (tap a figure; tap it again to flip the order), one might range on the
// roster's own steps, a name search — and chips that show each active filter and clear it. The first
// TOP members show; "Show all" opens the rest. All data is already in the page; nothing is fetched.
import { useMemo, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { ROLE_TONE, RoleMark } from "@/lib/brand/components/RoleMark";
import { rankDelta } from "@/lib/compute";
import { copy, fill } from "@/lib/copy";

import { compact } from "./format";
import { useLocale } from "./LocaleProvider";
import {
  change,
  filterMembers,
  mightSteps,
  type MemberFilter,
  type MemberView,
  type SortKey,
} from "./member-views";
import { Num } from "./Num";
import { PlayerAvatar } from "./Pictures";
import { LABEL, StatTable, type StatMetric, type StatRow } from "./StatTable";

const TOP = 20;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "might", label: copy.ledger.might },
  { key: "mightDelta", label: copy.members.mightChange },
  { key: "kills", label: copy.ledger.kills },
  { key: "killsDelta", label: copy.members.killsChange },
  { key: "lv", label: copy.ledger.level },
  { key: "name", label: copy.members.byName },
];

/** Joined / Left carry a sign and a colour as well as the word (07c S12; DESIGN.md three channels). */
const STATUS = {
  joined: { sign: "+", word: copy.members.joined, tone: "text-yarn" },
  left: { sign: "−", word: copy.members.left, tone: "text-seal" },
} as const;

const CHIP =
  "drawn-frame-soft inline-flex min-h-11 shrink-0 items-center gap-1 px-3 text-body-sm font-medium";

type Field = "power" | "kills" | "lv";

/** `compared`: both rosters exist. Without it (the After has not run) there are no changes to show. */
type Mode = { canDelta: boolean; compared: boolean };

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

function toRow(m: MemberView, mode: Mode): StatRow {
  const n = m.rank.after ?? m.rank.before;
  return {
    key: String(m.uid),
    href: `/players/${m.uid}`,
    rank: mode.compared
      ? { n, move: mode.canDelta ? rankDelta(m.rank.before, m.rank.after) : null }
      : { n },
    lead: m.role ? (
      <>
        {m.name} <RoleMark role={m.role} />
        <span className="sr-only">
          {" "}
          {m.role.kind === "officer" ? m.role.title : copy.leadership.leader}
        </span>
      </>
    ) : (
      m.name
    ),
    ...(m.role ? { tint: ROLE_TONE[m.role.kind].tint } : {}),
    icon: <PlayerAvatar uid={m.uid} hasAvatar={m.hasAvatar} />,
    sub: (
      <>
        {m.status && (
          <span className={`font-medium ${STATUS[m.status].tone}`}>
            <span aria-hidden="true">{STATUS[m.status].sign} </span>
            {STATUS[m.status].word}
          </span>
        )}
        {m.status && m.wasName && " · "}
        {m.wasName && fill(copy.ledger.was, { name: m.wasName })}
      </>
    ),
    metrics: [
      metric(m, copy.ledger.might, "power", mode),
      metric(m, copy.ledger.kills, "kills", mode),
      metric(m, copy.ledger.level, "lv", mode),
    ],
  };
}

const CHANGE_SORTS: SortKey[] = ["mightDelta", "killsDelta"];

function SortChips({
  f,
  set,
  compared,
}: {
  f: MemberFilter;
  set: (p: Partial<MemberFilter>) => void;
  compared: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={copy.members.sort}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {SORTS.filter((s) => compared || !CHANGE_SORTS.includes(s.key)).map((s) => {
        const on = f.sort === s.key;
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={on}
            className={`${CHIP} ${on ? "bg-plum text-paper" : "text-plum hover:bg-plum/10"}`}
            onClick={() => set(on ? { desc: !f.desc } : { sort: s.key, desc: s.key !== "name" })}
          >
            {s.label}
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

function MightRange({
  f,
  steps,
  set,
}: {
  f: MemberFilter;
  steps: number[];
  set: (p: Partial<MemberFilter>) => void;
}) {
  const locale = useLocale();
  const max = steps.length - 1;
  const at = (i: number) => compact(steps[i] ?? 0, locale);
  return (
    <div>
      <p className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
        <span className={LABEL}>{copy.ledger.might}</span>
        <span className="font-medium">
          <Num n={steps[f.lo] ?? null} /> – <Num n={steps[f.hi] ?? null} />
        </span>
      </p>
      <div className="range-pair">
        <input
          type="range"
          min={0}
          max={max}
          value={f.lo}
          aria-label={copy.members.low}
          aria-valuetext={at(f.lo)}
          onChange={(e) => set({ lo: Math.min(Number(e.target.value), f.hi) })}
        />
        <input
          type="range"
          min={0}
          max={max}
          value={f.hi}
          aria-label={copy.members.high}
          aria-valuetext={at(f.hi)}
          onChange={(e) => set({ hi: Math.max(Number(e.target.value), f.lo) })}
        />
      </div>
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
  const ranged = f.lo > 0 || f.hi < steps.length - 1;
  const named = f.name.trim() !== "";
  if (!ranged && !named) return null;
  const chip = `${CHIP} text-plum hover:bg-plum/10`;
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
}: {
  members: MemberView[];
  canDelta: boolean;
  /** Both rosters exist; otherwise the list is the one roster there is, with no changes. */
  compared: boolean;
  /** The most members the alliance can hold, as the upstream reports it; null when not stored. */
  capacity: number | null;
}) {
  const steps = useMemo(() => mightSteps(members), [members]);
  const start: MemberFilter = { sort: "might", desc: true, name: "", lo: 0, hi: steps.length - 1 };
  const [f, setF] = useState<MemberFilter>(start);
  const [all, setAll] = useState(false);
  const kept = useMemo(
    () => filterMembers(members, f, steps, canDelta),
    [members, f, steps, canDelta],
  );
  const shown = all ? kept : kept.slice(0, TOP);
  const set = (patch: Partial<MemberFilter>) => setF({ ...f, ...patch });
  const mode = { canDelta, compared };
  const filtered = f.name.trim() !== "" || f.lo > 0 || f.hi < steps.length - 1;
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
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <MemberCount
          count={members.filter((m) => m.status !== "left").length}
          capacity={capacity}
          shown={filtered ? kept.length : null}
        />
        <ActiveChips f={f} steps={steps} reset={() => setF(start)} set={set} />
      </div>
      <StatTable
        leadLabel={copy.ledger.member}
        columns={[copy.ledger.might, copy.ledger.kills, copy.ledger.level]}
        rows={shown.map((m) => toRow(m, mode))}
        empty={copy.empty.noMembers}
      />
      {shown.length < kept.length && (
        <button
          type="button"
          className={`${buttonClass("secondary")} mt-3 w-full sm:w-auto`}
          onClick={() => setAll(true)}
        >
          {fill(copy.members.showAll, { n: String(kept.length) })}
        </button>
      )}
    </div>
  );
}
