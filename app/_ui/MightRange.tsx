"use client";

// The member list's might filter (MembersExplorer): two range thumbs on the roster's own might steps.
import { compact } from "./format";
import { useCopy, useLocale } from "./LocaleProvider";
import type { MemberFilter } from "./member-views";
import { Num } from "./Num";
import { LABEL } from "./StatTable";

export function MightRange({
  f,
  steps,
  set,
}: {
  f: MemberFilter;
  steps: number[];
  set: (p: Partial<MemberFilter>) => void;
}) {
  const copy = useCopy();
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
