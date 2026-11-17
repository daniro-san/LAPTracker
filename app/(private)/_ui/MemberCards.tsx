"use client";

// The Members tab's cards (issue 296): the server sends each card's words once (member-card-data.ts) and
// this lays them out. A card is a native <details>: tapping it opens the donations per day and the other
// facts, which are drawn only once it is open. Nothing is hover-only. The officers' member facts (issue
// 297) are listed with their source, and "Edit facts" or "Paste what they told you" opens the editor.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";

import { SOURCE_KEY } from "./facts-form";
import { FactsEditor, type EditorProps } from "./FactsEditor";
import type { CardData } from "./member-card-data";

const STATUS_TONE = {
  help: "font-semibold text-yarn",
  break: "font-semibold text-sage",
  checkin: "font-semibold text-yarn",
  new: "font-semibold text-plum",
  nodata: "text-ink/70",
  fine: "text-ink/60",
  none: "",
} as const;

/** What every card's editor shares: the workspace, the words, the server's zone, the zones in use. */
export type EditorContext = Pick<
  EditorProps,
  "slug" | "words" | "language" | "serverZone" | "used"
>;

function Facts({ card, editor }: { card: CardData; editor: EditorContext }) {
  const [mode, setMode] = useState<"edit" | "paste" | null>(null);
  const { words } = editor;
  return (
    <section className="mt-3 border-t border-rule pt-3">
      <h3 className="text-body-sm font-semibold">{words["facts.head"]}</h3>
      <dl className="mt-1 text-body-sm">
        {card.factLines.map((l) => (
          <div key={l.field} className="flex justify-between gap-3 border-t border-rule py-2">
            <dt className="shrink-0 text-ink/75">{l.label}</dt>
            <dd className="min-w-0 text-right break-words whitespace-pre-line">
              <span className="tabular-nums">{l.value}</span>
              {/* "Typed by an officer" is the default and says nothing; the others are plain words. */}
              {l.source && l.source !== "officer" && (
                <span className="ml-2 inline-block text-[12px] text-ink/70">
                  {words[SOURCE_KEY[l.source]]}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("paste")} className={buttonClass("secondary")}>
          {words["facts.paste"]}
        </button>
        <button type="button" onClick={() => setMode("edit")} className={buttonClass("secondary")}>
          {words["facts.edit"]}
        </button>
      </div>
      {mode && (
        <FactsEditor
          {...editor}
          uid={card.uid}
          name={card.name}
          facts={card.stored}
          autoStatus={card.autoStatus}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </section>
  );
}

function Details({ card, editor }: { card: CardData; editor: EditorContext }) {
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
      <Facts card={card} editor={editor} />
    </div>
  );
}

function Card({
  card,
  details,
  editor,
}: {
  card: CardData;
  details: { open: string; of: string };
  editor: EditorContext;
}) {
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
      {open && <Details card={card} editor={editor} />}
    </details>
  );
}

export function MemberCards({
  cards,
  details,
  editor,
}: {
  cards: CardData[];
  /** "Details" and "Details, {name}". */
  details: { open: string; of: string };
  editor: EditorContext;
}) {
  return (
    <ul className="mt-3 grid items-start gap-2 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.uid}>
          <Card card={card} details={details} editor={editor} />
        </li>
      ))}
    </ul>
  );
}
