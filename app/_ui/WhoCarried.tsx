"use client";

// "Kill share vs might share" (issue 280, D83): one row per alliance with two marks on one percent axis,
// a square for its share of the might at Start and a round one for its share of the kills gained, joined
// by a line. Rows come biggest gap first. Only the first TOP rows whose kill share is above their might
// share are shown, and the viewer's own wherever it is, until "Show all (n)" opens every row (owner, D83). Every
// row's figure is the gap in points; the ratio is shown only as its range, for an alliance with enough events.
// Marks and the line are plain HTML boxes (D68); every figure is also text. No member is named.
import Link from "next/link";
import { useState } from "react";

import { fill } from "@/lib/copy";
import type { Carried, CarriedRow } from "@/lib/queries";

import {
  allianceLabel,
  compact,
  pointsText,
  ratioText,
  sharePreciseText,
  shareText,
} from "./format";
import { useCopy, useLocale } from "./LocaleProvider";
import { useMyAlliance } from "./MyAlliance";
import { AllianceBadge } from "./Pictures";
import { ShowAllButton } from "./ShowFirst";
import { LABEL } from "./StatTable";

/** Rows shown besides the viewer's own. */
const TOP = 5;

/** The rows shown: all of them once expanded (owner, D83), else the first TOP above the might share and the viewer's own. */
export function visibleRows(rows: CarriedRow[], mine: number | null, all = false): CarriedRow[] {
  if (all) return rows;
  const above = rows.filter((r) => r.killShare > r.mightShare).slice(0, TOP);
  const own = rows.find((r) => r.unionId === mine);
  return own && !above.includes(own) ? [...above, own] : above;
}

/** A mark's place on the axis, as a percent of the track's width. */
const at = (share: number, axis: number) => `${Math.round((share / axis) * 1000) / 10}%`;

function Row({
  r,
  eventId,
  axis,
  mine,
}: {
  r: CarriedRow;
  eventId: number;
  axis: number;
  mine: boolean;
}) {
  const copy = useCopy();
  const locale = useLocale();
  const l = copy.ledger;
  const lo = Math.min(r.mightShare, r.killShare);
  const hi = Math.max(r.mightShare, r.killShare);
  return (
    <li
      data-mine={mine ? "" : undefined}
      className="data-[mine]:bg-yarn/5 data-[mine]:shadow-[inset_3px_0_0_var(--color-yarn)]"
    >
      <Link
        href={`/events/${eventId}/alliances/${r.unionId}`}
        className="tint-button block min-h-11 px-1 py-1.5"
      >
        <span className="flex items-center gap-2">
          <AllianceBadge badgeId={r.badgeId} />
          <span className="min-w-0 flex-1 truncate">{allianceLabel(r.tag, r.name)}</span>
          <span className="shrink-0 text-sm tabular-nums">
            {pointsText(r.killShare - r.mightShare, locale)} {l.carriedPoints}
          </span>
        </span>
        {mine && <span className="mt-0.5 block text-xs font-medium text-yarn">{l.myAlliance}</span>}
        <span aria-hidden="true" className="relative mx-1.5 mt-2 block h-3">
          <span className="absolute inset-x-0 top-1/2 h-px bg-rule" />
          <span
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink/40"
            style={{ left: at(lo, axis), width: at(hi - lo, axis) }}
          />
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-paper"
            style={{ left: at(r.mightShare, axis) }}
          />
          <span
            className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${mine ? "bg-yarn" : "bg-ink"}`}
            style={{ left: at(r.killShare, axis) }}
          />
        </span>
        <span className="mt-1 block text-xs tabular-nums text-ink/70">
          {fill(l.carriedShares, {
            might: sharePreciseText(r.mightShare, locale),
            kills: sharePreciseText(r.killShare, locale),
          })}
          {r.turnout &&
            ` · ${fill(l.carriedTurnout, { share: shareText(r.turnout.gainers / r.turnout.n, locale) })}`}
        </span>
        {r.spread && (
          <span className="block text-xs tabular-nums text-ink/70">
            {fill(l.carriedSpread, {
              low: ratioText(r.spread.low, locale),
              high: ratioText(r.spread.high, locale),
              n: r.spread.n,
            })}
          </span>
        )}
      </Link>
    </li>
  );
}

export function WhoCarried({ eventId, carried }: { eventId: number; carried: Carried }) {
  const copy = useCopy();
  const locale = useLocale();
  const mine = useMyAlliance();
  const l = copy.ledger;
  const [all, setAll] = useState(false);
  const shown = visibleRows(carried.rows, mine, all);
  // One axis for every row: from 0 to the largest share among the rows shown.
  const axis = Math.max(...shown.flatMap((r) => [r.mightShare, r.killShare]), 0.01);
  const { totals } = carried;
  return (
    <section aria-labelledby="who-carried-h" className="mt-8">
      <h2 id="who-carried-h" className="font-subhead text-display-md">
        {l.carried}
      </h2>
      <p className="text-body-sm text-ink/70">{l.carriedHelp}</p>
      <p className="mb-2 mt-1 text-body-sm text-ink/70">{l.carriedRatioHelp}</p>
      <div className="border border-rule px-3 py-2">
        <p className="text-body-sm">
          {fill(l.carriedTotal, {
            n: totals.alliances,
            kills: compact(totals.killsGained, locale),
            might: compact(totals.might, locale),
          })}
        </p>
        <p className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 ${LABEL}`}>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 border-2 border-ink bg-paper" />
            {l.carriedMightMark}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-full bg-ink" />
            {l.carriedKillsMark}
          </span>
        </p>
        <p
          aria-hidden="true"
          className="mx-1 mt-1 flex justify-between text-xs tabular-nums text-ink/70"
        >
          <span>{sharePreciseText(0, locale)}</span>
          <span>{sharePreciseText(axis, locale)}</span>
        </p>
        <ol className="divide-y divide-rule">
          {shown.map((r) => (
            <Row key={r.unionId} r={r} eventId={eventId} axis={axis} mine={r.unionId === mine} />
          ))}
        </ol>
        {shown.length < carried.rows.length && (
          <ShowAllButton n={carried.rows.length} onClick={() => setAll(true)} />
        )}
      </div>
    </section>
  );
}
