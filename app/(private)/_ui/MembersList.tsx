"use client";

// The Members tab's list (issue 296): a name search, the filter chips (All, New, Check in, Missing info,
// R4 and R5), the count, and "Copy for spreadsheet", which copies the cards shown. The cards and each
// card's spreadsheet line are made on the server; a hidden card keeps its open or closed state.
import { Children, useState, type ReactNode } from "react";

import type { WorkspaceDictionary } from "@/lib/private/dictionary";

const FILTERS = ["all", "new", "checkin", "missing", "r4"] as const;
export type MemberFilter = (typeof FILTERS)[number];

export interface ListItem {
  name: string;
  /** The filters, other than All, that keep this member. */
  filters: MemberFilter[];
  /** The member's spreadsheet line (tab-separated). */
  line: string;
}

/** Lower case without accents, so "Ã" finds "a"; emoji in a name do not need typing. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();

function CopyButton({ text, t }: { text: string; t: WorkspaceDictionary }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const done = (next: "copied" | "failed") => {
    setState(next);
    setTimeout(() => setState("idle"), 2500);
  };
  return (
    <button
      type="button"
      onClick={() =>
        // Inside a promise, so a missing clipboard (an insecure page) also lands in "failed".
        Promise.resolve()
          .then(() => navigator.clipboard.writeText(text))
          .then(
            () => done("copied"),
            () => done("failed"),
          )
      }
      className="drawn-frame-soft tint-button inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-plum"
    >
      <span aria-hidden="true">⧉</span>
      <span aria-live="polite">
        {state === "copied"
          ? t["members.copied"]
          : state === "failed"
            ? t["members.copyFailed"]
            : t["members.copy"]}
      </span>
    </button>
  );
}

export function MembersList({
  items,
  header,
  t,
  children,
}: {
  items: ListItem[];
  /** The spreadsheet's header line. */
  header: string;
  t: WorkspaceDictionary;
  /** One card per item, in the same order. */
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [query, setQuery] = useState("");
  const cards = Children.toArray(children);
  const shown = items.map(
    (it) =>
      (filter === "all" || it.filters.includes(filter)) &&
      fold(it.name).includes(fold(query.trim())),
  );
  const visible = items.filter((_, i) => shown[i]);
  const count = t["members.count"]
    .replace("{n}", String(visible.length))
    .replace("{total}", String(items.length));
  return (
    <section aria-labelledby="members-list" className="mt-6">
      <h2 id="members-list" className="sr-only">
        {t["tab.members"]}
      </h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t["members.search.ph"]}
        aria-label={t["members.search.aria"]}
        className="min-h-11 w-full border border-rule bg-paper px-3"
      />
      <div
        role="group"
        aria-label={t["members.filter.aria"]}
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === filter}
            onClick={() => setFilter(id)}
            className={`min-h-11 shrink-0 whitespace-nowrap border px-4 text-body-sm font-medium ${
              id === filter ? "border-plum bg-plum text-paper" : "border-rule"
            }`}
          >
            {t[`members.filter.${id}`]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-body-sm tabular-nums">
          {count}
        </p>
        <CopyButton text={[header, ...visible.map((v) => v.line)].join("\n")} t={t} />
      </div>
      <ul className="mt-3 grid items-start gap-2 sm:grid-cols-2">
        {cards.map((card, i) => (
          <li key={i} hidden={!shown[i]}>
            {card}
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p className="mt-4">{t["members.empty"]}</p>}
    </section>
  );
}
