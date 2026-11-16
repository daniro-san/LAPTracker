// The server balance page's bar and bloc cards (D85, issue 283): the stacked bar of each alliance's share
// of the server's might, drawn as HTML boxes (D68), and one card per hypothetical bloc. Colour is never
// the only cue: the cards carry the bloc's letter and the rows (BalanceRows) a check mark.
import Link from "next/link";

import {
  blocFigures,
  blocQuery,
  type BalanceAlliance,
  type BlocFigures,
  type Blocs,
  type Side,
} from "@/lib/balance";
import { fill, type Dictionary } from "@/lib/copy";

import { allianceLabel, sharePreciseText } from "./format";
import { Num } from "./Num";
import { LABEL } from "./StatTable";

/** The fill of a bloc's marks: A plum, B yarn; the rest alternate two inks so neighbours stay apart. */
export const BLOC_FILL = { a: "bg-plum text-paper", b: "bg-yarn text-paper" } as const;
const REST_FILL = ["bg-ink/55", "bg-ink/30"] as const;

export const BALANCE_PATH = "/alliances/balance";

/** The page's link for a set of blocs; an empty builder is the bare path. */
export const balanceHref = (blocs: Blocs, anchor = "") => {
  const q = blocQuery(blocs);
  return `${BALANCE_PATH}${q ? `?${q}` : ""}${anchor}`;
};

export const sideOf = (blocs: Blocs, unionId: number): Side | null =>
  blocs.a.includes(unionId) ? "a" : blocs.b.includes(unionId) ? "b" : null;

/** The shares as one bar, greatest first, with the server's might beside its title. */
export function StackedBar({
  alliances,
  blocs,
  total,
  locale,
  copy,
}: {
  alliances: BalanceAlliance[];
  blocs: Blocs;
  total: number;
  locale: string;
  copy: Dictionary;
}) {
  const list = alliances
    .map((a) => `${allianceLabel(a.tag, null)} ${sharePreciseText(a.might / total, locale)}`)
    .join(", ");
  const anyBloc = blocs.a.length + blocs.b.length > 0;
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className={LABEL}>{copy.balance.shares}</h2>
        <p className="text-sm tabular-nums">
          <span className="text-ink/70">{copy.balance.total} </span>
          <span className="font-medium">
            <Num n={total} />
          </span>
        </p>
      </div>
      <div
        role="img"
        aria-label={fill(copy.balance.bar, { list })}
        className="mt-1 flex h-8 w-full overflow-hidden border border-rule"
      >
        {alliances.map((a, i) => {
          const side = sideOf(blocs, a.unionId);
          return (
            <div
              key={a.unionId}
              className={`h-full min-w-px ${side ? BLOC_FILL[side] : REST_FILL[i % 2]} ${i > 0 ? "border-l border-paper" : ""}`}
              style={{ width: `${(a.might / total) * 100}%` }}
            />
          );
        })}
      </div>
      {anyBloc && (
        <ul aria-hidden="true" className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink/70">
          {(["a", "b"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`inline-block size-3 ${BLOC_FILL[s]}`} />
              {fill(copy.balance.bloc, { bloc: s.toUpperCase() })}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 bg-ink/40" />
            {copy.balance.noBloc}
          </li>
        </ul>
      )}
    </div>
  );
}

function BlocCard({
  side,
  ids,
  figures,
  alliances,
  locale,
  copy,
}: {
  side: Side;
  ids: number[];
  figures: BlocFigures;
  alliances: BalanceAlliance[];
  locale: string;
  copy: Dictionary;
}) {
  const tags = alliances.filter((a) => ids.includes(a.unionId));
  const row = "flex items-baseline justify-between gap-3 text-sm tabular-nums";
  return (
    <li className="min-w-0 border border-rule p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-subhead text-display-sm">
          <span aria-hidden="true" className={`inline-block size-3 ${BLOC_FILL[side]}`} />
          {fill(copy.balance.bloc, { bloc: side.toUpperCase() })}
        </h3>
        <span className="text-xs font-medium uppercase tracking-[0.04em] text-ink/70">
          {copy.balance.hypothetical}
        </span>
      </div>
      {figures.n === 0 ? (
        <p className="mt-2 text-sm text-ink/70">{copy.balance.blocEmpty}</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {fill(copy.balance.blocShare, { share: sharePreciseText(figures.share, locale) })}
          </p>
          <dl className="mt-1">
            {[
              [copy.ledger.might, <Num key="m" n={figures.might} />],
              [copy.ledger.members, <Num key="n" n={figures.members} />],
              [copy.balance.blocAlliances, figures.n],
            ].map(([label, value]) => (
              <div key={String(label)} className={row}>
                <dt className="text-ink/70">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 break-words text-sm">
            {tags.map((a) => allianceLabel(a.tag ?? String(a.unionId), null)).join(" · ")}
          </p>
        </>
      )}
    </li>
  );
}

/** The two bloc cards and a link that empties the builder. */
export function BlocCards({
  alliances,
  blocs,
  locale,
  copy,
}: {
  alliances: BalanceAlliance[];
  blocs: Blocs;
  locale: string;
  copy: Dictionary;
}) {
  return (
    <section aria-labelledby="builder-h" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 id="builder-h" className="font-subhead text-display-md">
          {copy.balance.builder}
        </h2>
        {blocs.a.length + blocs.b.length > 0 && (
          <Link
            href={BALANCE_PATH}
            className="tint-button inline-flex min-h-11 items-center px-2 text-sm font-medium underline underline-offset-2"
          >
            {copy.balance.clear}
          </Link>
        )}
      </div>
      <p className="mb-2 text-body-sm text-ink/70">{copy.balance.builderHelp}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {(["a", "b"] as const).map((s) => (
          <BlocCard
            key={s}
            side={s}
            ids={blocs[s]}
            figures={blocFigures(alliances, blocs[s])}
            alliances={alliances}
            locale={locale}
            copy={copy}
          />
        ))}
      </ul>
    </section>
  );
}
