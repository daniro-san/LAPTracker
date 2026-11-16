"use client";

// "Who fought" (issue 271): two lists of the alliances, each row one alliance with a bar and its figure as
// text. The first is the share of members with kills gained, the second the top 5's share of the kills
// gained (concentration). Bars are plain boxes: neutral for every alliance, yarn for the viewer's own
// (the ledger's highlight). No member is named; a row links to the alliance's event page.
import Link from "next/link";

import type { AllianceTurnout, TurnoutLists } from "@/lib/queries";

import { allianceLabel, shareText } from "./format";
import { useCopy, useLocale } from "./LocaleProvider";
import { useMyAlliance } from "./MyAlliance";
import { AllianceBadge } from "./Pictures";
import { LABEL } from "./StatTable";

interface Entry {
  t: AllianceTurnout;
  /** The bar's length, 0 to 1. */
  ratio: number;
  /** The figure as text. */
  figure: string;
}

function BarList({
  title,
  entries,
  eventId,
  mine,
}: {
  title: string;
  entries: Entry[];
  eventId: number;
  mine: number | null;
}) {
  return (
    <div>
      <h3 className={`mt-1 flex min-h-11 items-center ${LABEL}`}>{title}</h3>
      <ol className="divide-y divide-rule">
        {entries.map(({ t, ratio, figure }) => (
          <li
            key={t.unionId}
            data-mine={t.unionId === mine ? "" : undefined}
            className="data-[mine]:bg-yarn/5 data-[mine]:shadow-[inset_3px_0_0_var(--color-yarn)]"
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
              <span aria-hidden="true" className="mt-1 block h-2 bg-rule">
                <span
                  className={`block h-full ${t.unionId === mine ? "bg-yarn" : "bg-ink/60"}`}
                  style={{ width: `${Math.round(ratio * 1000) / 10}%` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WhoFought({ eventId, lists }: { eventId: number; lists: TurnoutLists }) {
  const copy = useCopy();
  const locale = useLocale();
  const mine = useMyAlliance();
  const entries = (
    alliances: readonly AllianceTurnout[],
    ratio: (t: AllianceTurnout) => number,
    figure: (t: AllianceTurnout, share: string) => string,
  ): Entry[] =>
    alliances.map((t) => ({ t, ratio: ratio(t), figure: figure(t, shareText(ratio(t), locale)) }));
  return (
    <section aria-labelledby="who-fought-h" className="mt-8">
      <h2 id="who-fought-h" className="font-subhead text-display-md">
        {copy.ledger.fought}
      </h2>
      <p className="mb-2 text-body-sm text-ink/70">{copy.ledger.foughtHelp}</p>
      <div className="grid gap-x-6 border border-rule px-3 py-2 sm:grid-cols-2">
        <BarList
          title={copy.ledger.withKills}
          entries={entries(
            lists.withKills,
            (t) => t.gainers / t.n,
            (t, share) => `${share} · ${t.gainers}/${t.n}`,
          )}
          eventId={eventId}
          mine={mine}
        />
        <BarList
          title={copy.ledger.topShare}
          entries={entries(
            lists.topShare,
            (t) => t.top / t.gained,
            (_, share) => share,
          )}
          eventId={eventId}
          mine={mine}
        />
      </div>
    </section>
  );
}
