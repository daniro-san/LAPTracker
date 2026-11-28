// The member card's Alliance Duel by week (issue 467): one HTML bar per saved week (D68), the date and the
// number beside it. A week with no saved points is the NoData mark with no bar, never 0 and never a fault
// (D75); a member with no saved week at all gets one line instead. The week still running is drawn lighter,
// as partial, not as a collapse. The member's average and the alliance's weekly average sit under the rows.
import { Bar } from "@/app/_ui/charts/Bar";
import { NONE } from "@/lib/private/fact-text";
import type { DuelCard } from "@/lib/private/member-card-parts";

import { withNoData } from "./NoData";

export function MemberDuelWeeks({ duel }: { duel: DuelCard }) {
  const empty = duel.rows.every((r) => r.value === null);
  return (
    <section className="mt-3">
      <h3 className="text-body-sm font-semibold">{duel.head}</h3>
      {empty ? (
        <p className="mt-1 text-body-sm text-ink/75">{duel.empty}</p>
      ) : (
        <ol className="mt-1">
          {duel.rows.map((r) => (
            <li
              key={r.label}
              className="grid min-h-6 grid-cols-[6.75rem_minmax(0,1fr)_3.75rem] items-center gap-x-2 text-body-sm"
            >
              <span className="whitespace-nowrap text-ink/75">{r.label}</span>
              {/* The track is the whole middle column: the alliance's best week spans all of it. */}
              <span aria-hidden="true" className="block h-3 min-w-0">
                <Bar
                  axis="row"
                  share={r.share}
                  tone={r.partial ? "rounded-r-sm bg-plum/30" : "rounded-r-sm bg-plum/60"}
                  className="h-full w-full"
                />
              </span>
              <span className={`text-right tabular-nums ${r.partial ? "text-ink/70" : ""}`}>
                {withNoData(r.value ?? NONE, duel.noData)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {duel.average && <p className="mt-1 text-body-sm tabular-nums">{duel.average}</p>}
      {duel.alliance && <p className="text-body-sm tabular-nums text-ink/80">{duel.alliance}</p>}
      {!empty && duel.rows.some((r) => r.value === null) && (
        <p className="text-body-sm text-ink/70">{duel.none}</p>
      )}
    </section>
  );
}
