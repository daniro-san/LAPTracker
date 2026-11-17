// The merge simulator's result (D84, issue 282): one sentence, then the numbers with HTML bars (D68): members
// against the cap, might split into what fits and what does not, the rank with everyone and within the
// cap, and each side's latest war turnout. Alliance totals only: no member is named. Not a plan: the page
// says so, and nothing here is sent anywhere. The picker is in MergePicker.tsx.
import type { ReactNode } from "react";

import { fill, type Dictionary } from "@/lib/copy";
import type { MergePage, MergeSide } from "@/lib/queries";

import { allianceLabel, type Clock } from "./format";
import { Num } from "./Num";
import { LABEL } from "./StatTable";

/** A bar's box: a rule-coloured track; the parts are drawn in it by width, in percent of `scale`. */
function Track({ children, marker }: { children: ReactNode; marker?: number }) {
  return (
    <span aria-hidden="true" className="relative mt-1 block h-2 bg-rule">
      <span className="flex h-full">{children}</span>
      {marker !== undefined && (
        <span
          className="absolute -top-1 bottom-[-4px] w-0.5 bg-ink"
          style={{ left: `${marker * 100}%` }}
        />
      )}
    </span>
  );
}

const part = (value: number, scale: number, tone: string) => (
  <span
    className={`block h-full ${tone}`}
    style={{ width: `${scale > 0 ? Math.round((value / scale) * 1000) / 10 : 0}%` }}
  />
);

/** One labelled bar with its figure beside the label. */
function BarRow({
  label,
  figure,
  children,
}: {
  label: ReactNode;
  figure: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="py-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 text-sm tabular-nums">{figure}</span>
      </span>
      {children}
    </li>
  );
}

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-1 mt-6 font-subhead text-display-md">{children}</h2>
);

function Members({
  a,
  b,
  r,
  copy,
}: {
  a: MergeSide;
  b: MergeSide;
  r: NonNullable<MergePage["merge"]>["result"];
  copy: Dictionary;
}) {
  const m = copy.merge;
  const scale = Math.max(r.capacity, r.members, a.members, b.members);
  const marker = r.capacity / scale;
  const ok = "bg-ink/60";
  return (
    <section>
      <SectionTitle>{m.membersTitle}</SectionTitle>
      <ul className="divide-y divide-rule">
        {[a, b].map((s) => (
          <BarRow
            key={s.unionId}
            label={allianceLabel(s.tag, s.name)}
            figure={`${s.members} / ${s.capacity ?? r.capacity}`}
          >
            <Track marker={marker}>{part(s.members, scale, ok)}</Track>
          </BarRow>
        ))}
        <BarRow
          label={<span className="font-semibold">{m.together}</span>}
          figure={`${r.members} / ${r.capacity}`}
        >
          <Track marker={marker}>
            {part(r.within, scale, ok)}
            {part(r.leftOut, scale, "bg-seal")}
          </Track>
        </BarRow>
      </ul>
      <p className="mt-1 text-body-sm text-ink/70">
        {fill(m.cap, { cap: r.capacity })}
        {r.shared > 0 && ` · ${m.inBoth}: ${r.shared}`}
        {r.overCap && (
          <>
            {" · "}
            <span className="font-medium text-seal">
              {fill(m.over, { n: r.leftOut, cap: r.capacity })}
            </span>
          </>
        )}
      </p>
    </section>
  );
}

function Might({
  a,
  b,
  r,
  copy,
}: {
  a: MergeSide;
  b: MergeSide;
  r: NonNullable<MergePage["merge"]>["result"];
  copy: Dictionary;
}) {
  const m = copy.merge;
  const scale = Math.max(r.mightAll, a.power ?? 0, b.power ?? 0);
  return (
    <section>
      <SectionTitle>{m.mightTitle}</SectionTitle>
      <ul className="divide-y divide-rule">
        {[a, b].map((s) => (
          <BarRow key={s.unionId} label={allianceLabel(s.tag, s.name)} figure={<Num n={s.power} />}>
            <Track>{part(s.power ?? 0, scale, "bg-ink/60")}</Track>
          </BarRow>
        ))}
        <BarRow
          label={<span className="font-semibold">{`${m.together} · ${m.withEveryone}`}</span>}
          figure={<Num n={r.mightAll} />}
        >
          <Track>
            {part(r.mightWithin, scale, "bg-ink/60")}
            {part(r.mightLeftOut, scale, "bg-seal")}
          </Track>
        </BarRow>
        <BarRow
          label={<span className="font-semibold">{`${m.together} · ${m.withinCap}`}</span>}
          figure={<Num n={r.mightWithin} />}
        >
          <Track>{part(r.mightWithin, scale, "bg-ink/60")}</Track>
        </BarRow>
        {r.overCap && (
          <BarRow label={m.leftOut} figure={<Num n={r.mightLeftOut} />}>
            <Track>{part(r.mightLeftOut, scale, "bg-seal")}</Track>
          </BarRow>
        )}
      </ul>
    </section>
  );
}

function Ranks({ r, copy }: { r: NonNullable<MergePage["merge"]>["result"]; copy: Dictionary }) {
  const m = copy.merge;
  const tile = (label: string, rank: number | null) => (
    <div className="border border-rule px-3 py-2">
      <p className={LABEL}>{label}</p>
      <p className="font-subhead text-display-md tabular-nums">
        {rank === null ? "—" : `#${rank}`}
      </p>
    </div>
  );
  return (
    <section>
      <SectionTitle>{m.rankTitle}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {tile(m.withEveryone, r.rankAll)}
        {tile(m.withinCap, r.rankWithin)}
      </div>
    </section>
  );
}

function Turnout({ sides, clock, copy }: { sides: MergeSide[]; clock: Clock; copy: Dictionary }) {
  const m = copy.merge;
  return (
    <section>
      <SectionTitle>{copy.ledger.fought}</SectionTitle>
      <ul className="divide-y divide-rule">
        {sides.map((s) => (
          <li key={s.unionId} className="py-2">
            <span className="block break-words">{allianceLabel(s.tag, s.name)}</span>
            <span className="block text-sm text-ink/70">
              {s.turnout
                ? `${fill(m.turnout, { gainers: s.turnout.gainers, n: s.turnout.n })} · ${clock.day(s.turnout.eventAt)}`
                : m.noTurnout}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The sentence that answers the question; the same rank twice reads as one. */
export function mergeAnswer(r: NonNullable<MergePage["merge"]>["result"], copy: Dictionary) {
  const rank = (n: number | null) => (n === null ? "—" : `#${n}`);
  return r.overCap
    ? fill(copy.merge.answer, {
        all: rank(r.rankAll),
        within: rank(r.rankWithin),
        cap: r.capacity,
      })
    : fill(copy.merge.answerFits, { all: rank(r.rankAll), n: r.members, cap: r.capacity });
}

export function MergeResultView({
  merge,
  clock,
  copy,
}: {
  merge: NonNullable<MergePage["merge"]>;
  clock: Clock;
  copy: Dictionary;
}) {
  const { a, b, result: r } = merge;
  const m = copy.merge;
  return (
    <>
      <p className="border border-rule px-3 py-3 font-subhead text-display-md leading-snug">
        {mergeAnswer(r, copy)}
      </p>
      <p className="mt-2 text-body-sm text-ink/70">
        {fill(m.rule, { cap: r.capacity })}
        {a.capacity === null &&
          b.capacity === null &&
          ` ${fill(m.capAssumed, { cap: r.capacity })}`}
      </p>
      <Members a={a} b={b} r={r} copy={copy} />
      <Might a={a} b={b} r={r} copy={copy} />
      <Ranks r={r} copy={copy} />
      <Turnout sides={[a, b]} clock={clock} copy={copy} />
      <p className="mt-6 text-body-sm text-ink/70">
        {[a, b]
          .map(
            (s) =>
              `${allianceLabel(s.tag, s.name)}: ${fill(copy.ledger.asOf, { time: clock.at(s.at) })}`,
          )
          .join(" · ")}
      </p>
    </>
  );
}
