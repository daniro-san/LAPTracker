// The live event section (issue 307, D69): the strip while the event runs, the server pulse (kills per
// reading interval as bars) and the standings since Start. The strip shows from the Start; the pulse and
// the standings only once a reading exists. After the End the same blocks stay under "During the event".
// Every state has a word, a shape and a colour: the strip says "Live" beside its dot, a slot the game did
// not update is a hollow stub with the words in the Details table, the busiest 30 minutes are named in
// text and underlined.
import { Chip } from "@/lib/brand/components/Chip";
import { fill, type Dictionary } from "@/lib/copy";
import { isOn } from "@/lib/flags";
import type { EventProgress } from "@/lib/queries";

import type { ComparisonRow } from "./event-rows";
import { allianceLabel, compact, signOf, type Clock } from "./format";
import { Pulse } from "./LivePulse";
import { LiveRefresh } from "./LiveRefresh";
import { LiveStandings } from "./LiveStandings";
import { AllianceBadge } from "./Pictures";
import type { StatRow } from "./StatTable";

type Progress = EventProgress;

/** The anchor of the finished event's "During the event" section (the jump link under the title). */
export const LIVE_DURING_ID = "live-during";

/** `NSE +10.9M · OGs +8.0M · TmS +6.6M`: the three alliances that gained most kills since Start. */
function topThree(progress: Progress, rows: ComparisonRow[], locale: string): string {
  const named = new Map(rows.map((r) => [r.unionId, r.tag]));
  return progress.standings
    .flatMap((s) => {
      const tag = named.get(s.unionId);
      const kills = s.change?.kills ?? 0;
      // A no-break space keeps a tag with its figure when the line wraps.
      return tag !== undefined && kills > 0
        ? [`${tag}\u00a0${signOf(kills)}${compact(kills, locale)}`]
        : [];
    })
    .slice(0, 3)
    .join(" · ");
}

/** "● Live · updated 12:30 · next 12:45 server time" (from the Start: "Start 12:31 · first reading
 * 12:45"), the readings count beside it, who leads under it, and the refresh timer. */
export function LiveStrip({
  progress,
  rows,
  clock,
  copy,
  locale,
}: {
  progress: Progress;
  rows: ComparisonRow[];
  clock: Clock;
  copy: Dictionary;
  locale: string;
}) {
  if (!progress.live || !progress.next) return null;
  const top = topThree(progress, rows, locale);
  const next = clock.time(progress.next.at);
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
          <span>
            {progress.latestAt
              ? fill(copy.ledger.liveUpdate, { updated: clock.hhmm(progress.latestAt), next })
              : fill(copy.ledger.liveFirst, { start: clock.hhmm(progress.startAt), next })}
            {progress.overdue && (
              <span className="block">
                {fill(copy.ledger.liveOverdue, { time: clock.hhmm(progress.overdue) })}
              </span>
            )}
          </span>
        </Chip>
        <span className="text-body-sm text-ink/70">
          {progress.readings > 0
            ? fill(copy.ledger.liveReadings, { n: progress.readings })
            : copy.ledger.liveNoReadings}
        </span>
        <LiveRefresh
          at={progress.next.refreshAt.toISOString()}
          renderedAt={progress.asOf.toISOString()}
        />
      </div>
      {top && (
        <p className="mt-2 font-medium tabular-nums">
          {fill(copy.ledger.liveKillsSoFar, { kills: top })}
        </p>
      )}
    </div>
  );
}

type StandingOf = Progress["standings"][number];

/** The card's sub line. No change: the alliance was not read, or a side was stale, said in words. A change
 * from an older reading than the newest one says which reading it is from. */
function standingNote(
  s: StandingOf,
  latestAt: Date | null,
  clock: Clock,
  copy: Dictionary,
): string | null {
  if (!s.change) return s.latest === s.start ? copy.fresh.missing : `○ ${copy.fresh.stale}`;
  return s.at && latestAt && s.at < latestAt
    ? fill(copy.status.lastUpdated, { time: clock.time(s.at) })
    : null;
}

const metric = (label: string, from: number | null, value: number | null, d: number | null) => ({
  label,
  value,
  from,
  base: from,
  delta: d,
});

/** Each alliance's might and kills since Start at its latest usable reading, most kills gained first. */
function Standings({
  progress,
  eventId,
  rows,
  endAt,
  clock,
  copy,
}: {
  progress: Progress;
  eventId: number;
  rows: ComparisonRow[];
  endAt: Date | null;
  clock: Clock;
  copy: Dictionary;
}) {
  const named = new Map(rows.map((r) => [r.unionId, r]));
  const statRows = progress.standings.flatMap((s, i): StatRow[] => {
    const r = named.get(s.unionId);
    if (!r) return [];
    return [
      {
        key: String(s.unionId),
        href: `/events/${eventId}/alliances/${s.unionId}`,
        rank: { n: s.change ? i + 1 : null },
        lead: allianceLabel(r.tag, r.name),
        icon: <AllianceBadge badgeId={r.after?.badgeId ?? r.before?.badgeId} />,
        sub: standingNote(s, progress.latestAt, clock, copy),
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
  // After the End the ledger above uses the End; these figures are the last reading's.
  const help =
    !progress.live && endAt && progress.latestAt
      ? fill(copy.ledger.liveDone, {
          time: clock.hhmm(progress.latestAt),
          end: clock.time(endAt),
        })
      : copy.ledger.liveStandingsHelp;
  return (
    <section aria-labelledby="live-standings">
      <h3 id="live-standings" className="font-subhead text-display-sm leading-tight">
        {progress.live ? copy.ledger.liveStandings : copy.ledger.liveStandingsDone}
      </h3>
      <p className="mb-2 text-body-sm text-ink/70">{help}</p>
      <LiveStandings rows={statRows} />
    </section>
  );
}

/** The pulse and the standings, once there is a reading. Live: they sit above the ledger under their own
 * titles. After the End: under one "During the event" title below it. The pulse's Details table follows
 * the `chart-details` flag (D91). */
export async function LiveSections({
  progress,
  eventId,
  rows,
  endAt,
  clock,
  copy,
  locale,
  placement,
}: {
  progress: Progress;
  eventId: number;
  rows: ComparisonRow[];
  /** The End's time, once it ran. */
  endAt: Date | null;
  clock: Clock;
  copy: Dictionary;
  locale: string;
  /** Live: above the ledger. Finished: below it. */
  placement: "above" | "below";
}) {
  if (progress.live !== (placement === "above") || progress.readings === 0) return null;
  const details = await isOn("chart-details");
  return (
    <div
      id={progress.live ? undefined : LIVE_DURING_ID}
      className={`mt-6 scroll-mt-20 ${progress.live ? "mb-6" : ""}`}
    >
      {!progress.live && (
        <h2 className="mb-3 font-subhead text-display-md leading-tight">
          {copy.ledger.liveDuring}
        </h2>
      )}
      <Pulse progress={progress} details={details} clock={clock} copy={copy} locale={locale} />
      <Standings
        progress={progress}
        eventId={eventId}
        rows={rows}
        endAt={endAt}
        clock={clock}
        copy={copy}
      />
    </div>
  );
}
