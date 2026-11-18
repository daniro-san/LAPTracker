"use client";

// The members' board's two client parts (D105): an event's time column, the viewer's own clock first and
// large with server time under it (D116), and one text in several languages as tabs, the viewer's language
// first, the others one tap away. Both render server time and the first tab on the server, so server and
// browser HTML never differ.
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { tabAfter } from "@/app/_ui/Movers";
import { fill } from "@/lib/copy";
import { clockIn } from "@/lib/private/calendar-time";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import { useViewerZone } from "./YourTime";

/** The zone's short name in the viewer's language ("BRT", "GMT-3"); "" when the browser gives none. */
function zoneName(zone: string, at: number, language: string): string {
  const parts = new Intl.DateTimeFormat(language, { timeZone: zone, timeZoneName: "short" });
  return parts.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
}

/**
 * The viewer's clock for a time, in parts for the board's time column (D116): "15:00", "your time (BRT)",
 * and "+1 d" when that is another day on the viewer's clock.
 */
export function ownClock(
  at: number,
  day: string,
  zone: string,
  language: string,
  words: CalendarWords,
) {
  const { time, shift } = clockIn(at, zone, day);
  const name = zoneName(zone, at, language);
  const label = fill(words["calendar.yours"], { time: "" }).trim();
  const mark = shift > 0 ? words["calendar.nextDay"] : shift < 0 ? words["calendar.prevDay"] : "";
  return { time, label, zone: name ? `(${name})` : "", mark };
}

/**
 * The board's time column: the viewer's own time large, "your time (BRT)" under it, then server time. Server
 * time alone until the browser knows its zone, so server and browser HTML never differ.
 */
export function BoardTimeColumn(props: {
  st: string;
  at: number;
  day: string;
  language: string;
  words: CalendarWords;
}) {
  const zone = useViewerZone();
  if (!zone)
    return <span className="block text-lg leading-tight font-bold tabular-nums">{props.st}</span>;
  const own = ownClock(props.at, props.day, zone, props.language, props.words);
  return (
    <>
      <span className="block text-lg leading-tight font-bold tabular-nums">
        {own.time}
        {own.mark && <span className="ml-1 text-body-sm font-semibold">{own.mark}</span>}
      </span>
      <span className="block text-[13px] leading-tight">
        {own.label} <span className="whitespace-nowrap">{own.zone}</span>
      </span>
      <span className="block text-[13px] leading-tight text-ink/75 tabular-nums">{props.st}</span>
    </>
  );
}

export interface LanguagePanel {
  language: string;
  /** "EN", "PT", "FR". */
  short: string;
  /** "English", in itself. */
  name: string;
  body: ReactNode;
}

/** One panel per written language; a single language shows no tabs. WAI-ARIA tabs, 44 px targets. */
export function LanguageTabs({
  id,
  label,
  panels,
}: {
  id: string;
  label: string;
  panels: LanguagePanel[];
}) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = panels[active] ?? panels[0];
  if (!shown) return null;
  if (panels.length === 1) return <div lang={shown.language}>{shown.body}</div>;
  const onKey = (ev: KeyboardEvent, i: number) => {
    const next = tabAfter(ev.key, i, panels.length);
    if (next === null) return;
    ev.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="mt-2 flex gap-1 border-b border-rule">
        {panels.map((p, i) => (
          <button
            key={p.language}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            id={`${id}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`${id}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(ev) => onKey(ev, i)}
            className="tint-button min-h-11 min-w-11 px-3 font-semibold aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]"
          >
            <span aria-hidden="true">{p.short}</span>
            <span className="sr-only">{p.name}</span>
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        lang={shown.language}
        className="pt-2"
      >
        {shown.body}
      </div>
    </div>
  );
}
