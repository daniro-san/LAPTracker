"use client";

// The Members list's "Filter and order" sheet (issue 337): the order, Who, daytime or night for them at a
// server hour, and language. Every control applies at once; each option names how many members the list
// would then hold (the search and the other filters applied). Only chips, radios and native selects, so a
// phone shows its own picker and no number has to be typed.
import type { MemberFilter } from "@/lib/analytics/events";
import { FIELD } from "@/lib/brand/components/controls";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Sheet } from "@/lib/brand/components/Sheet";
import { clockIn, hhmm, zonedInstant } from "@/lib/private/calendar-time";
import {
  ORDERS,
  WHO,
  type MemberQuery,
  type Order,
  type SheetCounts,
  type TimeMode,
  type Who,
} from "@/lib/private/members-list";
import { fill } from "@/lib/words";

import type { ListWords } from "./member-list-data";
import { chipClass } from "./MembersListParts";
import { sheetWords } from "./sheet-words";
import { useClockChoice, useViewerZone } from "./YourTime";

export interface FilterProps {
  words: ListWords;
  query: MemberQuery;
  order: Order;
  counts: SheetCounts;
  /** Before the first end-of-day read: Check in, Needs help and New are not computed ("—", D75). */
  early: boolean;
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

/** "Within their usual hours · 28": a count always follows its words. */
const counted = (label: string, n: number | string) => (
  <span>
    {label} <span className="text-ink/70 tabular-nums">· {n}</span>
  </span>
);
function OrderPart(p: FilterProps) {
  const t = p.words;
  return (
    <fieldset className="grid gap-1.5">
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

const NOT_YET: readonly Who[] = ["checkin", "help", "new"];

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
          const n = p.early && w !== "any" && NOT_YET.includes(w) ? "—" : p.counts.who[w];
          return (
            <button
              key={w}
              type="button"
              aria-pressed={on}
              onClick={() => p.onQuery({ who: w === "any" ? null : w }, "who")}
              className={chipClass(on, n === 0)}
            >
              {label[w]}
              <span className="tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The hour select: "18:00 ST", or "17:00 your time (18:00 ST)" when My time comes first. */
function HourSelect(p: FilterProps & { hour: number }) {
  const t = p.words;
  const viewer = useViewerZone();
  const mineFirst = useClockChoice() === "mine" && viewer !== null;
  const option = (h: number) => {
    const time = hhmm(h * 60);
    if (!mineFirst) return fill(t["list.time.option"], { time });
    const mine = clockIn(zonedInstant(p.today, h * 60, p.serverZone), viewer, p.today).time;
    return fill(t["list.time.optionMine"], { mine, time });
  };
  return (
    <label className="flex flex-col text-body-sm">
      {t["list.time.hour"]}
      <select
        value={p.hour}
        onChange={(e) => {
          const h = Number(e.target.value);
          p.onHour(h);
          if (p.query.time) p.onQuery({ time: { mode: p.query.time.mode, hour: h } });
        }}
        className={`${FIELD} mt-1`}
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {option(h)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TimePart(p: FilterProps) {
  const t = p.words;
  const mode: TimeMode | "any" = p.query.time?.mode ?? "any";
  const hour = p.query.time?.hour ?? p.hour;
  const modes = [
    { id: "any", label: t["list.time.any"] },
    { id: "day", label: counted(t["list.time.day"], p.counts.hours.day[hour] ?? 0) },
    { id: "night", label: counted(t["list.time.night"], p.counts.hours.night[hour] ?? 0) },
  ] as const;
  return (
    <fieldset className="mt-4 grid gap-1.5" aria-describedby="ml-time-help">
      <legend className="mb-1 font-semibold">{t["list.time.head"]}</legend>
      <HourSelect {...p} hour={hour} />
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
          label={m.label}
        />
      ))}
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
          className={FIELD}
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
    <Sheet
      labelledBy="ml-sheet-title"
      onCancel={p.onClose}
      title={t["list.sheet.title"]}
      words={sheetWords(t)}
      primary={{ label: fill(t["list.show"], { n: p.shown }), onClick: p.onClose }}
      secondary={{ label: t["list.clear"], onClick: p.onClear }}
    >
      <OrderPart {...p} />
      <WhoPart {...p} />
      <TimePart {...p} />
      <LanguagePart {...p} />
    </Sheet>
  );
}
