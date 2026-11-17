"use client";

// A number field with its unit inside it (DESIGN.md "Workspace components"): "19,8 M", "69,5 %". The unit
// sits right after what was typed, drawn over the field and hidden from screen readers (the line under
// the field says the full value); the field itself holds only what the officer typed.
import type { InputHTMLAttributes } from "react";

import { FIELD } from "@/lib/brand/components/controls";

export function SuffixInput({
  value,
  suffix,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "type"> & {
  value: string;
  /** The unit shown after the typed value; null shows none. */
  suffix: string | null;
}) {
  return (
    <span className={`relative block ${className}`}>
      <input
        {...rest}
        type="text"
        autoComplete="off"
        value={value}
        className={`${FIELD} tabular-nums`}
      />
      {suffix !== null && value !== "" && (
        // The field's own border and padding, so the unit lands one space after the typed text.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden border-[3px] border-transparent px-3 text-[16px] whitespace-pre tabular-nums"
        >
          <span className="invisible">{value}</span>
          <span className="text-ink/70">{` ${suffix}`}</span>
        </span>
      )}
    </span>
  );
}
