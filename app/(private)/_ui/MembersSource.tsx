// Where the Members tab's rows come from, in one or two short lines (issues 296, 297): the end-of-day
// reads with their "from the game" badge, or, before the alliance's first one, the newest roster
// LAPTracker has, with the hour the end-of-day read runs (DAILY_ROSTER_AT, server time).
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { SourceBadge } from "./SourceBadge";

export function MembersSource(props: {
  t: WorkspaceDictionary;
  early: boolean;
  /** When the rows were read, as "Mon 16 Nov 14:07". */
  readAt: string;
  /** DAILY_ROSTER_AT, "23:30". */
  readHour: string;
}) {
  const { t } = props;
  const when = fill(t["time.server"], { time: props.readAt });
  if (props.early)
    return (
      <p className="mt-2 text-body-sm text-ink/80">
        {fill(t["members.early"], { when, time: props.readHour })}
      </p>
    );
  return (
    <>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-body-sm text-ink/80">
        <span>{t["members.lead"]}</span>
        <SourceBadge source="game" label={t["src.game"]} />
      </p>
      <p className="mt-1 text-body-sm text-ink/80">{fill(t["members.lastRead"], { when })}</p>
    </>
  );
}
