"use client";

// The Members tab's cards (issue 296): the server sends each card's words once (member-card-data.ts) and
// this lays them out. A card is a native <details>: tapping it opens the donations per day and the other
// facts, which are drawn only once it is open. Nothing is hover-only.
import { useState } from "react";

import type { CardData } from "./member-card-data";

const STATUS_TONE = {
  checkin: "font-semibold text-yarn",
  new: "font-semibold text-plum",
  nodata: "text-ink/70",
  fine: "text-ink/60",
} as const;

function Details({ card }: { card: CardData }) {
  return (
    <div className="border-t border-rule px-3 py-3">
      <p className="text-body-sm font-semibold">{card.donationsHead}</p>
      <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[13px] leading-5 tabular-nums">
        {card.days.map((d) => (
          <li key={`${d.weekday}${d.day}`} aria-label={d.said} className="border border-rule py-1">
            <span aria-hidden="true" className="block whitespace-nowrap text-ink/70">
              {d.weekday}
            </span>
            <span aria-hidden="true" className="block whitespace-nowrap text-ink/70">
              {d.day}
            </span>
            <span
              aria-hidden="true"
              className={`block min-h-5 whitespace-nowrap ${d.none ? "text-ink/60" : ""}`}
            >
              {d.value}
            </span>
          </li>
        ))}
      </ol>
      <dl className="mt-3 text-body-sm">
        {card.details.map((d) => (
          <div
            key={d.label}
            className="flex justify-between gap-3 border-t border-rule py-2 first:border-t-0"
          >
            <dt className="text-ink/75">{d.label}</dt>
            <dd className="text-right tabular-nums">{d.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Card({ card, details }: { card: CardData; details: { open: string; of: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group border border-rule bg-paper"
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-1 px-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline gap-2">
          <span translate="no" className="min-w-0 flex-1 truncate font-semibold">
            {card.name}
          </span>
          <span translate="no" className="shrink-0 text-body-sm text-ink/80">
            {card.rank}
          </span>
        </span>
        <span className="flex flex-wrap gap-x-3 text-body-sm tabular-nums">
          {card.facts.map((f) => (
            <span
              key={f.text}
              className="inline-block whitespace-nowrap"
              {...(f.game && { translate: "no" as const })}
            >
              {f.text}
            </span>
          ))}
        </span>
        <span className="block text-body-sm">
          <span className={STATUS_TONE[card.status]}>{card.statusLabel}</span>
          {card.statusLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </span>
        <span className="self-end text-body-sm font-semibold text-plum underline underline-offset-4">
          <span className="sr-only">{details.of.replace("{name}", card.name)}</span>
          <span aria-hidden="true">
            {details.open} <span className="inline-block group-open:rotate-180">▾</span>
          </span>
        </span>
      </summary>
      {open && <Details card={card} />}
    </details>
  );
}

export function MemberCards({
  cards,
  details,
}: {
  cards: CardData[];
  /** "Details" and "Details, {name}". */
  details: { open: string; of: string };
}) {
  return (
    <ul className="mt-3 grid items-start gap-2 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.uid}>
          <Card card={card} details={details} />
        </li>
      ))}
    </ul>
  );
}
