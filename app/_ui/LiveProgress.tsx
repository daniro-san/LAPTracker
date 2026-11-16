// The live event section (issue 307, D69): the strip while the event runs, the server pulse (kills per
// reading interval as bars) and the standings since Start. Shown only when the event has samples; after the
// End the same blocks stay under "During the event". Every state has a word, a shape and a colour: the
// strip says "Live" beside its dot, a slot the game did not update is a hollow stub with the words in the
// Details table, the busiest 30 minutes are named in text and underlined.
import { Chip } from "@/lib/brand/components/Chip";
import { fill, type Dictionary } from "@/lib/copy";
import type { EventProgress } from "@/lib/queries";

import type { ComparisonRow } from "./event-rows";
import { allianceLabel, type Clock } from "./format";
import { Pulse } from "./LivePulse";
import { LiveRefresh } from "./LiveRefresh";
import { AllianceBadge } from "./Pictures";
import { StatTable, type StatRow } from "./StatTable";

type Progress = EventProgress;

/** "● Live · updated 12:30 · next 12:45 server time", the readings count beside it, and the refresh timer. */
export function LiveStrip({
  progress,
  clock,
  copy,
}: {
  progress: Progress;
  clock: Clock;
  copy: Dictionary;
}) {
  if (!progress.live || !progress.next) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Chip
        tone="plum"
        icon={
          <span className="inline-flex size-4 items-center justify-center rounded-full border-2 border-plum">
            <span className="size-1.5 rounded-full bg-plum motion-safe:animate-pulse" />
          </span>
        }
      >
        <span className="font-semibold">{copy.ledger.live}</span>
        <span aria-hidden="true">·</span>
        {fill(copy.ledger.liveUpdate, {
          updated: clock.hhmm(progress.latestAt),
          next: clock.time(progress.next.at),
        })}
      </Chip>
      <span className="text-body-sm text-ink/70">
        {fill(copy.ledger.liveReadings, { n: progress.readings })}
      </span>
      <LiveRefresh at={progress.next.refreshAt.toISOString()} />
    </div>
  );
}

/** Each alliance's might and kills since Start at the latest reading, most kills gained first. */
function Standings({
  progress,
  eventId,
  rows,
  copy,
}: {
  progress: Progress;
  eventId: number;
  rows: ComparisonRow[];
  copy: Dictionary;
}) {
  const named = new Map(rows.map((r) => [r.unionId, r]));
  const statRows = progress.standings.flatMap((s): StatRow[] => {
    const r = named.get(s.unionId);
    if (!r) return [];
    // No change: the alliance was not read in the latest reading, or a side was stale. Said in words.
    const note = s.change
      ? null
      : s.latest === s.start
        ? copy.fresh.missing
        : `○ ${copy.fresh.stale}`;
    const metric = (
      label: string,
      from: number | null,
      value: number | null,
      d: number | null,
    ) => ({
      label,
      value,
      from,
      base: from,
      delta: d,
    });
    return [
      {
        key: String(s.unionId),
        liveUnion: s.unionId,
        href: `/events/${eventId}/alliances/${s.unionId}`,
        lead: allianceLabel(r.tag, r.name),
        icon: <AllianceBadge badgeId={r.after?.badgeId ?? r.before?.badgeId} />,
        sub: note,
        metrics: [
          metric(
            copy.ledger.kills,
            s.start.totalKills,
            s.latest.totalKills,
            s.change?.kills ?? null,
          ),
          metric(
            copy.ledger.might,
            s.start.totalPower,
            s.latest.totalPower,
            s.change?.power ?? null,
          ),
        ],
      },
    ];
  });
  return (
    <section aria-labelledby="live-standings">
      <h3 id="live-standings" className="font-subhead text-display-sm leading-tight">
        {progress.live ? copy.ledger.liveStandings : copy.ledger.liveStandingsDone}
      </h3>
      <p className="mb-2 text-body-sm text-ink/70">{copy.ledger.liveStandingsHelp}</p>
      <StatTable
        leadLabel={copy.ledger.alliance}
        columns={[copy.ledger.kills, copy.ledger.might]}
        rows={statRows}
        copy={copy}
      />
    </section>
  );
}

/** The pulse and the standings. Live: they sit above the ledger under their own titles. After the End:
 * under one "During the event" title below it. */
export function LiveSections({
  progress,
  eventId,
  rows,
  clock,
  copy,
  locale,
  placement,
}: {
  progress: Progress;
  eventId: number;
  rows: ComparisonRow[];
  clock: Clock;
  copy: Dictionary;
  locale: string;
  /** Live: above the ledger. Finished: below it. */
  placement: "above" | "below";
}) {
  if (progress.live !== (placement === "above")) return null;
  return (
    <div className="mt-6">
      {!progress.live && (
        <h2 className="mb-3 font-subhead text-display-md leading-tight">
          {copy.ledger.liveDuring}
        </h2>
      )}
      <Pulse progress={progress} clock={clock} copy={copy} locale={locale} />
      <Standings progress={progress} eventId={eventId} rows={rows} copy={copy} />
    </div>
  );
}
