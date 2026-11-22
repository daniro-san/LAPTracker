"use client";

// /admin's "Defaults for new alliances" (D134): one value per feature and per daily cap, above the
// workspaces. Every alliance but OGs follows them wherever its own card says "Default". Every press sends
// the PIN as x-edit-pin through the card's `run`.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { copy } from "@/lib/copy";
import { fill } from "@/lib/words";
import {
  ALLOWANCES,
  FEATURE_GROUPS,
  SPENDS,
  TRACKER_CALLS,
  type Allowance,
  type Feature,
  type FeatureGroup,
} from "@/lib/workspace-features";

import { ConfirmSheet } from "./ConfirmSheet";
import { Field, FIELD, type Run } from "./WorkspaceForm";

const t = copy.admin.features;
const URL = "/api/admin/workspaces/features";
const saved = () => t.saved;
const GROUPS = Object.keys(FEATURE_GROUPS) as FeatureGroup[];

/** One default cap: a number, or empty for no cap. */
function DefaultCap(props: { allowance: Allowance; cap: number | null; run: Run }) {
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("cap") ?? "").trim();
    props.run({
      url: URL,
      body: {
        action: "default_cap",
        allowance: props.allowance,
        cap: value === "" ? null : Number(value),
      },
      ok: saved,
    });
  };
  return (
    <form onSubmit={save} className="grid gap-2 sm:max-w-xs">
      <Field label={t.caps[props.allowance]}>
        <input
          name="cap"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="off"
          defaultValue={props.cap ?? ""}
          className={FIELD}
        />
      </Field>
      <button type="submit" className={buttonClass("secondary")}>
        {t.caps.save}
      </button>
    </form>
  );
}

/**
 * "Defaults for new alliances" (D134): one value per feature and per daily cap. Every alliance but OGs
 * follows it wherever its own card says "Default". Allowing a feature that spends tracker calls or a paid
 * allowance by default reaches every such alliance at once, so it is asked first.
 */
export function FeatureDefaults(props: {
  off: readonly string[];
  caps: Record<Allowance, number | null>;
  run: Run;
  busy: boolean;
}) {
  const [asking, setAsking] = useState<Feature | null>(null);
  const send = (feature: Feature, on: boolean) =>
    props.run({ url: URL, body: { action: "default_switch", feature, on }, ok: saved });
  const tap = (feature: Feature, on: boolean) => {
    if (on && (SPENDS[feature] || TRACKER_CALLS[feature])) setAsking(feature);
    else send(feature, on);
  };
  return (
    <details className="mb-4 border-b border-rule pb-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-subhead text-display-sm">
        {t.defaults.title}
      </summary>
      <p className="text-body-sm text-ink/80">{t.defaults.help}</p>
      {GROUPS.map((group) => (
        <fieldset key={group} className="mt-3">
          <legend className="text-body-sm font-semibold">{t.groups[group]}</legend>
          <ul className="mt-1 flex flex-wrap gap-2">
            {FEATURE_GROUPS[group].map((feature) => {
              const on = !props.off.includes(feature);
              return (
                <li key={feature}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={props.busy}
                    className={chip(on)}
                    onClick={() => tap(feature, !on)}
                  >
                    {`${t.names[feature]}: ${on ? t.on : t.off}`}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {ALLOWANCES.map((a) => (
          <DefaultCap
            key={`${a}:${props.caps[a]}`}
            allowance={a}
            cap={props.caps[a]}
            run={props.run}
          />
        ))}
      </div>
      {asking && (
        <ConfirmSheet
          text={fill(t.defaults.spendAsk, { name: t.names[asking] })}
          onAnswer={(yes) => {
            setAsking(null);
            if (yes) send(asking, true);
          }}
        />
      )}
    </details>
  );
}
