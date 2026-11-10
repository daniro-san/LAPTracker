// The members view of the compare page: one `event-compare` card per member (D57).
import Link from "next/link";
import type { ReactNode } from "react";

import type { Dictionary } from "@/lib/copy";
import type { EventComparison } from "@/lib/queries";

import { CompareCard, differenceCells, eventHead, MUTED, NAME, versus } from "./EventCompare";
import type { Clock } from "./format";
import { Delta, Num } from "./Num";
import { PlayerAvatar } from "./Pictures";

type Member = NonNullable<EventComparison["members"]>[number];

/** One event's Might and Kills change for a member; "not in alliance" when they were not in it. */
function memberCells(s: Member["a"], copy: Dictionary): ReactNode[] {
  if (!s) {
    return [
      <span key="m" className={`text-xs ${MUTED}`}>
        {copy.compare.notIn}
      </span>,
      <span key="k" />,
    ];
  }
  return [
    <Delta key="m" delta={s.change?.power ?? null} base={s.opening?.power ?? null} stack />,
    <Delta key="k" delta={s.change?.kills ?? null} base={s.opening?.kills ?? null} stack />,
  ];
}

/** Might and Kills change in the first and the second event, one pair per figure. */
const changePairs = (m: Member): [number | null | undefined, number | null | undefined][] =>
  (["power", "kills"] as const).map((k) => [m.a?.change?.[k], m.b?.change?.[k]]);

export function MemberCompareCard({
  m,
  data,
  clock,
  copy,
}: {
  m: Member;
  data: EventComparison;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <CompareCard
      name={
        <>
          <PlayerAvatar uid={m.uid} hasAvatar={m.hasAvatar} />
          <Link href={`/players/${m.uid}`} className={NAME}>
            {m.name}
          </Link>
          <span className={`ml-auto text-sm tabular-nums ${MUTED}`}>
            <Num n={m.b?.power ?? m.a?.power ?? null} />
          </span>
        </>
      }
      columns={[copy.ledger.might, copy.ledger.kills]}
      lines={[
        ...(["a", "b"] as const).map((k) => ({
          key: k,
          head: (
            <span className="font-medium text-ink">
              {eventHead(data[k], data[k === "a" ? "b" : "a"], clock)}
            </span>
          ),
          cells: memberCells(m[k], copy),
        })),
        {
          key: "diff",
          label: versus(data, clock, copy),
          head: <span className="hidden sm:inline">{versus(data, clock, copy)}</span>,
          cells: differenceCells(changePairs(m)),
        },
      ]}
    />
  );
}
