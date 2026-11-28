// The member card's Alliance Duel by week (issue 467): one HTML bar per saved week (D68), the date and the
// number beside it. A week with no saved points is the NoData mark with no bar, never 0 and never a fault
// (D75). The member's average and the alliance's weekly average sit under the rows.
import { Bar } from "@/app/_ui/charts/Bar";
import { NONE } from "@/lib/private/fact-text";
import type { DuelCard } from "@/lib/private/member-card-parts";

import { withNoData } from "./NoData";

export function MemberDuelWeeks({ duel }: { duel: DuelCard }) {
  return (
    <section className="mt-3">
      <h3 className="text-body-sm font-semibold">{duel.head}</h3>
      <ol className="mt-1">
        {duel.rows.map((r) => (
          <li
            key={r.label}
            className="grid min-h-6 grid-cols-[8rem_1fr_4.5rem] items-center gap-x-2 text-body-sm"
          >
            <span className="min-w-0 text-ink/75">{r.label}</span>
            <span aria-hidden="true" className="flex h-3 items-center">
              <Bar
                axis="row"
                share={r.share}
                tone="rounded-r-sm bg-plum/60"
                className="h-full w-full"
              />
            </span>
            <span className="text-right tabular-nums">
              {withNoData(r.value ?? NONE, duel.noData)}
            </span>
          </li>
        ))}
      </ol>
      {duel.average && <p className="mt-1 text-body-sm tabular-nums">{duel.average}</p>}
      {duel.alliance && <p className="text-body-sm tabular-nums text-ink/80">{duel.alliance}</p>}
      {duel.rows.some((r) => r.value === null) && (
        <p className="text-body-sm text-ink/70">{duel.none}</p>
      )}
    </section>
  );
}
