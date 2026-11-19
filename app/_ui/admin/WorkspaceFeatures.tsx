"use client";

// /admin's feature switches (D126), in each workspace's card: the switches by group, one tap each; the two
// daily caps with today's use; "Copy settings from" another workspace (asked first). Above the list, the
// global pause of each paid allowance. Every press sends the PIN as x-edit-pin through the card's `run`.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { copy, fill } from "@/lib/copy";
import {
  ALLOWANCES,
  FEATURE_GROUPS,
  FEATURES,
  SPENDS,
  type Allowance,
  type FeatureGroup,
} from "@/lib/workspace-features";

import { ConfirmSheet } from "./ConfirmSheet";
import { Field, FIELD, type Run } from "./WorkspaceForm";

const t = copy.admin.features;
const URL = "/api/admin/workspaces/features";
const saved = () => t.saved;

/** One workspace's switches as /admin shows them. */
export interface FeaturesView {
  off: readonly string[];
  caps: Record<Allowance, number | null>;
  /** Today's (UTC) use of each allowance. */
  used: Record<Allowance, number>;
}

function Group(props: {
  id: number;
  group: FeatureGroup;
  view: FeaturesView;
  paused: Allowance[];
  run: Run;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="text-body-sm font-semibold">{t.groups[props.group]}</legend>
      <ul className="mt-1 flex flex-wrap gap-2">
        {FEATURE_GROUPS[props.group].map((feature) => {
          const on = !props.view.off.includes(feature);
          const spends = SPENDS[feature];
          const paused = spends !== undefined && props.paused.includes(spends);
          return (
            <li key={feature}>
              <button
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() =>
                  props.run({
                    url: URL,
                    body: { action: "switch", workspace_id: props.id, feature, on: !on },
                    ok: saved,
                  })
                }
              >
                {`${t.names[feature]}: ${on ? t.on : t.off}`}
              </button>
              {paused && <span className="block text-body-sm text-seal">{t.pausedAll}</span>}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function Cap(props: { id: number; allowance: Allowance; view: FeaturesView; run: Run }) {
  const cap = props.view.caps[props.allowance];
  const used = props.view.used[props.allowance];
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("cap") ?? "").trim();
    props.run({
      url: URL,
      body: {
        action: "cap",
        workspace_id: props.id,
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
          defaultValue={cap ?? ""}
          className={FIELD}
        />
      </Field>
      <p className="text-body-sm text-ink/80">
        {cap === null ? fill(t.caps.today, { used }) : fill(t.caps.todayOf, { used, cap })}
      </p>
      <button type="submit" className={buttonClass("secondary")}>
        {t.caps.save}
      </button>
    </form>
  );
}

function CopyFrom(props: {
  id: number;
  slug: string;
  others: { id: number; slug: string }[];
  run: Run;
}) {
  const [from, setFrom] = useState(props.others[0]?.id ?? 0);
  const [asking, setAsking] = useState(false);
  const source = props.others.find((o) => o.id === from);
  if (!source) return null;
  return (
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <Field label={t.copy.label}>
        <select value={from} onChange={(e) => setFrom(Number(e.target.value))} className={FIELD}>
          {props.others.map((o) => (
            <option key={o.id} value={o.id}>
              /w/{o.slug}
            </option>
          ))}
        </select>
      </Field>
      <button type="button" onClick={() => setAsking(true)} className={buttonClass("secondary")}>
        {t.copy.button}
      </button>
      {asking && (
        <ConfirmSheet
          text={fill(t.copy.ask, { slug: props.slug, from: source.slug })}
          onAnswer={(yes) => {
            setAsking(false);
            if (yes) {
              props.run({
                url: URL,
                body: { action: "copy", workspace_id: props.id, from_id: from },
                ok: () => t.copied,
              });
            }
          }}
        />
      )}
    </div>
  );
}

export function WorkspaceFeatures(props: {
  w: { id: number; slug: string; features: FeaturesView };
  others: { id: number; slug: string }[];
  paused: Allowance[];
  run: Run;
}) {
  const { id, features: view } = props.w;
  const on = FEATURES.filter((f) => !view.off.includes(f)).length;
  return (
    <details className="mt-2 border-t border-rule pt-1">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 font-semibold">
        <span>{fill(t.summary, { on, all: FEATURES.length })}</span>
        <span className="text-body-sm font-normal text-ink/80">
          {fill(t.usage, { ai: view.used.ai, translate: view.used.translate })}
        </span>
      </summary>
      <p className="text-body-sm text-ink/80">{t.help}</p>
      {(Object.keys(FEATURE_GROUPS) as FeatureGroup[]).map((group) => (
        <Group
          key={group}
          id={id}
          group={group}
          view={view}
          paused={props.paused}
          run={props.run}
        />
      ))}
      <h4 className="mt-4 font-semibold">{t.caps.head}</h4>
      <p className="text-body-sm text-ink/80">{t.caps.help}</p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {ALLOWANCES.map((a) => (
          <Cap key={a} id={id} allowance={a} view={view} run={props.run} />
        ))}
      </div>
      {props.others.length > 0 && (
        <CopyFrom id={id} slug={props.w.slug} others={props.others} run={props.run} />
      )}
    </details>
  );
}

/** The owner's pause of each paid allowance, for every workspace at once. */
export function PausedSwitches({ paused, run }: { paused: Allowance[]; run: Run }) {
  return (
    <section aria-labelledby="paused-head" className="mb-4 border-b border-rule pb-4">
      <h3 id="paused-head" className="font-subhead text-display-sm">
        {t.pause.title}
      </h3>
      <p className="text-body-sm text-ink/80">{t.pause.help}</p>
      <ul className="mt-2 grid gap-2">
        {ALLOWANCES.map((allowance) => {
          const isPaused = paused.includes(allowance);
          return (
            <li key={allowance} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1">
                {t.pause[allowance]}:{" "}
                <strong className={isPaused ? "text-seal" : ""}>
                  {isPaused ? t.pause.paused : t.pause.running}
                </strong>
              </span>
              <button
                type="button"
                className={buttonClass("secondary")}
                onClick={() =>
                  run({
                    url: URL,
                    body: { action: "pause", allowance, paused: !isPaused },
                    ok: saved,
                  })
                }
              >
                {isPaused ? t.pause.resume : t.pause.pause}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
