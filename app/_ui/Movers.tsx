"use client";

// The Movers section (#70, D53): one framed card whose segmented tabs pick the lists (Might ▲, Might ▼,
// Kills ▲, Rank ▲▼). An alliance line reads `#rank move · name · change`, a member line `#place · name ·
// change`. The event page shows alliances and members side by side from 640 px, and the Rank tab the
// alliances that climbed and fell; the alliance page shows its members only, without a Rank tab. A list
// with nobody in it reads `—`.
import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { KillsMark, LookMark, MightMark, RankMark } from "@/lib/brand/components/MoverMarks";
import type { Dictionary } from "@/lib/copy";

import { useCopy } from "./LocaleProvider";
import {
  MOVER_TABS,
  MOVERS_ID,
  type MoverItem,
  type MoverScope,
  type MoverTab,
} from "./mover-lists";
import { Delta, Rank } from "./Num";
import { AllianceBadge } from "./Pictures";
import { LABEL } from "./StatTable";

function Row({ m }: { m: MoverItem }) {
  return (
    <li>
      <Link
        href={m.href}
        className="flex min-h-11 items-center gap-2 py-1 hover:bg-plum/5 focus-visible:bg-plum/5"
      >
        <span className={`shrink-0 ${m.rank.move === undefined ? "w-7" : "w-16"}`}>
          <Rank n={m.rank.n} move={m.rank.move} />
        </span>
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

const MARKS = { might: MightMark, kills: KillsMark, rank: RankMark };

/** `MIGHT ▲`: the word as a label, the arrow in yarn or seal, the direction's word read out. With
 * `mark`, the tab's drawing leads and the word shows from 640 px only (it is still read out below). */
function Head({
  word,
  up,
  copy,
  mark,
}: {
  word: string;
  up: boolean | null;
  copy: Dictionary;
  mark?: keyof typeof MARKS;
}) {
  const arrows = up === null ? [true, false] : [up];
  const Mark = mark && MARKS[mark];
  return (
    <>
      {Mark && <Mark className="size-5 shrink-0 text-ink/80" />}
      <span className={`${LABEL} ${Mark ? "sr-only sm:not-sr-only" : ""}`}>{word}</span>
      {arrows.map((a) => (
        <span key={String(a)}>
          <span aria-hidden="true" className={a ? "text-yarn" : "text-seal"}>
            {a ? "▲" : "▼"}
          </span>
          <span className="sr-only">{a ? copy.legend.up : copy.legend.down}</span>
        </span>
      ))}
    </>
  );
}

/** One list of the active tab, under its scope's title or, on the Rank tab, under `RANK ▲` / `RANK ▼`. */
function MoverList({
  title,
  up,
  items,
  copy,
}: {
  title: string | null;
  up: boolean | null;
  items: MoverItem[];
  copy: Dictionary;
}) {
  return (
    <div>
      {up !== null ? (
        <h3 className="mt-1 flex items-baseline gap-1">
          <Head word={copy.ledger.rank} up={up} copy={copy} />
        </h3>
      ) : (
        title && <h3 className="mt-1 font-subhead text-display-sm">{title}</h3>
      )}
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
}

export function Movers({ scopes }: { scopes: MoverScope[] }) {
  const copy = useCopy();
  const id = useId();
  const tabs = MOVER_TABS.filter((t) => scopes.some((s) => t.lists.some((k) => s.lists[k])));
  const [active, setActive] = useState<MoverTab>("mightGains");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  /** Arrow keys move between the tabs (WAI-ARIA tabs pattern, automatic activation). */
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    const next = (i + step + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    setActive(tab.key);
    buttons.current[next]?.focus();
  };
  // One section per scope and list of the active tab; the Rank tab heads its two lists by their arrow.
  const sections = scopes.flatMap((s) =>
    (current?.lists ?? []).flatMap((k) => {
      const items = s.lists[k];
      if (!items) return [];
      const up = k === "rankUp" ? true : k === "rankDown" ? false : null;
      return [{ key: `${s.key}-${k}`, title: s.title, up, items }];
    }),
  );
  return (
    <section id={MOVERS_ID} aria-labelledby={`${id}-h`} className="mt-8 scroll-mt-20">
      <h2 id={`${id}-h`} className="mb-2 flex items-center gap-2 font-subhead text-display-md">
        <LookMark className="size-6 shrink-0 text-plum" />
        {copy.ledger.movers}
      </h2>
      <div className="border border-rule">
        <div
          role="tablist"
          aria-labelledby={`${id}-h`}
          className="grid border-b border-rule"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              id={`${id}-${t.key}`}
              role="tab"
              type="button"
              aria-selected={t.key === current?.key}
              aria-controls={`${id}-panel`}
              tabIndex={t.key === current?.key ? 0 : -1}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => onKey(e, i)}
              className="inline-flex min-h-11 flex-wrap items-center justify-center gap-x-1 border-r border-rule px-1 text-center last:border-r-0 aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]"
            >
              <Head word={copy.ledger[t.word]} up={t.up} copy={copy} mark={t.word} />
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${current?.key}`}
          className="grid gap-x-6 px-3 py-2 sm:grid-cols-2"
        >
          {current && current.up !== null && (
            <p className="flex items-baseline gap-1 pt-1 sm:hidden">
              <Head word={copy.ledger[current.word]} up={current.up} copy={copy} />
            </p>
          )}
          {sections.map((s) => (
            <MoverList key={s.key} title={s.title} up={s.up} items={s.items} copy={copy} />
          ))}
        </div>
      </div>
    </section>
  );
}
