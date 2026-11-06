"use client";

// The Movers section (#70, D53): one framed card whose segmented tabs pick the list (Might ▲, Might ▼,
// Kills ▲), each list as `#rank · name · change`. The event page shows alliances and members side by
// side from 640 px; the alliance page shows its members only. A list with nobody in it reads `—`.
import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { useCopy } from "./LocaleProvider";
import { MOVER_TABS, type MoverItem, type MoverKey, type MoverScope } from "./mover-lists";
import { Delta } from "./Num";
import { AllianceBadge } from "./Pictures";
import { LABEL } from "./StatTable";

function Row({ m }: { m: MoverItem }) {
  return (
    <li>
      <Link
        href={m.href}
        className="flex min-h-11 items-center gap-2 py-1 hover:bg-plum/5 focus-visible:bg-plum/5"
      >
        <span className="w-7 shrink-0 font-semibold tabular-nums">#{m.rank}</span>
        {m.badgeId !== undefined && <AllianceBadge badgeId={m.badgeId} />}
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
          <span className="min-w-0 max-w-full truncate">
            {m.label}
            {m.tag && <span className="text-sm text-ink/70"> [{m.tag}]</span>}
          </span>
          <span className="ml-auto text-sm tabular-nums">
            <Delta delta={m.delta} base={m.base} memberMark={m.mark} />
          </span>
        </span>
      </Link>
    </li>
  );
}

export function Movers({ scopes }: { scopes: MoverScope[] }) {
  const copy = useCopy();
  const id = useId();
  const [active, setActive] = useState<MoverKey>("mightGains");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  /** Arrow keys move between the tabs (WAI-ARIA tabs pattern, automatic activation). */
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    const next = (i + step + MOVER_TABS.length) % MOVER_TABS.length;
    const tab = MOVER_TABS[next];
    if (!tab) return;
    setActive(tab.key);
    tabs.current[next]?.focus();
  };
  return (
    <section aria-labelledby={`${id}-h`} className="mt-8">
      <h2 id={`${id}-h`} className="mb-2 font-subhead text-display-md">
        {copy.ledger.movers}
      </h2>
      <div className="border border-rule">
        <div
          role="tablist"
          aria-labelledby={`${id}-h`}
          className="grid grid-cols-3 border-b border-rule"
        >
          {MOVER_TABS.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`${id}-${t.key}`}
              role="tab"
              type="button"
              aria-selected={t.key === active}
              aria-controls={`${id}-panel`}
              tabIndex={t.key === active ? 0 : -1}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => onKey(e, i)}
              className="inline-flex min-h-11 items-center justify-center gap-1 border-r border-rule px-2 last:border-r-0 aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]"
            >
              <span className={LABEL}>{copy.ledger[t.metric]}</span>
              <span aria-hidden="true" className={t.up ? "text-yarn" : "text-seal"}>
                {t.up ? "▲" : "▼"}
              </span>
              <span className="sr-only">{t.up ? copy.legend.up : copy.legend.down}</span>
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${active}`}
          className="grid gap-x-6 px-3 py-2 sm:grid-cols-2"
        >
          {scopes.map((s) => {
            const items = s.lists[active];
            return (
              <div key={s.key}>
                {s.title && <h3 className="mt-1 font-subhead text-display-sm">{s.title}</h3>}
                {items.length === 0 ? (
                  <p className="flex min-h-11 items-center text-ink/70">—</p>
                ) : (
                  <ol className="divide-y divide-rule">
                    {items.map((m) => (
                      <Row key={m.key} m={m} />
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
