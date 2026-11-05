// One option of an exclusive choice (DESIGN.md `radio-field`): a soft drawn frame around a native radio
// (plum accent), its label and a one-line help. Use inside a <fieldset> with a <legend>; give every
// option the same `name`. ≥ 44 px tall, the whole frame is the tap target.
import type { InputHTMLAttributes, ReactNode } from "react";

export function RadioField({
  label,
  help,
  ...input
}: {
  label: ReactNode;
  help?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label className="drawn-frame-soft flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2">
      <input type="radio" className="mt-0.5 size-6 shrink-0 accent-plum" {...input} />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {help && <span className="text-sm text-ink/70">{help}</span>}
      </span>
    </label>
  );
}
