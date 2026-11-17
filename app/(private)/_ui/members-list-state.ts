"use client";

// The Members list's state (issue 337): the query and the order, how deep "Show more" went, and what they
// give: the members kept, each option's count and the groups in order. The address follows the query and
// the order (replaceState); only the order is remembered on this browser (localStorage, which may be
// missing: then it lasts until the page is left).
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { track, type MemberFilter } from "@/lib/analytics/events";
import { LANGUAGES } from "@/lib/private/fact-fields";
import {
  chipCounts,
  clockAt,
  keepMembers,
  languagesIn,
  NO_QUERY,
  orderMembers,
  queryString,
  sheetCounts,
  type MemberQuery,
  type Order,
} from "@/lib/private/members-list";

import type { ListRow } from "./member-list-data";

export const PAGE = 25;
const ORDER_KEY = "ws.members.order";
export const ORDER_EVENT: Record<Order, MemberFilter> = {
  rank: "order_rank",
  might: "order_might",
  "might-asc": "order_might_asc",
  kills: "order_kills",
  "kills-asc": "order_kills_asc",
  squad: "order_squad",
};

function readOrder(): Order | null {
  try {
    const v = localStorage.getItem(ORDER_KEY);
    return v && v in ORDER_EVENT ? (v as Order) : null;
  } catch {
    return null;
  }
}
const noSubscribe = () => () => {};

/** Check in and Needs help come first in the default order (D75: a friendly word, never a ranking). */
const needsWord = (r: ListRow) => r.who.includes("checkin") || r.who.includes("help");

/** The address follows the list; it is written again after a sheet's history entry is taken off. */
function useAddress(address: string) {
  useEffect(() => {
    const write = () =>
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${address ? `?${address}` : ""}`,
      );
    write();
    window.addEventListener("popstate", write);
    return () => window.removeEventListener("popstate", write);
  }, [address]);
}

/** The groups in order: the heading (default order only), the rest, then "—" and On a break. */
function groupsOf(rows: ListRow[], order: Order) {
  const sorted = orderMembers(rows, order);
  const heading = order === "rank" ? sorted.ranked.filter(needsWord) : [];
  const main = order === "rank" ? sorted.ranked.filter((r) => !needsWord(r)) : sorted.ranked;
  return {
    heading,
    groups: [
      { key: "main" as const, rows: main },
      { key: "none" as const, rows: sorted.noValue },
      { key: "break" as const, rows: sorted.onBreak },
    ],
  };
}

export function useMembersList(props: {
  rows: ListRow[];
  initialQuery: MemberQuery;
  initialOrder: Order | null;
  today: string;
  /** The server hour when the page was made: the hour picker's first value. */
  hour: number;
  serverZone: string;
  /** Before the first end-of-day read nothing is computed: Who shows "—" (D75). */
  early: boolean;
  sheetOpen: boolean;
}) {
  const { rows } = props;
  const [query, setQuery] = useState(props.initialQuery);
  const [hour, setHour] = useState(props.initialQuery.time?.hour ?? props.hour);
  const [chosen, setChosen] = useState<Order | null>(props.initialOrder);
  const stored = useSyncExternalStore(noSubscribe, readOrder, () => null);
  const order = chosen ?? stored ?? "rank";
  const [depth, setDepth] = useState(PAGE);
  const focusFrom = useRef<number | null>(null);
  const clock = useMemo(
    () => clockAt(props.today, props.serverZone),
    [props.today, props.serverZone],
  );
  const langs = useMemo(() => languagesIn(rows, LANGUAGES), [rows]);
  const { kept, noZone, noLanguage } = useMemo(
    () => keepMembers(rows, query, clock),
    [rows, query, clock],
  );
  const chips = useMemo(() => chipCounts(rows, query, clock), [rows, query, clock]);
  // The sheet's counts (24 hours × 2, every Who and language) only while the sheet is open.
  const sheet = useMemo(
    () => (props.sheetOpen ? sheetCounts(rows, query, clock, langs) : null),
    [props.sheetOpen, rows, query, clock, langs],
  );
  const { heading, groups } = useMemo(() => groupsOf(kept, order), [kept, order]);
  useAddress(queryString(query, order));
  useEffect(() => {
    if (focusFrom.current === null) return;
    document.querySelector<HTMLElement>(`[data-row="${focusFrom.current}"]`)?.focus();
    focusFrom.current = null;
  }, [depth]);

  const change = (next: Partial<MemberQuery>, event?: MemberFilter) => {
    if (event) track("ws_filter_used", { filter: event });
    setQuery((q) => ({ ...q, ...next }));
    setDepth(PAGE);
  };
  const choose = (o: Order) => {
    track("ws_filter_used", { filter: ORDER_EVENT[o] });
    setChosen(o);
    setDepth(PAGE);
    try {
      localStorage.setItem(ORDER_KEY, o);
    } catch {
      // Without storage the order lasts until the page is left.
    }
  };
  const more = () => {
    focusFrom.current = depth;
    setDepth(depth + PAGE);
  };
  const clearFilters = () => change({ ...NO_QUERY, q: query.q });
  return {
    ...{ query, order, depth, hour, clock, langs, kept, noZone, noLanguage, chips, sheet },
    ...{ heading, groups, early: props.early },
    ...{ change, choose, more, clearFilters, setHour },
  };
}

export type ListState = ReturnType<typeof useMembersList>;
