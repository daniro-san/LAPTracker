// The head of an alliance's own page, /alliances/[unionId]/history (D133): the title with the emblem, the
// ranks board line, and for an alliance outside the daily read "Get today's details" and its statement.
import type { Dictionary } from "@/lib/copy";
import type { AllianceStatement } from "@/lib/queries";
import type { BoardAlliance, DetailsState } from "@/lib/queries/alliance-list";

import { AllianceDetails } from "./AllianceDetails";
import { boardLine, detailsView } from "./AllianceRows";
import { AllianceStatementCard } from "./AllianceStatement";
import { ExactToggle } from "./ExactToggle";
import type { Clock } from "./format";
import { AllianceBadge } from "./Pictures";

export function AllianceHead(props: {
  unionId: number;
  label: string;
  badgeId: number | null;
  board: (BoardAlliance & { day: string }) | null;
  /** Null: unknown, the database cannot be reached (D143); no "Get today's details". */
  details: DetailsState | null;
  statement: AllianceStatement | null;
  clock: Clock;
  locale: string;
  copy: Dictionary;
}) {
  const { label, clock, locale, copy } = props;
  const onBoard = boardLine(props.board, clock, locale, copy);
  const details = props.details && detailsView(props.details, clock);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <AllianceBadge badgeId={props.badgeId} size="md" />
          <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
            {label}
          </h1>
        </div>
        <ExactToggle />
      </div>
      {onBoard && <p className="mt-1 text-body-sm tabular-nums">{onBoard}</p>}
      {props.details?.daily && <p className="text-body-sm text-ink/70">{copy.alliances.tracked}</p>}
      {details && <AllianceDetails unionId={props.unionId} view={details} />}
      <AllianceStatementCard
        statement={props.statement}
        clock={clock}
        locale={locale}
        copy={copy}
      />
    </>
  );
}
