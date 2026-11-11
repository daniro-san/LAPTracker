// Labelled checkbox (DESIGN.md `check-field`): the framed `.drawn-check` box, a label and an optional
// one-line help saying what ticking it changes. `row` is the form line (≥ 44 px); `chip` is the compact
// framed toggle beside a page title ("Exact numbers", "My alliance"). Extra props go to the <input>.
import type { InputHTMLAttributes, ReactNode } from "react";

export type CheckFieldVariant = "row" | "chip";

export function CheckField({
  label,
  help,
  variant = "row",
  ...input
}: {
  label: ReactNode;
  /** One short line under the label (row only). */
  help?: ReactNode;
  variant?: CheckFieldVariant;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  if (variant === "chip") {
    return (
      <label className="drawn-frame-soft tint-button inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-body-sm font-medium text-plum">
        <input type="checkbox" className="drawn-check size-[18px]" {...input} />
        {label}
      </label>
    );
  }
  return (
    <label className="flex min-h-11 items-start gap-3 aria-disabled:opacity-60">
      <input type="checkbox" className="drawn-check mt-1 size-[22px]" {...input} />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {help && <span className="text-sm text-ink/70">{help}</span>}
      </span>
    </label>
  );
}
