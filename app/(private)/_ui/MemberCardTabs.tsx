"use client";

// The member card's four tabs (issue 461, D136): Overview · Info · Squads · History, the WAI-ARIA tabs
// pattern (arrow keys, Home and End move and pick). The open tab is React state; the browser's storage only
// remembers the last pick, best effort (localStorage, as the clock choice), so a tap opens its tab even when
// storage is blocked. The card is drawn only in the browser, after its read, so the remembered tab is read
// when it first renders. Four across at 360 px, each 44 px or taller; nothing is hover-only.
import { useRef, useState, type KeyboardEvent } from "react";

import { tabAfter } from "@/app/_ui/Movers";
import { CARD_TABS, type CardTab } from "@/lib/private/dictionary.card";
import type { CardData } from "@/lib/private/member-card";

const TAB_KEY = "ws.cardTab";

/** What the tabs need of the browser's storage: localStorage, or a stand-in in tests. */
export type TabStore = Pick<Storage, "getItem" | "setItem">;

const browserStore = (): TabStore | null =>
  typeof localStorage === "undefined" ? null : localStorage;

/** The remembered tab; Overview when none was picked, or storage is missing or blocked. */
export function rememberedTab(store: TabStore | null): CardTab {
  try {
    const saved = store?.getItem(TAB_KEY);
    return CARD_TABS.find((t) => t === saved) ?? "overview";
  } catch {
    return "overview";
  }
}

/** A pick: the tab to open, remembered when storage lets it. Never throws. */
export function pickTab(next: CardTab, store: TabStore | null): CardTab {
  try {
    store?.setItem(TAB_KEY, next);
  } catch {
    // Private mode or blocked storage: the tab still opens, and is not remembered.
  }
  return next;
}

/** The open tab, in state, starting from the one remembered on this browser. */
export function useCardTab(): [CardTab, (tab: CardTab) => void] {
  const [tab, setTab] = useState<CardTab>(() => rememberedTab(browserStore()));
  return [tab, (next) => setTab(pickTab(next, browserStore()))];
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
