"use client";

// "Kill share vs might share" (issue 280, D83, D158): one row per alliance with one bar, the gap in points
// (kill share minus might share) centred on 0, on one axis built from every row, so "Show all" does not move
// the bars. Rows come biggest gap first. Only the first TOP rows whose kill share is above their might
// share are shown, and the viewer's own wherever it is, until "Show all (n)" opens every row (owner, D83). Every
// row's figure is the gap in points; the ratio is shown only as its range, for an alliance with enough events.
// The bar is Bar's HTML boxes (D68, D158); every figure is also text. No member is named. A row opens the
// alliance's member list sorted by kills gained, highest first (the section exists only once the End ran).
import { useState } from "react";

import type { Carried, CarriedRow } from "@/lib/queries";
import { fill } from "@/lib/words";

import { Bar } from "./charts/Bar";
import { DrilldownLink } from "./DrilldownLink";
import {
  allianceLabel,
  compact,
  pointsText,
  ratioText,
  sharePreciseText,
  shareText,
} from "./format";
import { useCopy, useLocale } from "./LocaleProvider";
import { drillHref } from "./member-views";
import { useMyAlliance } from "./MyAlliance";
import { AllianceBadge } from "./Pictures";
import { ShowAllButton } from "./ShowFirst";

/** Rows shown besides the viewer's own. */
const TOP = 5;

/** The rows shown: all of them once expanded (owner, D83), else the first TOP above the might share and the viewer's own. */
export function visibleRows(rows: CarriedRow[], mine: number | null, all = false): CarriedRow[] {
  if (all) return rows;
  const above = rows.filter((r) => r.killShare > r.mightShare).slice(0, TOP);
  const own = rows.find((r) => r.unionId === mine);
  return own && !above.includes(own) ? [...above, own] : above;
}

/** The axis's half-width: the largest gap among all the rows, shown or not (D158). */
export const gapAxis = (rows: readonly CarriedRow[]) =>
  Math.max(0.001, ...rows.map((r) => Math.abs(r.killShare - r.mightShare)));

/** The gap as one bar from the centre: right when the kill share is above the might share, left when below. */
function GapBar({ gap, axis, mine }: { gap: number; axis: number; mine: boolean }) {
  const tone = mine ? "bg-yarn" : "bg-ink/60";
  return (
    <span aria-hidden="true" className="relative mx-1.5 mt-2 grid h-3 grid-cols-2">
      <span className="absolute inset-x-0 top-1/2 h-px bg-rule" />
      <Bar
        axis="x"
        reverse
        share={gap < 0 ? -gap / axis : null}
        tone={tone}
        className="col-start-1 h-full"
      />
      <Bar
        axis="x"
        share={gap >= 0 ? gap / axis : null}
        tone={tone}
        className="col-start-2 h-full"
      />
      <span className="absolute -inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-ink" />
    </span>
  );
}

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
  const gap = r.killShare - r.mightShare;
  return (
    <li
      data-mine={mine ? "" : undefined}
      className="data-[mine]:bg-yarn/5 data-[mine]:shadow-[inset_3px_0_0_var(--color-yarn)]"
    >
      <DrilldownLink
        href={drillHref(`/events/${eventId}/alliances/${r.unionId}`, { sort: "killsDelta" })}
        surface="kill_share"
        kind="kills"
        count={r.turnout?.gainers ?? 0}
        className="tint-button block min-h-11 px-1 py-1.5"
      >
        <span className="flex items-center gap-2">
          <AllianceBadge badgeId={r.badgeId} />
          <span className="min-w-0 flex-1 truncate">{allianceLabel(r.tag, r.name)}</span>
          <span className="shrink-0 text-sm tabular-nums">
            {pointsText(gap, locale)} {l.carriedPoints}
          </span>
        </span>
        {mine && <span className="mt-0.5 block text-xs font-medium text-yarn">{l.myAlliance}</span>}
        <GapBar gap={gap} axis={axis} mine={mine} />
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
      </DrilldownLink>
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
  const axis = gapAxis(carried.rows);
  const { totals } = carried;
  return (
    <section aria-labelledby="who-carried-h" className="mt-8">
      <h2 id="who-carried-h" className="font-subhead text-display-md">
        {l.carried}
      </h2>
      <p className="text-body-sm text-ink/70">{l.carriedHelp}</p>
      <p className="mb-2 mt-1 text-body-sm text-ink/70">{l.carriedRatioHelp}</p>
      <div className="drawn-card px-3 py-2">
        <p className="text-body-sm">
          {fill(l.carriedTotal, {
            n: totals.alliances,
            kills: compact(totals.killsGained, locale),
            might: compact(totals.might, locale),
          })}
        </p>
        <p className="mt-2 text-body-sm text-ink/80">{l.carriedGapKey}</p>
        <p
          aria-hidden="true"
          className="mx-1 mt-1 grid grid-cols-3 text-xs tabular-nums text-ink/70"
        >
          <span>{pointsText(-axis, locale)}</span>
          <span className="text-center">0</span>
          <span className="text-right">{pointsText(axis, locale)}</span>
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
