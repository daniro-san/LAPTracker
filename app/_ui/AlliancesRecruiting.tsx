// /alliances' "Alliances recruiting" section (issue 792), while its flag is on (D91): the alliances read in the
// last RECRUITING_DAYS days with a spot free, most spots first. Each row: the alliance (a link to its page),
// its spots free, how to join, the minimum might and HQ in plain words, and the date of the read.
import Link from "next/link";
import { Fragment } from "react";

import { type Dictionary } from "@/lib/copy";
import { isOn } from "@/lib/flags";
import { RECRUITING_DAYS, type RecruitingRow } from "@/lib/queries";
import { fill } from "@/lib/words";

import { roundMinimum } from "./AllianceStatement";
import { allianceLabel, dayDate, type Clock } from "./format";
import { AllianceBadge } from "./Pictures";
import { sharedRecruiting } from "./public-reads";

/** `27 spots free (73/100)` · `By application` · `Minimum might 8M` · `Minimum HQ 14`; a missing part is left out. */
function rowParts(r: RecruitingRow, locale: string, copy: Dictionary): string[] {
  const a = copy.alliances;
  const spots = fill(r.spotsFree === 1 ? a.spotFree : a.spotsFree, {
    n: r.spotsFree,
    members: `${r.members}`,
    capacity: `${r.capacity}`,
  });
  const mode = r.open === null ? null : r.open ? copy.statement.open : copy.statement.byApplication;
  return [
    spots,
    mode,
    r.minMight !== null && fill(a.minMight, { might: roundMinimum(r.minMight, locale) }),
    r.minHq !== null && fill(a.minHq, { level: `${r.minHq}` }),
  ].filter((part): part is string => Boolean(part));
}

export async function AlliancesRecruiting({
  today,
  href,
  clock,
  locale,
  copy,
}: {
  /** The server day: reads from RECRUITING_DAYS before it on count. */
  today: string;
  href: (unionId: number) => string;
  clock: Clock;
  locale: string;
  copy: Dictionary;
}) {
  if (!(await isOn("alliances-recruiting"))) return null;
  const rows = await sharedRecruiting(today);
  const a = copy.alliances;
  return (
    <section aria-labelledby="recruiting-h" id="recruiting" className="mt-6 scroll-mt-20">
      <h2 id="recruiting-h" className="font-subhead text-display-md">
        {a.recruiting} <span className="text-ink/70 tabular-nums">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-body-sm text-ink/70">
          {fill(a.recruitingNone, { days: RECRUITING_DAYS })}
        </p>
      ) : (
        <>
          <p className="mb-2 text-body-sm text-ink/70">{a.recruitingLead}</p>
          <ol className="divide-y divide-rule border-y border-rule">
            {rows.map((r) => {
              const [spots, ...rules] = rowParts(r, locale, copy);
              return (
                <li key={r.unionId} className="py-1 sm:flex sm:items-center sm:gap-6">
                  <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                    <AllianceBadge badgeId={r.badgeId} />
                    <Link
                      href={href(r.unionId)}
                      className="flex min-h-11 min-w-0 flex-1 items-center font-medium text-plum underline-offset-2 hover:underline"
                    >
                      <bdi className="min-w-0 name-fit">
                        {allianceLabel(r.tag ?? String(r.unionId), r.name)}
                      </bdi>
                    </Link>
                  </div>
                  <div className="pb-1 pl-8 text-sm sm:w-80 sm:p-0 sm:text-right">
                    {/* Each part stays whole; the line breaks only between parts. */}
                    <p className="tabular-nums">
                      <span className="whitespace-nowrap font-semibold">{spots}</span>
                      {rules.map((part) => (
                        <Fragment key={part}>
                          {" · "}
                          <span className="whitespace-nowrap">{part}</span>
                        </Fragment>
                      ))}
                    </p>
                    <p className="text-ink/70">
                      {fill(copy.ledger.asOf, { time: clock.day(dayDate(r.day)) })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
