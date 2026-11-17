"use client";

// A 24-hour time field (DESIGN.md "Workspace components"): a text field, not type="time", which an
// English iPhone shows as "04:39 AM". It opens the digit keypad, and the colon goes in by itself as the
// officer types (typedTime): "2100" reads "21:00".
import type { InputHTMLAttributes } from "react";

import { FIELD } from "@/lib/brand/components/controls";
import { typedTime } from "@/lib/private/calendar-time";

export function TimeInput({
  value,
  onChange,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (time: string) => void;
}) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="21:00"
      maxLength={5}
      value={value}
      onChange={(e) => onChange(typedTime(e.target.value))}
      className={`${FIELD} tabular-nums ${className}`}
    />
  );
}
