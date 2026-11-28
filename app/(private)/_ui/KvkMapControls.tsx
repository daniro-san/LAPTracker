"use client";

// The KvK map scene's controls (issue 817 part 2): Fit, +, −, Find (each 44 px), the layer chips and the
// filters behind Filters, and the tapped member's sheet with its facts and the member card's link. Find
// also moves the readout around the scene to its member. Nothing is hover-only; every word comes from the
// server.
import { useState, type Dispatch } from "react";

import { useReadoutGo } from "@/app/_ui/charts/Readout";
import { chip } from "@/lib/brand/components/controls";
import { Sheet, type SheetWords } from "@/lib/brand/components/Sheet";
import type { Ring } from "@/lib/private/kvk-map";

import {
  canZoomIn,
  findOf,
  type Layers,
  type Mark,
  type SceneAction,
  type SceneData,
  type SceneDot,
  type SceneState,
  type Shield,
} from "./kvk-map-view";

const BUTTON =
  "tint-button inline-flex min-h-11 min-w-11 items-center justify-center px-3 font-semibold disabled:opacity-40";

export interface SceneWords {
  fit: string;
  zoomIn: string;
  zoomOut: string;
  find: string;
  findLabel: string;
  findNone: string;
  /** "Map squares: X {x1} to {x2}, Y {y1} to {y2}." */
  axes: string;
  layers: Record<keyof Layers, string>;
  filters: string;
  bandHead: string;
  shieldHead: string;
  ringHead: string;
  bands: Record<Mark, string>;
  shields: Record<Shield, string>;
  rings: Record<Ring, string>;
  card: string;
  sheet: SheetWords;
}

export type Props = {
  data: SceneData;
  words: SceneWords;
  state: SceneState;
  dispatch: Dispatch<SceneAction>;
};

/** Find: a field and the members whose name holds what was typed, each a 44 px button. */
function Find({ data, words, dispatch }: Pick<Props, "data" | "words" | "dispatch">) {
  const [query, setQuery] = useState("");
  const found = findOf(data.dots, query);
  // The readout around the scene names the member Find picked, as a tap on its house does.
  const go = useReadoutGo();
  return (
    <div className="mt-2">
      <label className="block text-body-sm font-medium" htmlFor="kvk-map-find">
        {words.findLabel}
      </label>
      <input
        id="kvk-map-find"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-1 min-h-11 w-full border border-rule bg-paper px-3"
      />
      {query.trim() !== "" && found.length === 0 && (
        <p className="mt-1 text-body-sm">{words.findNone}</p>
      )}
      <div className="mt-1 flex flex-wrap gap-2">
        {found.map((i) => (
          <button
            key={i}
            type="button"
            className={chip()}
            onClick={() => {
              dispatch({ type: "find", i });
              go(i);
            }}
          >
            <bdi translate="no">{(data.dots[i] as SceneDot).name}</bdi>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Fit, +, −, Find: 44 px each. */
export function Controls({ data, words, state, dispatch }: Props) {
  const [finding, setFinding] = useState(false);
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={BUTTON}
          aria-pressed={state.view.level === "fit"}
          onClick={() => dispatch({ type: "fit" })}
        >
          {words.fit}
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-label={words.zoomIn}
          disabled={!canZoomIn(state.view)}
          onClick={() => dispatch({ type: "in" })}
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-label={words.zoomOut}
          disabled={state.view.level === "fit"}
          onClick={() => dispatch({ type: "out" })}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-expanded={finding}
          onClick={() => setFinding(!finding)}
        >
          {words.find}
        </button>
      </div>
      {finding && <Find data={data} words={words} dispatch={dispatch} />}
    </>
  );
}

/** The layer chips (shields, kills bands, names) and, behind Filters, the band, shield and ring filters. */
export function Chips({ data, words, state, dispatch }: Props) {
  const group = <T extends string>(
    head: string,
    type: "band" | "shield" | "ring",
    values: T[],
    label: Record<T, string>,
  ) => (
    <fieldset className="mt-2">
      <legend className="mb-1 text-body-sm font-semibold">{head}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const on = (state.filters[type] as string[]).includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              className={chip(on)}
              onClick={() => dispatch({ type, value: v } as SceneAction)}
            >
              {label[v]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["shields", "bands", "names"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={state.layers[key]}
            data-layer={key}
            className={chip(state.layers[key])}
            onClick={() => dispatch({ type: "layer", key })}
          >
            {words.layers[key]}
          </button>
        ))}
      </div>
      <details className="mt-2">
        <summary className="tint-button flex min-h-11 cursor-pointer items-center font-semibold text-plum">
          {words.filters}
        </summary>
        {group(words.bandHead, "band", ["more", "fewer", "none", "unknown"], words.bands)}
        {group(words.shieldHead, "shield", ["on", "not_seen", "unknown"], words.shields)}
        {data.rings.length > 0 &&
          group(words.ringHead, "ring", ["near", "mid", "far"], words.rings)}
      </details>
    </>
  );
}

/** The tapped member's sheet: their facts in words from the server and the link to their card. */
export function MemberSheet({ data, words, state, dispatch }: Props) {
  const d = state.selected === null ? undefined : data.dots[state.selected];
  if (!d) return null;
  return (
    <Sheet
      labelledBy="kvk-map-sheet"
      title={<bdi translate="no">{d.name}</bdi>}
      words={words.sheet}
      onCancel={() => dispatch({ type: "close" })}
    >
      <div className="ph-no-capture">
        <dl className="text-body-sm">
          {d.facts.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-3 border-t border-rule py-2 first:border-t-0"
            >
              <dt className="shrink-0 text-ink/80">{label}</dt>
              <dd className="text-right font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <a
          href={d.href}
          className="mt-2 inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
        >
          {words.card}
        </a>
      </div>
    </Sheet>
  );
}
