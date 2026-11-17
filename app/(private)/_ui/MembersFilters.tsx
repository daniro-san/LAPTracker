"use client";

// The Members list's "Filter and order" sheet (issue 337): the order, Who, daytime or night for them at a
// server hour, and language. Every control applies at once; each option carries how many members the list
// would then hold (the search and the other filters applied). Only chips, radios and native selects, so a
// phone shows its own picker and no number has to be typed.
import type { MemberFilter } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import { hhmm, zonedInstant, clockIn } from "@/lib/private/calendar-time";
import {
  ORDERS,
  WHO,
  type FacetCounts,
  type MemberQuery,
  type Order,
  type TimeMode,
  type Who,
} from "@/lib/private/members-list";

import type { ListWords } from "./member-list-data";
import { useClockChoice, useViewerZone } from "./YourTime";

const chip = (on: boolean, zero: boolean) =>
  `inline-flex min-h-11 items-center gap-1.5 border px-3 text-body-sm font-medium whitespace-nowrap ${
    on ? "border-plum bg-plum text-paper" : zero ? "border-dashed border-rule" : "border-rule"
  }`;

export interface FilterProps {
  words: ListWords;
  query: MemberQuery;
  order: Order;
  counts: FacetCounts;
  /** Members on the list, and how many have a main squad and a time zone recorded. */
  total: number;
  known: { squad: number; zone: number };
  /** The languages someone has, with their names in the officer's language. */
  languages: { code: string; name: string }[];
  /** The hour the picker shows while no time filter is on, and its server day. */
  hour: number;
  today: string;
  serverZone: string;
  shown: number;
  onQuery: (change: Partial<MemberQuery>, event?: MemberFilter) => void;
  onOrder: (order: Order) => void;
  onHour: (hour: number) => void;
  onClear: () => void;
  onClose: () => void;
}

function OrderPart(p: FilterProps) {
  const t = p.words;
  return (
    <fieldset className="mt-4 grid gap-1.5">
      <legend className="mb-1 font-semibold">{t["list.order.head"]}</legend>
      {ORDERS.map((o) => (
        <RadioField
          key={o}
          name="ml-order"
          checked={p.order === o}
          disabled={o === "squad" && p.known.squad === 0}
          onChange={() => p.onOrder(o)}
          label={t[`list.order.${o}`]}
          help={
            o === "squad" ? fill(t["list.known"], { n: p.known.squad, total: p.total }) : undefined
          }
        />
      ))}
    </fieldset>
  );
}

function WhoPart(p: FilterProps) {
  const t = p.words;
  const label: Record<Who | "any", string> = {
    any: t["list.who.any"],
    checkin: t["status.checkin"],
    help: t["status.help"],
    break: t["status.break"],
    new: t["members.new"],
  };
  return (
    <fieldset className="mt-4">
      <legend className="mb-1 font-semibold">{t["list.who.head"]}</legend>
      <div className="flex flex-wrap gap-2">
        {(["any", ...WHO] as const).map((w) => {
          const on = (p.query.who ?? "any") === w;
          return (
            <button
              key={w}
              type="button"
              aria-pressed={on}
              onClick={() => p.onQuery({ who: w === "any" ? null : w }, "who")}
              className={chip(on, p.counts.who[w] === 0)}
            >
              {label[w]}
              <span className="tabular-nums">{p.counts.who[w]}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function TimePart(p: FilterProps) {
  const t = p.words;
  const viewer = useViewerZone();
  const mineFirst = useClockChoice() === "mine" && viewer !== null;
  const mode: TimeMode | "any" = p.query.time?.mode ?? "any";
  const hour = p.query.time?.hour ?? p.hour;
  const counts = p.counts.hours[mode === "night" ? "night" : "day"];
  const option = (h: number) => {
    const time = hhmm(h * 60);
    if (!mineFirst) return fill(t["list.time.option"], { time, n: counts[h] ?? 0 });
    const mine = clockIn(zonedInstant(p.today, h * 60, p.serverZone), viewer, p.today).time;
    return fill(t["list.time.optionMine"], { mine, time, n: counts[h] ?? 0 });
  };
  const modes = [
    { id: "any", label: t["list.time.any"], n: p.counts.timeAny },
    { id: "day", label: t["list.time.day"], n: p.counts.hours.day[hour] ?? 0 },
    { id: "night", label: t["list.time.night"], n: p.counts.hours.night[hour] ?? 0 },
  ] as const;
  return (
    <fieldset className="mt-4 grid gap-1.5" aria-describedby="ml-time-help">
      <legend className="mb-1 font-semibold">{t["list.time.head"]}</legend>
      {modes.map((m) => (
        <RadioField
          key={m.id}
          name="ml-time"
          checked={mode === m.id}
          onChange={() =>
            p.onQuery(
              { time: m.id === "any" ? null : { mode: m.id, hour } },
              m.id === "day" ? "daytime" : m.id === "night" ? "night" : undefined,
            )
          }
          label={
            <span>
              {m.label} <span className="tabular-nums text-ink/70">· {m.n}</span>
            </span>
          }
        />
      ))}
      <label className="mt-1 flex flex-col text-body-sm">
        {t["list.time.hour"]}
        <select
          value={hour}
          onChange={(e) => {
            const h = Number(e.target.value);
            p.onHour(h);
            if (p.query.time) p.onQuery({ time: { mode: p.query.time.mode, hour: h } });
          }}
          className="drawn-field min-h-11 px-2"
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {option(h)}
            </option>
          ))}
        </select>
      </label>
      <p id="ml-time-help" className="text-body-sm text-ink/70">
        {t["list.time.help"]} {fill(t["list.time.zones"], { n: p.known.zone, total: p.total })}
      </p>
    </fieldset>
  );
}

function LanguagePart(p: FilterProps) {
  const t = p.words;
  return (
    <div className="mt-4">
      <p className="mb-1 font-semibold" id="ml-lang">
        {t["list.lang.head"]}
      </p>
      {p.languages.length === 0 ? (
        <p className="text-body-sm text-ink/80">{t["list.lang.none"]}</p>
      ) : (
        <select
          aria-labelledby="ml-lang"
          value={p.query.lang ?? ""}
          onChange={(e) => p.onQuery({ lang: e.target.value || null }, "language")}
          className="drawn-field min-h-11 w-full px-2"
        >
          <option value="">
            {fill(t["list.lang.option"], { lang: t["list.lang.any"], n: p.counts.langAny })}
          </option>
          {p.languages.map((l) => (
            <option key={l.code} value={l.code}>
              {fill(t["list.lang.option"], { lang: l.name, n: p.counts.lang[l.code] ?? 0 })}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function MembersFilters(p: FilterProps) {
  const t = p.words;
  return (
    <Sheet labelledBy="ml-sheet-title" onCancel={p.onClose} backdropCloses>
      <div className="flex items-center justify-between gap-3">
        <h2
          id="ml-sheet-title"
          tabIndex={-1}
          data-initial-focus
          className="font-display text-display-sm"
        >
          {t["list.sheet.title"]}
        </h2>
        <button type="button" onClick={p.onClose} className={buttonClass("secondary")}>
          {t["intro.close"]}
        </button>
      </div>
      <OrderPart {...p} />
      <WhoPart {...p} />
      <TimePart {...p} />
      <LanguagePart {...p} />
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={p.onClear} className={buttonClass("secondary")}>
          {t["list.clear"]}
        </button>
        <button type="button" onClick={p.onClose} className={buttonClass("primary")}>
          {fill(t["list.show"], { n: p.shown })}
        </button>
      </div>
    </Sheet>
  );
}
