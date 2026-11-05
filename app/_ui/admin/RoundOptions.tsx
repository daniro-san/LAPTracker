"use client";

// The manual round's options (D28), one form for creating a round and for editing it on its card: the
// name, who can see it (three radio options, each with a line saying what it does) and the Discord
// post (a checkbox, off and explained while the round is admin only).
import { CheckField } from "@/lib/brand/components/CheckField";
import { RadioField } from "@/lib/brand/components/RadioField";
import { copy } from "@/lib/copy";

import type { RoundOptions as Options } from "./actions";

const m = copy.admin.manual;

const VISIBILITY = ["admin", "standalone", "history"] as const;

export function RoundOptions({
  idPrefix,
  value,
  onChange,
  disabled,
  nameDisabled = false,
}: {
  /** Keeps the ids unique when the create form and the card form are on the page together. */
  idPrefix: string;
  value: Options;
  onChange: (next: Options) => void;
  disabled: boolean;
  /** A round can be renamed only after its Before snapshot ran. */
  nameDisabled?: boolean;
}) {
  const adminOnly = value.visibility === "admin";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-name`} className="text-sm font-semibold">
          {m.nameLabel}
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          maxLength={80}
          autoComplete="off"
          value={value.name}
          disabled={disabled || nameDisabled}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="drawn-field min-h-11 px-3 disabled:opacity-60"
        />
        <p className="text-sm text-ink/70">{nameDisabled ? m.nameLater : m.nameHelp}</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{m.visibilityLabel}</legend>
        {VISIBILITY.map((v) => (
          <RadioField
            key={v}
            name={`${idPrefix}-visibility`}
            value={v}
            label={m.visibility[v]}
            help={m.visibilityHelp[v]}
            checked={value.visibility === v}
            disabled={disabled}
            onChange={() =>
              onChange({
                ...value,
                visibility: v,
                postPublic: v === "admin" ? false : value.postPublic,
              })
            }
          />
        ))}
      </fieldset>
      <CheckField
        label={m.postLabel}
        help={adminOnly ? m.postOff : m.postHelp}
        checked={value.postPublic}
        disabled={disabled || adminOnly}
        onChange={(e) => onChange({ ...value, postPublic: e.target.checked })}
      />
    </div>
  );
}
