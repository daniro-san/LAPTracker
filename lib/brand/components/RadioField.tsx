// One option of an exclusive choice (DESIGN.md `radio-field`): a soft drawn frame around a native radio
// (plum accent), its label and a one-line help. The chosen option is tinted plum, so a hovered row never
// reads as a second choice. Use inside a <fieldset> with a <legend>; give every
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
    <label
      className={`drawn-frame-soft tint-button flex min-h-11 gap-3 px-3 py-2 has-[:checked]:bg-plum/10 ${help ? "items-start" : "items-center"}`}
    >
      {/* Centred on a one-line label; beside the label's first line when a help line follows. */}
      <input
        type="radio"
        className={`size-6 shrink-0 accent-plum ${help ? "mt-0.5" : ""}`}
        {...input}
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {help && <span className="text-sm text-ink/70">{help}</span>}
      </span>
    </label>
  );
}
