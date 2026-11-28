"use client";

// /admin's feature switches (D126, D134), in each workspace's card: the switches by group, one tap each, each
// saying "Default (on)" or "Changed: off" with "Reset to default" when changed, and whether the alliance
// turned an allowed one off; the two daily caps with today's use; the tracker calls the alliance's choices
// spend; "Copy settings from" another workspace (asked first). Above the list, the global pause of each paid
// allowance (the "Defaults for new alliances" are FeatureDefaults.tsx). D162: the plan and its grandfather
// flag. Every press sends the PIN as x-edit-pin through `run`.
// A switch or cap saved counts as `admin_feature_changed` (issue 486).
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { copy } from "@/lib/copy";
import { fill } from "@/lib/words";
import {
  ALLOWANCES,
  FEATURE_GROUPS,
  SPENDS,
  type Allowance,
  type Feature,
  type FeatureGroup,
  type Plan,
  type PlanState,
} from "@/lib/workspace-features";

import { ConfirmSheet } from "./ConfirmSheet";
import { Field, FIELD, type Run } from "./WorkspaceForm";

const t = copy.admin.features;
const URL = "/api/admin/workspaces/features";
const saved = () => t.saved;
const GROUPS = Object.keys(FEATURE_GROUPS) as FeatureGroup[];

/** One workspace's switches as /admin shows them. */
export interface FeaturesView {
  /** Not allowed by the owner. */
  off: readonly string[];
  /** The owner's values that differ from the defaults (stored overrides). */
  changed: readonly string[];
  /** Allowed, but turned off by the alliance's officers (D134). */
  allianceOff: readonly string[];
  /** Left out by its plan (D162): counted as not allowed. */
  locked: readonly string[];
  plan: PlanState;
  /** "Plan: Free · grandfathered (keeps what it had)". */
  planLine: string;
  /** On now: allowed, turned on by the alliance, not paused. */
  on: number;
  caps: Record<Allowance, number | null>;
  /** Not allowed by this workspace's defaults: what Reset puts back. */
  defaultOff: readonly string[];
  defaultCaps: Record<Allowance, number | null>;
  changedCaps: readonly Allowance[];
  /** Today's (UTC) use of each allowance. */
  used: Record<Allowance, number>;
  /** "Tracker calls with the alliance's choices: about …" */
  estimate: string;
}

const capText = (cap: number | null) => (cap === null ? t.caps.none : String(cap));

function Switch(props: {
  id: number;
  feature: Feature;
  view: FeaturesView;
  paused: Allowance[];
  run: Run;
  busy: boolean;
}) {
  const { feature, view } = props;
  const on = !view.off.includes(feature);
  const changed = view.changed.includes(feature);
  const spends = SPENDS[feature];
  const state = fill(changed ? t.changed : t.byDefault, { value: on ? t.on : t.off });
  // Reset (null) puts back the workspace's default, which may equal the stored value (D134).
  const send = (value: boolean | null) =>
    props.run({
      url: URL,
      body: { action: "switch", workspace_id: props.id, feature, on: value },
      ok: () => {
        const after = value ?? !view.defaultOff.includes(feature);
        if (after !== on) track("admin_feature_changed", { feature, on: after });
        return saved();
      },
    });
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        aria-pressed={on}
        disabled={props.busy}
        className={chip(on)}
        onClick={() => send(!on)}
      >
        {`${t.names[feature]}: ${state}`}
      </button>
      {changed && (
        <button type="button" disabled={props.busy} className={chip()} onClick={() => send(null)}>
          {t.reset}
        </button>
      )}
      {on && view.locked.includes(feature) && (
        <span className="text-body-sm text-ink/80">{t.plan.locked}</span>
      )}
      {on && view.allianceOff.includes(feature) && (
        <span className="text-body-sm text-ink/80">{t.allianceOff}</span>
      )}
      {spends !== undefined && props.paused.includes(spends) && (
        <span className="text-body-sm text-seal">{t.pausedAll}</span>
      )}
    </li>
  );
}

/**
 * D162: the workspace's plan and its grandfathering, one tap each (On: everything for 3 months from now);
 * nothing is deleted either way.
 */
function PlanSwitch(props: { id: number; view: FeaturesView; run: Run; busy: boolean }) {
  const { plan, grandfathered } = props.view.plan;
  const send = (next: { plan: Plan; grandfathered?: boolean }) =>
    props.run({
      url: URL,
      body: { action: "plan", workspace_id: props.id, ...next },
      ok: saved,
    });
  const other: Plan = plan === "free" ? "premium" : "free";
  return (
    <fieldset className="mt-3">
      <legend className="text-body-sm font-semibold">{t.plan.head}</legend>
      <p className="text-body-sm text-ink/80">{t.plan.help}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={props.busy}
          className={chip()}
          onClick={() => send({ plan: other })}
        >
          {other === "premium" ? t.plan.setPremium : t.plan.setFree}
        </button>
        <button
          type="button"
          aria-pressed={grandfathered}
          disabled={props.busy}
          className={chip(grandfathered)}
          onClick={() => send({ plan, grandfathered: !grandfathered })}
        >
          {fill(t.plan.grandfather, { value: grandfathered ? t.on : t.off })}
        </button>
      </p>
    </fieldset>
  );
}

function Cap(props: {
  id: number;
  allowance: Allowance;
  view: FeaturesView;
  run: Run;
  busy: boolean;
}) {
  const { allowance, view } = props;
  const cap = view.caps[allowance];
  const used = view.used[allowance];
  const changed = view.changedCaps.includes(allowance);
  const send = (value: number | null | "default") =>
    props.run({
      url: URL,
      body: { action: "cap", workspace_id: props.id, allowance, cap: value },
      ok: () => {
        const after = value === "default" ? view.defaultCaps[allowance] : value;
        if (after !== cap) {
          track("admin_feature_changed", { feature: `${allowance}_cap`, on: after !== 0 });
        }
        return saved();
      },
    });
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("cap") ?? "").trim();
    send(value === "" ? null : Number(value));
  };
  return (
    <form onSubmit={save} className="grid gap-2 sm:max-w-xs">
      <Field label={t.caps[allowance]}>
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
        {fill(changed ? t.changed : t.byDefault, { value: capText(cap) })}
        {changed && ` · ${fill(t.caps.defaultIs, { value: capText(view.defaultCaps[allowance]) })}`}
        <br />
        {cap === null ? fill(t.caps.today, { used }) : fill(t.caps.todayOf, { used, cap })}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={props.busy} className={buttonClass("secondary")}>
          {t.caps.save}
        </button>
        {changed && (
          <button
            type="button"
            disabled={props.busy}
            className={buttonClass("secondary")}
            onClick={() => send("default")}
          >
            {t.reset}
          </button>
        )}
      </div>
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
  /** A press is on its way: the switches wait for it (D126). */
  busy: boolean;
}) {
  const { id, features: view } = props.w;
  const all = GROUPS.reduce((n, g) => n + FEATURE_GROUPS[g].length, 0);
  return (
    <details className="mt-2 border-t border-rule pt-1">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 font-semibold">
        <span>{fill(t.summary, { on: view.on, all })}</span>
        <span className="text-body-sm font-normal text-ink/80">
          {fill(t.usage, { ai: view.used.ai, translate: view.used.translate })}
        </span>
        <span className="basis-full text-body-sm font-normal">{view.estimate}</span>
      </summary>
      <p className="text-body-sm text-ink/80">{t.help}</p>
      <PlanSwitch id={id} view={view} run={props.run} busy={props.busy} />
      {GROUPS.map((group) => (
        <fieldset key={group} className="mt-3">
          <legend className="text-body-sm font-semibold">{t.groups[group]}</legend>
          {group === "data" && <p className="text-body-sm text-ink/80">{t.callsHelp}</p>}
          <ul className="mt-1 grid gap-2">
            {FEATURE_GROUPS[group].map((feature) => (
              <Switch
                key={feature}
                id={id}
                feature={feature}
                view={view}
                paused={props.paused}
                run={props.run}
                busy={props.busy}
              />
            ))}
          </ul>
        </fieldset>
      ))}
      <h4 className="mt-4 font-semibold">{t.caps.head}</h4>
      <p className="text-body-sm text-ink/80">{t.caps.help}</p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {ALLOWANCES.map((a) => (
          <Cap
            key={`${a}:${view.caps[a]}`}
            id={id}
            allowance={a}
            view={view}
            run={props.run}
            busy={props.busy}
          />
        ))}
      </div>
      {props.others.length > 0 && (
        <CopyFrom id={id} slug={props.w.slug} others={props.others} run={props.run} />
      )}
    </details>
  );
}

/** The owner's pause of each paid allowance, for every workspace at once. */
export function PausedSwitches({
  paused,
  run,
  busy,
}: {
  paused: Allowance[];
  run: Run;
  busy: boolean;
}) {
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
                disabled={busy}
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
