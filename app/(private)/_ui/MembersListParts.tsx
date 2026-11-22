"use client";

// The Members list's pieces (issue 337): the slim sticky block (search, Filters, the two chips, the column
// labels), the count line naming every filter on, with Clear filters and Copy, the "Not shown" lines, the
// empty states and "Show more".
import { chip } from "@/lib/brand/components/controls";
import { keepMembers, NO_QUERY, sheetFilters } from "@/lib/private/members-list";
import { fill } from "@/lib/words";

import { CopyButton } from "./CopyButton";
import type { ListRow, ListWords } from "./member-list-data";
import { COLUMN_WIDTH, type Column } from "./MemberListRow";
import { PAGE, type ListState } from "./members-list-state";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** A toggle chip: plum when on, dashed when it would give no one. */
export const chipClass = (on: boolean, zero: boolean) =>
  `${chip(on)} whitespace-nowrap ${zero && !on ? "text-ink/70" : ""}`;

export function StickyBar(props: {
  s: ListState;
  t: ListWords;
  column: Column;
  onFilters: () => void;
}) {
  const { s, t } = props;
  const on = sheetFilters(s.query);
  const chips = [
    { id: "r4", label: t["members.filter.r4"], n: s.chips.r4, pressed: s.query.r4 },
    { id: "ask", label: t["list.ask"], n: s.chips.ask, pressed: s.query.ask === "any" },
  ] as const;
  return (
    // Out to the page's margins up to 1023; inside the list's column beside the pane from 1024 (D122).
    // `data-members-sticky` gives the page its scroll-padding-top (globals.css, issue 585).
    <div
      data-members-sticky
      className="sticky top-0 z-[5] -mx-4 mt-4 border-b border-rule bg-paper px-4 py-2 md:-mx-6 md:px-6 lg:mx-0 lg:px-0"
    >
      {/* A label that stays on screen; the placeholder is only the hint (issue 585). */}
      <label htmlFor="members-search" className="block text-body-sm font-semibold">
        {t["members.search.aria"]}
      </label>
      <div className="mt-1 flex gap-2" role="search">
        <input
          id="members-search"
          type="search"
          value={s.query.q}
          onChange={(e) => s.change({ q: e.target.value.slice(0, 64) })}
          placeholder={t["members.search.ph"]}
          className="drawn-field min-h-11 min-w-0 flex-1 px-3"
        />
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={props.onFilters}
          className={`${chipClass(on > 0, false)} shrink-0 font-semibold`}
        >
          {on > 0 ? fill(t["list.filtersN"], { n: on }) : t["list.filters"]}
        </button>
      </div>
      {/* One row that scrolls inside itself when it is wider than the column (D122). */}
      <div
        className="mt-2 flex items-center gap-2 overflow-x-auto [&>*]:shrink-0"
        role="group"
        aria-label={t["members.filter.aria"]}
      >
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.pressed}
            onClick={() =>
              s.change(c.id === "r4" ? { r4: !c.pressed } : { ask: c.pressed ? null : "any" }, c.id)
            }
            className={chipClass(c.pressed, c.n === 0)}
          >
            {c.label}
            <span className="tabular-nums">{c.n}</span>
          </button>
        ))}
      </div>
      {/* The cards' column labels, over every row while the list scrolls; from 640 the table's head row. */}
      <div
        className="mt-1 flex justify-end gap-2 pr-1 text-[13px] text-ink/75 sm:hidden"
        aria-hidden="true"
      >
        <span className={`${COLUMN_WIDTH[props.column]} text-right`}>
          {t[`list.col.${props.column}`]}
        </span>
        <span className="w-12 text-right">{t["list.col.week"]}</span>
      </div>
    </div>
  );
}

/** "Not shown: n with no time zone · See who", and the same for languages (D75: never dropped silently). */
function NotShown({ s, t }: { s: ListState; t: ListWords }) {
  const lines = [
    { n: s.noZone, text: t["list.notShown"], change: { time: null, ask: "timeZone" as const } },
    {
      n: s.noLanguage,
      text: t["list.notShownLang"],
      change: { lang: null, ask: "languages" as const },
    },
  ].filter((l) => l.n > 0);
  return lines.map((l) => (
    <p key={l.text} className="text-body-sm">
      {fill(l.text, { n: l.n })}
      {" · "}
      <button type="button" onClick={() => s.change(l.change, "ask")} className={LINK}>
        {t["list.seeWho"]}
      </button>
    </p>
  ));
}

export function CountLine(props: {
  s: ListState;
  t: ListWords;
  total: number;
  pills: string[];
  copy: string;
}) {
  const { s, t } = props;
  const anyFilter = s.query.r4 || s.query.ask !== null || sheetFilters(s.query) > 0;
  const total = fill(t["members.count"], { n: s.kept.length, total: props.total });
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p aria-live="polite" className="text-body-sm tabular-nums">
          {[total, ...props.pills].join(" · ")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {anyFilter && (
            <button type="button" onClick={s.clearFilters} className={`${LINK} text-body-sm`}>
              {t["list.clear"]}
            </button>
          )}
          <CopyButton
            event="ws_copy_spreadsheet"
            text={props.copy}
            labels={{
              copy: t["members.copy"],
              copied: t["members.copied"],
              failed: t["members.copyFailed"],
            }}
          />
        </div>
      </div>
      {s.order.endsWith("-asc") && <p className="text-body-sm text-ink/80">{t["list.lowFirst"]}</p>}
      <NotShown s={s} t={t} />
    </>
  );
}

export function Empty({ s, t, rows }: { s: ListState; t: ListWords; rows: ListRow[] }) {
  if (s.kept.length > 0) return null;
  const q = s.query.q.trim();
  if (!q)
    return (
      <div className="mt-4">
        <p>{t["members.empty"]}</p>
        <button type="button" onClick={s.clearFilters} className={LINK}>
          {t["list.clear"]}
        </button>
      </div>
    );
  const bySearch = keepMembers(rows, { ...NO_QUERY, q: s.query.q }, s.clock).kept.length;
  return (
    <div className="mt-4">
      <p>{fill(t[bySearch > 0 ? "list.emptyWith" : "list.noMatch"], { q })}</p>
      <div className="flex flex-wrap gap-x-4">
        {bySearch > 0 && (
          <button type="button" onClick={s.clearFilters} className={LINK}>
            {t["list.searchAll"]}
          </button>
        )}
        <button type="button" onClick={() => s.change({ q: "" })} className={LINK}>
          {t["list.clearSearch"]}
        </button>
      </div>
    </div>
  );
}

export function More({ s, t, left }: { s: ListState; t: ListWords; left: number }) {
  if (s.kept.length === 0) return null;
  if (left <= 0)
    return <p className="mt-3 text-center text-body-sm text-ink/70">{t["list.end"]}</p>;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={s.more}
        className="drawn-frame-soft tint-button flex min-h-11 w-full items-center justify-center font-semibold text-plum"
      >
        {fill(t["list.more"], { k: Math.min(PAGE, left), n: left })}
      </button>
      <p className="mt-1 text-center text-body-sm text-ink/70">
        {fill(t["list.showing"], { n: s.kept.length - left, total: s.kept.length })}
      </p>
    </div>
  );
}
