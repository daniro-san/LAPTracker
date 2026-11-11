// The player view of the compare page (issue 199, D57): one `event-compare` card for one player, a line
// per event in the alliance that held them then, and the title with the photo.
import Link from "next/link";
import type { ReactNode } from "react";

import type { Dictionary } from "@/lib/copy";
import type { PlayerComparison, PlayerEventFigures } from "@/lib/queries";

import { CompareCard, differenceCells, eventHead, MUTED, NAME, versus } from "./EventCompare";
import { allianceLabel, type Clock } from "./format";
import { Delta, Num, Rank } from "./Num";
import { AllianceBadge, PlayerAvatar } from "./Pictures";

type Player = PlayerComparison["player"];

const TITLE_LINK = "text-link inline-flex min-h-11 min-w-11 items-center";
const PLAIN_NAME = "min-w-0 break-words font-subhead text-display-sm leading-tight";

/** The player's name, linked to the player page when one exists (a player seen only in a standalone
 * manual round has none: plain text then). */
function PlayerName({ p, link, plain }: { p: Player; link: string; plain: string }) {
  return p.hasPage ? (
    <Link href={`/players/${p.uid}`} className={link}>
      {p.name}
    </Link>
  ) : (
    <span className={plain}>{p.name}</span>
  );
}

/** The page's title row: the photo and the player's name. */
export function PlayerCompareTitle({ p }: { p: Player }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PlayerAvatar uid={p.uid} hasAvatar={p.hasAvatar} size="lg" />
      <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
        <PlayerName p={p} link={TITLE_LINK} plain="" />
      </h1>
    </div>
  );
}

const allianceOf = (f: PlayerEventFigures) => (
  <>
    <AllianceBadge badgeId={f.badgeId} />
    <span className="min-w-0 break-words">{allianceLabel(f.tag, f.name)}</span>
  </>
);

/** Date and rank in the alliance; from 640 px the alliance under them. */
function head(date: string, f: PlayerEventFigures | null) {
  return (
    <span className="flex flex-col">
      <span className="font-medium text-ink">{date}</span>
      {f && <Rank n={f.rank} />}
      {f && <span className="hidden min-w-0 items-center gap-1.5 sm:flex">{allianceOf(f)}</span>}
    </span>
  );
}

/** One event's Might and Kills change; says so when no roster of that event holds the player. */
function cells(f: PlayerEventFigures | null, copy: Dictionary): ReactNode[] {
  if (!f) {
    return [
      <span key="m" className={`text-xs ${MUTED}`}>
        {copy.compare.notTracked}
      </span>,
      <span key="k" />,
    ];
  }
  return [
    <Delta key="m" delta={f.change?.power ?? null} base={f.opening?.power ?? null} stack />,
    <Delta key="k" delta={f.change?.kills ?? null} base={f.opening?.kills ?? null} stack />,
  ];
}

export function PlayerCompareCard({
  data,
  clock,
  copy,
}: {
  data: PlayerComparison;
  clock: Clock;
  copy: Dictionary;
}) {
  const p = data.player;
  return (
    <CompareCard
      name={
        <>
          <PlayerAvatar uid={p.uid} hasAvatar={p.hasAvatar} />
          <PlayerName p={p} link={NAME} plain={PLAIN_NAME} />
          <span className={`ml-auto text-sm tabular-nums ${MUTED}`}>
            <Num n={p.b?.power ?? p.a?.power ?? null} />
          </span>
        </>
      }
      columns={[copy.ledger.might, copy.ledger.kills]}
      lines={[
        ...(["a", "b"] as const).map((k) => {
          const f = p[k];
          return {
            key: k,
            above: f && allianceOf(f),
            head: head(eventHead(data[k], data[k === "a" ? "b" : "a"], clock), f),
            cells: cells(f, copy),
          };
        }),
        {
          key: "diff",
          label: versus(data, clock, copy),
          head: <span className="hidden sm:inline">{versus(data, clock, copy)}</span>,
          cells: differenceCells(
            (["power", "kills"] as const).map((x) => [p.a?.change?.[x], p.b?.change?.[x]]),
          ),
        },
      ]}
    />
  );
}
