"use client";

// The members' board's two client parts (D105): a time on the viewer's own clock with server time beside it,
// and one text in several languages as tabs, the viewer's language first, the others one tap away. Both
// render server time and the first tab on the server, so server and browser HTML never differ.
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { tabAfter } from "@/app/_ui/Movers";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import { useViewerZone, yourTime } from "./YourTime";

/** "15:00 your time · 16:00 ST": the viewer's clock first, once the browser knows its zone. */
export function BoardTime(props: { st: string; at: number; day: string; words: CalendarWords }) {
  const zone = useViewerZone();
  const mine = zone ? yourTime(props.at, props.day, zone, props.words) : null;
  return mine ? (
    <>
      <span className="font-bold tabular-nums">{mine}</span>
      <span className="text-ink/75">{` · ${props.st}`}</span>
    </>
  ) : (
    <span className="font-bold tabular-nums">{props.st}</span>
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
