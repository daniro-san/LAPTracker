// The member flow page's picker (D89, issue 275): a plain GET form with two selects of the days that have a
// usable daily read, so the URL holds the period, it works without JavaScript and can be shared (D57, D68).
// Each select takes the `.drawn-field` class: a bare select is 22 px tall in WebKit.
import { buttonClass } from "@/lib/brand/components/Button";
import type { Dictionary } from "@/lib/copy";

import { dayDate, type Clock } from "./format";
import { LABEL } from "./StatTable";

export const FLOW_PATH = "/alliances/flow";

function DaySelect({
  name,
  label,
  value,
  days,
  clock,
}: {
  name: string;
  label: string;
  value: string | null;
  days: string[];
  clock: Clock;
}) {
  return (
    <label className="min-w-0">
      <span className={`${LABEL} block`}>{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="drawn-field min-h-11 w-full min-w-0 pl-3 pr-8 text-base"
      >
        {days.map((day) => (
          <option key={day} value={day}>
            {clock.weekday(dayDate(day))}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FlowPicker({
  days,
  from,
  to,
  clock,
  copy,
}: {
  days: string[];
  from: string | null;
  to: string | null;
  clock: Clock;
  copy: Dictionary;
}) {
  const f = copy.flow;
  return (
    <form
      method="get"
      action={FLOW_PATH}
      className="mb-4 grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
    >
      <DaySelect name="from" label={f.from} value={from} days={days} clock={clock} />
      <DaySelect name="to" label={f.to} value={to} days={days} clock={clock} />
      <button type="submit" className={buttonClass("primary", "col-span-full sm:col-span-1")}>
        {f.action}
      </button>
    </form>
  );
}
