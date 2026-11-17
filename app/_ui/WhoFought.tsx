"use client";

// "War turnout" (issue 271): two lists of the alliances, each row one alliance with a bar and its figure as
// text. The first is the share of members with kills gained, the second the top 5's share of the kills
// gained (concentration), ranked for alliances with enough gainers and followed by the rest, muted. Bars
// are plain boxes: neutral for every alliance, yarn for the viewer's own (the ledger's highlight, with a
// "My alliance" chip). Each list shows its first 5 rows and the viewer's own, the rest behind "Show all".
// No member is named; a row links to the alliance's event page.
import Link from "next/link";
import { useState } from "react";

import { TURNOUT_MIN_GAINERS, TURNOUT_TOP } from "@/lib/compute";
import { fill } from "@/lib/copy";
import type { AllianceTurnout, TurnoutLists } from "@/lib/queries";

import { allianceLabel, shareText } from "./format";
import { useCopy, useLocale } from "./LocaleProvider";
import { useMyAlliance } from "./MyAlliance";
import { AllianceBadge } from "./Pictures";
import { ShowAllButton } from "./ShowFirst";
import { LABEL } from "./StatTable";

interface Entry {
  t: AllianceTurnout;
  /** The bar's length, 0 to 1. */
  ratio: number;
  /** The figure as text. */
  figure: string;
  /** Listed after the ranked rows, in muted text. */
  muted: boolean;
}

/** Rows shown before "Show all": the first ones, and the viewer's own wherever it is. */
const SHOWN = 5;

/** The rows a list shows: all when expanded, else the first SHOWN, the viewer's own wherever it is, and
 * `own` (a page's own alliance) when given. */
export function visibleEntries<E extends { t: { unionId: number } }>(
  entries: E[],
  mine: number | null,
  all: boolean,
  own: number | null = null,
): E[] {
  return all
    ? entries
    : entries.filter(({ t }, i) => i < SHOWN || t.unionId === mine || t.unionId === own);
}

function BarList({
  title,
  help,
  entries,
  eventId,
  mine,
}: {
  title: string;
  help?: string;
  entries: Entry[];
  eventId: number;
  mine: number | null;
}) {
  const copy = useCopy();
  const [all, setAll] = useState(false);
  const shown = visibleEntries(entries, mine, all);
  return (
    <div className="min-w-0">
      <h3 className={`mt-1 flex min-h-11 items-center ${LABEL}`}>{title}</h3>
      {help && <p className="mb-1 text-body-sm text-ink/70">{help}</p>}
      <ol className="divide-y divide-rule">
        {shown.map(({ t, ratio, figure, muted }) => (
          <li
            key={t.unionId}
            data-mine={t.unionId === mine ? "" : undefined}
            className={`data-[mine]:bg-yarn/5 data-[mine]:shadow-[inset_3px_0_0_var(--color-yarn)] ${muted ? "text-ink/70" : ""}`}
          >
            <Link
              href={`/events/${eventId}/alliances/${t.unionId}`}
              className="tint-button block min-h-11 px-1 py-1.5"
            >
              <span className="flex items-center gap-2">
                <AllianceBadge badgeId={t.badgeId} />
                <span className="min-w-0 flex-1 truncate">{allianceLabel(t.tag, t.name)}</span>
                <span className="shrink-0 text-sm tabular-nums">{figure}</span>
              </span>
              {t.unionId === mine && (
                <span className="mt-0.5 block text-xs font-medium text-yarn">
                  {copy.ledger.myAlliance}
                </span>
              )}
              <span aria-hidden="true" className="mt-1 block h-2 bg-rule">
                {/* A share of a few gainers is not a measure: a full bar would read as a strong result. */}
                {!muted && (
                  <span
                    className={`block h-full ${t.unionId === mine ? "bg-yarn" : "bg-ink/60"}`}
                    style={{ width: `${Math.round(ratio * 1000) / 10}%` }}
                  />
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {shown.length < entries.length && (
        <ShowAllButton n={entries.length} onClick={() => setAll(true)} />
      )}
    </div>
  );
}

export function WhoFought({ eventId, lists }: { eventId: number; lists: TurnoutLists }) {
  const copy = useCopy();
  const locale = useLocale();
  const mine = useMyAlliance();
  const l = copy.ledger;
  const withKills = lists.withKills.map((t): Entry => {
    const ratio = t.gainers / t.n;
    return {
      t,
      ratio,
      figure: `${shareText(ratio, locale)} · ${t.gainers}/${t.n}`,
      muted: false,
    };
  });
  const topShare = lists.topShare.map((t): Entry => {
    const ratio = t.top / t.gained;
    const few = t.gainers < TURNOUT_MIN_GAINERS;
    const basis = few ? l.fewGainers : fill(l.topBasis, { top: TURNOUT_TOP, n: t.gainers });
    return { t, ratio, figure: `${shareText(ratio, locale)} · ${basis}`, muted: few };
  });
  return (
    <section aria-labelledby="who-fought-h" className="mt-8">
      <h2 id="who-fought-h" className="font-subhead text-display-md">
        {lists.soFar ? l.foughtSoFar : l.fought}
      </h2>
      <p className="mb-2 text-body-sm text-ink/70">
        {lists.soFar ? l.foughtSoFarHelp : l.foughtHelp}
      </p>
      <div className="grid gap-x-6 border border-rule px-3 py-2 lg:grid-cols-2">
        <BarList title={l.withKills} entries={withKills} eventId={eventId} mine={mine} />
        <BarList
          title={l.topShare}
          help={l.topShareHelp}
          entries={topShare}
          eventId={eventId}
          mine={mine}
        />
      </div>
    </section>
  );
}
