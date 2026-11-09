// The compare page's two events (D57): a plain GET form, so it works without JavaScript and the URL is
// the link to share. Each option reads like the header selector's list: the title with its date, or the
// date while a scheduled event keeps its generated name (D49). ⇄ swaps A and B; the alliance stays.
import Link from "next/link";

import { buttonClass } from "@/lib/brand/components/Button";
import type { Dictionary } from "@/lib/copy";
import { comparable, type EventSummary } from "@/lib/queries";

import { eventTitle, type LabeledEvent } from "./EventLabel";
import type { Clock } from "./format";
import { LABEL } from "./StatTable";

export const COMPARE_PATH = "/events/compare";

/** `/events/compare?a=1&b=2[&alliance=3]`. */
export function compareHref(a: number | null, b: number | null, unionId?: number | null) {
  const q = new URLSearchParams();
  if (a !== null) q.set("a", String(a));
  if (b !== null) q.set("b", String(b));
  if (unionId) q.set("alliance", String(unionId));
  return `${COMPARE_PATH}?${q}`;
}

type Choice = LabeledEvent & { id: number };

function EventSelect({
  name,
  letter,
  label,
  value,
  choices,
  clock,
}: {
  name: string;
  letter: string;
  label: string;
  value: number | null;
  choices: Choice[];
  clock: Clock;
}) {
  return (
    <label className="min-w-0">
      <span className={`${LABEL} block`} aria-hidden="true">
        {letter}
      </span>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value ?? undefined}
        className="drawn-field min-h-11 w-full min-w-0 px-3 text-base"
      >
        {choices.map((e) => {
          const title = eventTitle(e);
          return (
            <option key={e.id} value={e.id}>
              {title ? `${title} · ${clock.day(e.eventAtUtc)}` : clock.weekday(e.eventAtUtc)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function ComparePicker({
  choices,
  a,
  b,
  unionId,
  clock,
  copy,
}: {
  choices: Choice[];
  a: number | null;
  b: number | null;
  unionId: number | null;
  clock: Clock;
  copy: Dictionary;
}) {
  const c = copy.compare;
  return (
    <form
      method="get"
      action={COMPARE_PATH}
      className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
    >
      <EventSelect name="a" letter="A" label={c.first} value={a} choices={choices} clock={clock} />
      <Link
        href={compareHref(b, a, unionId)}
        aria-label={c.swap}
        className="inline-flex min-h-11 min-w-11 items-center justify-center font-medium text-plum"
      >
        <span aria-hidden="true">⇄</span>
      </Link>
      <EventSelect name="b" letter="B" label={c.second} value={b} choices={choices} clock={clock} />
      {unionId !== null && <input type="hidden" name="alliance" value={unionId} />}
      <button type="submit" className={buttonClass("primary", "col-span-full sm:col-span-1")}>
        {c.action}
      </button>
    </form>
  );
}

/** The event page's "⇄ Compare" (D57): this event as B, the one before as A; only with two events to pick. */
export function CompareLink({
  events,
  eventId,
  copy,
}: {
  events: Pick<EventSummary, "snapshots">[];
  eventId: number;
  copy: Dictionary;
}) {
  if (events.filter(comparable).length < 2) return null;
  return (
    <Link
      href={compareHref(null, eventId)}
      className="drawn-frame-soft inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-medium text-plum hover:bg-plum/10"
    >
      <span aria-hidden="true">⇄</span>
      {copy.compare.action}
    </Link>
  );
}
