"use client";

// The member card's four tabs (issue 461, D136): Overview · Info · Squads · History, the WAI-ARIA tabs
// pattern (arrow keys, Home and End move and pick). The tab an officer last picked is remembered on this
// browser (localStorage, as the clock choice) and read only after hydration, so server and browser HTML
// never differ. Four across at 360 px, each 44 px or taller; nothing is hover-only.
import { useRef, useSyncExternalStore, type KeyboardEvent } from "react";

import { tabAfter } from "@/app/_ui/Movers";
import { CARD_TABS, type CardTab } from "@/lib/private/dictionary.card";
import type { CardData } from "@/lib/private/member-card";

const TAB_KEY = "ws.cardTab";
const listeners = new Set<() => void>();

function readTab(): CardTab {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return CARD_TABS.find((t) => t === saved) ?? "overview";
  } catch {
    return "overview";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The open tab, remembered per browser; Overview until hydration and when none was picked. */
export function useCardTab(): [CardTab, (tab: CardTab) => void] {
  const tab = useSyncExternalStore(subscribe, readTab, () => "overview" as const);
  const pick = (next: CardTab) => {
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Private mode or blocked storage: the tab still opens, and is not remembered.
    }
    for (const listener of listeners) listener();
  };
  return [tab, pick];
}

export const tabId = (uid: number, tab: CardTab) => `card-${uid}-tab-${tab}`;
export const panelId = (uid: number) => `card-${uid}-panel`;

export function CardTabs({
  card,
  active,
  onPick,
}: {
  card: Pick<CardData, "uid" | "tabs">;
  active: CardTab;
  onPick: (tab: CardTab) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (ev: KeyboardEvent, i: number) => {
    const next = tabAfter(ev.key, i, CARD_TABS.length);
    const tab = next === null ? undefined : CARD_TABS[next];
    if (next === null || !tab) return;
    ev.preventDefault();
    onPick(tab);
    buttons.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={card.tabs.label}
      className="grid grid-cols-4 border-b border-rule"
    >
      {CARD_TABS.map((tab, i) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            id={tabId(card.uid, tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(card.uid)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onPick(tab)}
            onKeyDown={(ev) => onKey(ev, i)}
            className="tint-button min-h-11 min-w-0 px-1 text-center text-body-sm font-semibold break-words aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]"
          >
            {card.tabs.names[tab]}
          </button>
        );
      })}
    </div>
  );
}
