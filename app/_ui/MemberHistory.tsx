// Member history (D60, issue 197): one card per stored roster, newest first. The head says when the data
// was read (a daily read, or an event's Start or End) and since when the card counts; then who joined,
// who left (and where they are now), who changed name, and whose kills or might changed. Each card can
// copy its whole member list for a spreadsheet. Below 640 px and above, the same card.
import Link from "next/link";
import type { ReactNode } from "react";

import { fill, type Dictionary } from "@/lib/copy";
import type { HistoryCard, HistoryMember } from "@/lib/queries";

import { CopyRoster } from "./CopyRoster";
import { EventLabel } from "./EventLabel";
import { type Clock } from "./format";
import { Delta } from "./Num";
import { LABEL } from "./StatTable";

export const HISTORY_FILTERS = ["joined", "left", "renamed", "kills"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

const MUTED = "text-ink/70";
const PLAYER =
  "inline-flex min-h-11 min-w-0 items-center break-words font-medium text-plum hover:underline";
/** Members whose figures changed, shown before "Show all". */
const FIRST_CHANGES = 10;

/** A spreadsheet reads a leading = + − @ as a formula; a leading apostrophe keeps the name as text. */
const cell = (name: string) => {
  const flat = name.replace(/[\t\r\n]+/g, " ");
  return /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
};

/** The roster as tab-separated rows under a header row, by might, with plain integers. */
export function rosterTsv(roster: HistoryMember[], copy: Dictionary): string {
  const rows = [...roster]
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
    .map((m) => [cell(m.name), m.power ?? "", m.kills ?? ""].join("\t"));
  return [[copy.members.name, copy.ledger.might, copy.ledger.kills].join("\t"), ...rows].join("\n");
}

const player = (m: { uid: number; name: string }) => (
  <Link href={`/players/${m.uid}`} className={PLAYER}>
    {m.name}
  </Link>
);

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-rule px-3 py-2">
      <h3 className={LABEL}>{label}</h3>
      <ul className="flex flex-wrap gap-x-4">{children}</ul>
    </div>
  );
}

function Changes({ card, copy }: { card: HistoryCard; copy: Dictionary }) {
  const row = (m: HistoryCard["changed"][number]) => (
    <li
      key={m.uid}
      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 text-sm tabular-nums"
    >
      {player(m)}
      <span className="text-right">
        <Delta delta={m.killsChange} base={null} />
      </span>
      <span className="text-right">
        <Delta delta={m.powerChange} base={null} />
      </span>
    </li>
  );
  const [first, rest] = [card.changed.slice(0, FIRST_CHANGES), card.changed.slice(FIRST_CHANGES)];
  return (
    <div className="border-t border-rule px-3 py-2">
      <p className={`grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 ${LABEL}`}>
        <span>{copy.ledger.member}</span>
        <span className="text-right">{copy.ledger.kills}</span>
        <span className="text-right">{copy.ledger.might}</span>
      </p>
      <ul>{first.map(row)}</ul>
      {rest.length > 0 && (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-plum">
            {fill(copy.members.showAll, { n: card.changed.length })}
          </summary>
          <ul>{rest.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

/** What the card shows under a filter: one kind of change, or everything. */
const parts = (card: HistoryCard, filter: HistoryFilter | null) => ({
  joined: (!filter || filter === "joined") && card.joined.length > 0,
  left: (!filter || filter === "left") && card.left.length > 0,
  renamed: (!filter || filter === "renamed") && card.renamed.length > 0,
  changed: (!filter || filter === "kills") && card.changed.length > 0,
});

export const matchesFilter = (card: HistoryCard, filter: HistoryFilter | null) =>
  filter === null || Object.values(parts(card, filter)).some(Boolean);

/** When the data was read (a daily read, or an event's Start or End), since when, and the copy button. */
function CardHead({ card, clock, copy }: { card: HistoryCard; clock: Clock; copy: Dictionary }) {
  const h = copy.history;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
      <div className="min-w-0">
        <h2 className="font-subhead text-display-sm leading-tight">
          {card.event ? (
            <>
              <EventLabel event={card.event} clock={clock} /> ·{" "}
              {card.event.phase === "before" ? copy.status.start : copy.status.end}
            </>
          ) : (
            h.daily
          )}
        </h2>
        <p className={`text-sm ${MUTED}`}>
          {clock.at(card.at)}
          {card.since && <> · {fill(h.since, { time: clock.at(card.since) })}</>}
        </p>
      </div>
      <CopyRoster text={rosterTsv(card.roster, copy)} />
    </div>
  );
}

export function HistoryCardView({
  card,
  filter,
  clock,
  copy,
}: {
  card: HistoryCard;
  filter: HistoryFilter | null;
  clock: Clock;
  copy: Dictionary;
}) {
  const show = parts(card, filter);
  const h = copy.history;
  const changes = card.joined.length + card.left.length + card.renamed.length + card.changed.length;
  return (
    <li className="mb-3 border border-rule">
      <CardHead card={card} clock={clock} copy={copy} />
      {card.since === null && (
        <p className={`border-t border-rule px-3 py-2 text-sm ${MUTED}`}>{h.first}</p>
      )}
      {card.since !== null && changes === 0 && (
        <p className={`border-t border-rule px-3 py-2 text-sm ${MUTED}`}>{h.noChange}</p>
      )}
      {show.joined && (
        <Group label={copy.members.joined}>
          {card.joined.map((m) => (
            <li key={m.uid}>
              <span aria-hidden="true" className="text-yarn">
                +{" "}
              </span>
              {player(m)}
            </li>
          ))}
        </Group>
      )}
      {show.left && (
        <Group label={copy.members.left}>
          {card.left.map((m) => (
            <li key={m.uid} className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="text-seal">
                −
              </span>
              {player(m)}
              {m.nowIn && (
                <span className={`text-sm ${MUTED}`}>
                  · {fill(h.nowIn, { tag: `[${m.nowIn.tag ?? m.nowIn.unionId}]` })}
                </span>
              )}
            </li>
          ))}
        </Group>
      )}
      {show.renamed && (
        <Group label={h.renamed}>
          {card.renamed.map((r) => (
            <li key={r.uid} className="inline-flex items-center gap-1">
              <span className={MUTED}>{r.from}</span>
              <span aria-hidden="true">→</span>
              {player({ uid: r.uid, name: r.to })}
            </li>
          ))}
        </Group>
      )}
      {show.changed && <Changes card={card} copy={copy} />}
    </li>
  );
}
