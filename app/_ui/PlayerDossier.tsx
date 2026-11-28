// The public player page's own parts (issue 824), on the alliance page's head and growth card: the head's
// facts (server, the alliance linked to its page, might, kills, rank in the alliance, quest points, level), the
// might and kills growth from the daily reads, and the History heading. A value the reads do not have is left
// out.
import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";
import type { PlayerHistory, PlayerInAlliance, ProgressReading } from "@/lib/queries";

import type { DossierFact } from "./DossierHead";
import { allianceLabel, compact } from "./format";
import type { GrowthSeries } from "./GrowthCard";
import { Num } from "./Num";
import { AllianceBadge } from "./Pictures";

/** The alliance the head shows: the newest daily read's (its page is /alliances/[unionId]), unless a newer
 * reading has the player in another alliance; then the newest event's, linked to that event's page. */
export function playerAlliance(
  read: PlayerInAlliance | null,
  newest: ProgressReading | undefined,
  history: PlayerHistory,
) {
  if (read && (!newest || newest.unionId === read.unionId))
    return { ...read, href: `/alliances/${read.unionId}`, inRead: true };
  const { current } = history;
  return {
    unionId: current.unionId,
    tag: current.tag,
    name: history.alliances.at(-1)?.name ?? null,
    badgeId: current.badgeId,
    href: `/events/${current.eventId}/alliances/${current.unionId}`,
    inRead: false,
  };
}

export type ShownAlliance = ReturnType<typeof playerAlliance>;

/** The R5 or a titled R4's title under the rank. */
const roleText = (role: PlayerInAlliance["role"], copy: Dictionary) =>
  role && (role.kind === "officer" ? role.title : copy.leadership.leader);

/** The head's facts. Might and kills are the newest reading's; rank and quest points the daily read's, and only
 * while that read's alliance is the one shown. */
export function playerFacts({
  read,
  alliance,
  newest,
  history,
  copy,
}: {
  read: PlayerInAlliance | null;
  alliance: ShownAlliance;
  newest: ProgressReading | undefined;
  history: PlayerHistory;
  copy: Dictionary;
}): DossierFact[] {
  const l = copy.ledger;
  const own = alliance.inRead ? read : null;
  return [
    { key: "server", label: copy.alliancePage.server, value: own?.server ?? null },
    {
      key: "alliance",
      label: l.alliance,
      value: (
        <TextLink
          href={alliance.href}
          className="inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <AllianceBadge badgeId={alliance.badgeId} />
          {allianceLabel(alliance.tag, alliance.name)}
        </TextLink>
      ),
    },
    { key: "might", label: l.might, value: known(newest?.power ?? history.current.power) },
    { key: "kills", label: l.kills, value: known(newest?.kills ?? history.current.kills) },
    ...rankFacts(own, copy),
    { key: "level", label: l.level, value: known(history.current.lv) },
  ];
}

const known = (n: number | null | undefined) => (n == null ? null : <Num n={n} />);

/** Rank in the alliance (`R4`, with the title under it) and quest points, from the daily read. */
function rankFacts(own: PlayerInAlliance | null, copy: Dictionary): DossierFact[] {
  return [
    {
      key: "rank",
      label: copy.ledger.rank,
      value: own?.rank == null ? null : `R${own.rank}`,
      note: roleText(own?.role ?? null, copy),
    },
    { key: "quest", label: copy.alliancePage.active, value: known(own?.active) },
  ];
}

/** Might and kills, one point per daily read's day (the newest reading of a day when the player was in two
 * rosters that day), oldest first; a series with no known value is left out. */
export function playerGrowth(
  readings: ProgressReading[],
  locale: string,
  copy: Dictionary,
): GrowthSeries[] {
  const byDay = new Map<string, ProgressReading>();
  for (const r of readings) if (r.day !== null) byDay.set(r.day, r);
  const days = [...byDay].sort(([a], [b]) => a.localeCompare(b));
  const series = (key: "power" | "kills", label: string): GrowthSeries => ({
    key,
    label,
    points: days.flatMap(([day, r]) => {
      const value = r[key];
      return value === null ? [] : [{ day, value }];
    }),
    format: (n) => compact(n, locale),
  });
  return [series("power", copy.ledger.might), series("kills", copy.ledger.kills)].filter(
    (s) => s.points.length > 0,
  );
}

/** The History heading, drawn as the alliance page's current tab: the timelines, the day by day and the
 * across-events view sit under it. */
export function HistoryHeading({ copy }: { copy: Dictionary }) {
  return (
    <h2 className="mt-8 border-b border-rule">
      <span className="inline-flex min-h-11 items-center border-b-2 border-plum px-3 font-medium">
        {copy.alliancePage.historyTab}
      </span>
    </h2>
  );
}
