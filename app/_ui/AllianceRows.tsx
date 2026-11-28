// Every alliance on the server (D133, issue 459): the rows of /alliances (place, emblem, name, the board's
// might and kills), an alliance page's ranks board line, and what its "Get today's details" box shows. Numbers
// beside their words, compact or exact by the page's switch; no chart.
import Link from "next/link";

import { type Dictionary } from "@/lib/copy";
import type { BoardAlliance, DetailsState } from "@/lib/queries/alliance-list";
import { fill } from "@/lib/words";

import type { DetailsView } from "./AllianceDetails";
import { allianceLabel, compact, dayDate, type Clock } from "./format";
import { Num } from "./Num";
import { AllianceBadge } from "./Pictures";

const MUTED = "text-ink/70";

/** Where a row goes: the alliance's page in the home event when it is there, else its own page. */
export const allianceHref = (
  unionId: number,
  inHome: ReadonlySet<number>,
  homeId: number | null,
) =>
  homeId !== null && inHome.has(unionId)
    ? `/events/${homeId}/alliances/${unionId}`
    : `/alliances/${unionId}`;

/** One group of the list: `#n`, the emblem and the name (a link), then might and kills. */
export function AllianceRows({
  rows,
  href,
  copy,
}: {
  rows: BoardAlliance[];
  href: (unionId: number) => string;
  copy: Dictionary;
}) {
  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {rows.map((a) => (
        <li key={a.unionId} className="py-1 sm:flex sm:items-center sm:gap-6">
          <div className="flex min-w-0 items-center gap-2 sm:flex-1">
            <span className="w-10 shrink-0 font-semibold tabular-nums">
              {a.powerRank === null ? "#—" : `#${a.powerRank}`}
            </span>
            <AllianceBadge badgeId={a.badgeId} />
            <Link
              href={href(a.unionId)}
              className="flex min-h-11 min-w-0 flex-1 items-center font-medium text-plum underline-offset-2 hover:underline"
            >
              <bdi className="min-w-0 name-fit">
                {allianceLabel(a.tag ?? String(a.unionId), a.name)}
              </bdi>
            </Link>
          </div>
          <p className="flex gap-4 pb-1 pl-12 text-sm tabular-nums sm:w-64 sm:justify-end sm:p-0">
            <span className="whitespace-nowrap">
              <span className={MUTED}>{copy.ledger.might} </span>
              <Num n={a.power} />
            </span>
            <span className="whitespace-nowrap">
              <span className={MUTED}>{copy.ledger.kills} </span>
              <Num n={a.kills} />
            </span>
          </p>
        </li>
      ))}
    </ol>
  );
}

/** "Ranks board: #23 by might (412M) · #31 by kills (3.10M)", the board's compact numbers; null off the board. */
export function boardLine(
  a: (BoardAlliance & { day: string }) | null,
  clock: Clock,
  locale: string,
  copy: Dictionary,
): string | null {
  if (!a || a.powerRank === null || a.power === null) return null;
  const might = compact(a.power, locale);
  const date = clock.day(dayDate(a.day));
  if (a.killsRank === null || a.kills === null)
    return fill(copy.alliances.boardMight, { date, rank: a.powerRank, might });
  return fill(copy.alliances.board, {
    date,
    rank: a.powerRank,
    might,
    killsRank: a.killsRank,
    kills: compact(a.kills, locale),
  });
}

/** What the details box shows; null when the daily read covers the alliance (no box at all). */
export function detailsView(s: DetailsState, clock: Clock): DetailsView | null {
  if (s.daily) return null;
  if (s.lookup?.status === "done") return { state: "got", time: clock.time(s.lookup.at) };
  if (s.lookup?.status === "refused") return { state: "usedUp" };
  if (s.lookup) return { state: s.lookup.status === "running" ? "running" : "failed" };
  if (s.eventWindow) return { state: "eventPause" };
  return s.usedUp ? { state: "usedUp" } : { state: "button" };
}
