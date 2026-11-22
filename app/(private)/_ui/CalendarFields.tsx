"use client";

// The Calendar tab's form pieces (issue 300): a one-of choice drawn as chips (native radios, 44 px, the
// whole chip is the target), a labelled field with its hint or error, and the box a 409 opens: what
// changed, by whom and when, with "Keep theirs" and "Use mine" (owner rule, issue 293).
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import type { Stale } from "./calendar-send";

export function Choice<V extends string>(props: {
  legend: string;
  name: string;
  /** null: nothing chosen yet, so no option is checked. */
  value: V | null;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-body-sm font-semibold">{props.legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {props.options.map((o) => (
          <label
            key={o.value}
            className={`drawn-frame-soft tint-button inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 ${
              props.value === o.value ? "bg-plum/10 font-semibold text-plum" : ""
            }`}
          >
            <input
              type="radio"
              name={props.name}
              value={o.value}
              checked={props.value === o.value}
              onChange={() => props.onChange(o.value)}
              className="size-5 shrink-0 accent-plum"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { FIELD };

export function Labeled({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-body-sm font-semibold">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={`${id}-note`} role="alert" className="mt-1 text-body-sm font-semibold text-seal">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-note`} className="mt-1 text-body-sm text-ink/75">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return <input {...props} aria-describedby={`${props.id}-note`} className={FIELD} />;
}

export function ConflictBox(props: {
  conflicts: Stale[];
  words: CalendarWords;
  busy: boolean;
  onKeep: () => void;
  onMine: () => void;
}) {
  const { words } = props;
  const box = useRef<HTMLDivElement>(null);
  // The box opens at the end of a long sheet: bring it into view.
  useEffect(() => box.current?.scrollIntoView({ block: "nearest" }), []);
  return (
    <div ref={box} role="alert" className="mt-4 border-l-4 border-yarn pl-3">
      <p className="font-semibold">{words["calendar.conflict.title"]}</p>
      {props.conflicts.map((c) => (
        <p key={c.field} className="mt-1 text-body-sm">
          {c.said} {c.yours}
        </p>
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onKeep}
          className={buttonClass("secondary")}
        >
          {words["calendar.conflict.keep"]}
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onMine}
          className={buttonClass("primary")}
        >
          {words["calendar.conflict.mine"]}
        </button>
      </div>
    </div>
  );
}
