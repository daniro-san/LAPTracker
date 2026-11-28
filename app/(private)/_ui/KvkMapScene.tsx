"use client";

// The officers' KvK map's scene (issue 817 part 2): D68's small client part, with every number and word
// computed on the server (kvk-map-view.ts holds the steps). Two zoom levels: the fit level shows everything,
// the own members as small dots with near/mid/far counts round the castle point (or their count without
// one) and each other tracked alliance as a muted "TAG · n" at its members' centre, never a name of theirs;
// the city level shows each own member's house with its name, shield ring and (a layer chip) kills band.
// Fit, +, −, Find and the chips are 44 px buttons; a drag pans the city level; nothing is hover-only. Only
// the houses inside the visible box are drawn. A tap on a house or its name opens its sheet (and the
// readout around the scene names it); Find does too. The plot is aria-hidden (the readout, the "Who"
// lists and the sheet say the same) and, with the sheet, inside ph-no-capture.
import { useReducer, useRef, type PointerEvent } from "react";

import {
  CastleGlyph,
  HouseGlyph,
  NoReadingRing,
  ShieldBubble,
} from "@/lib/brand/components/MapGlyphs";
import { fill } from "@/lib/words";

import {
  CASTLE,
  HOUSE,
  RING,
  START,
  alongAxis,
  axisOf,
  edgesOf,
  frameIn,
  labelsOf,
  passes,
  project,
  sceneStep,
  visibleOf,
  type Axis,
  type Box,
  type Mark,
  type Point,
  type SceneAction,
  type SceneData,
  type SceneDot,
  type SceneState,
  type Shield,
} from "./kvk-map-view";
import { Chips, Controls, MemberSheet, type Props, type SceneWords } from "./KvkMapControls";

export type { SceneWords };

/** A house's tap target, in plot units: 15.5 of 100 is 45 px on the 293 px plot at 360 px, more when wider. */
const HIT = 15.5;
/** A drag starts past this many pixels; a shorter move is a tap. */
const SLOP = 6;
const HALO =
  "[text-shadow:0_0_2px_var(--color-paper),0_0_2px_var(--color-paper),0_0_3px_var(--color-paper)]";

/** The kills band's mark at a house's corner (the layer chip): plum and larger for more, hollow for none. */
function BandMark({ band, cx, cy }: { band: Mark; cx: number; cy: number }) {
  const [x, y] = [cx + HOUSE / 2, cy - HOUSE / 2];
  if (band === "none")
    return <circle cx={x} cy={y} r={1.3} className="fill-paper stroke-ink" strokeWidth={0.5} />;
  if (band === "fewer") return <circle cx={x} cy={y} r={1.2} className="fill-ink/60" />;
  if (band === "more") return <circle cx={x} cy={y} r={1.8} className="fill-plum" />;
  return <circle cx={x} cy={y} r={0.8} className="fill-ink/30" />;
}

/** A member's house at (cx, cy) with its shield ring: drawn when seen, dashed with no reading (D75). */
export function Member({ shield, cx, cy }: { shield: Shield; cx: number; cy: number }) {
  return (
    <>
      {shield === "on" && <ShieldBubble cx={cx} cy={cy} size={RING} className="text-plum" />}
      {shield === "unknown" && (
        <NoReadingRing cx={cx} cy={cy} size={RING} className="text-ink/60" />
      )}
      <HouseGlyph cx={cx} cy={cy} size={HOUSE} className="text-ink" />
    </>
  );
}

/** A label in HTML over the plot (D68), centred on (cx, cy) in plot units, kept inside the plot. */
function Tag({ at, className, children }: { at: Point; className: string; children: string }) {
  const left = Math.min(92, Math.max(8, at.cx));
  const top = Math.min(95, Math.max(2, at.cy));
  return (
    <span
      className={`absolute -translate-x-1/2 text-xs whitespace-nowrap ${HALO} ${className}`}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <bdi translate="no">{children}</bdi>
    </span>
  );
}

/** Near, mid and far counts stacked in one block beside the far ring (left of it when the castle sits right
 * of centre), so they never sit on one another however small the rings are drawn. */
function RingCounts(props: { rings: SceneData["rings"]; castle: Point; reach: number }) {
  const { castle, reach } = props;
  const right = castle.cx <= 50;
  const x = right ? castle.cx + reach + 2 : castle.cx - reach - 2;
  const style = {
    top: `${Math.min(80, Math.max(2, castle.cy - 7))}%`,
    ...(right ? { left: `${Math.min(70, x)}%` } : { right: `${Math.min(70, 100 - x)}%` }),
  };
  return (
    <span
      className={`absolute flex flex-col text-xs leading-tight font-semibold whitespace-nowrap text-plum ${right ? "" : "items-end"} ${HALO}`}
      style={style}
    >
      {props.rings.map((r) => (
        <span key={r.ring}>{r.label}</span>
      ))}
    </span>
  );
}

/** The fit level: the own members as dots, the rings' counts round the castle (or the members' count), the
 * other alliances' clusters. Nothing here is a tap target. */
function FitLevel({ data, state }: Pick<Props, "data" | "state">) {
  const f = frameIn(state.view, data);
  const at = project(f);
  const castle = data.castle ? at(data.castle.x, data.castle.y) : null;
  const shown = data.dots.filter((d) => passes(d, state.filters));
  const own = data.dots.length > 0 && {
    cx: data.dots.reduce((a, d) => a + at(d.x, d.y).cx, 0) / data.dots.length,
    cy: data.dots.reduce((a, d) => a + at(d.x, d.y).cy, 0) / data.dots.length,
  };
  const k = 100 / f.span;
  return (
    <>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        {data.clusters.map((c, i) => (
          <circle
            key={i}
            {...at(c.x, c.y)}
            r={3.2}
            className="fill-ink/15 stroke-ink/40"
            strokeWidth={0.4}
          />
        ))}
        {castle &&
          data.rings.map((r) => (
            <circle
              key={r.ring}
              {...castle}
              r={r.radius * k}
              className="fill-none stroke-plum/50"
              strokeWidth={0.4}
              strokeDasharray="1.5 1.5"
            />
          ))}
        {shown.map((d, i) => (
          <circle key={i} {...at(d.x, d.y)} r={1.1} data-fit-dot="" className="fill-ink/70" />
        ))}
        {castle && <CastleGlyph {...castle} size={CASTLE * 0.6} className="text-ink" />}
      </svg>
      {data.clusters.map((c, i) => {
        const p = at(c.x, c.y);
        return (
          <Tag key={i} at={{ cx: p.cx, cy: p.cy + 3.5 }} className="text-ink/70">
            {c.label}
          </Tag>
        );
      })}
      {castle
        ? data.rings.length > 0 && (
            <RingCounts
              rings={data.rings}
              castle={castle}
              reach={(data.rings.at(-1)?.radius ?? 0) * k}
            />
          )
        : own && (
            <Tag at={{ cx: own.cx, cy: own.cy + 3 }} className="font-semibold text-plum">
              {data.ownLabel}
            </Tag>
          )}
    </>
  );
}

/** The city level: the houses inside the visible box that pass the filters, each with its name. */
function CityLevel({ data, state }: Pick<Props, "data" | "state">) {
  const f = frameIn(state.view, data);
  const at = project(f);
  const castle = data.castle ? at(data.castle.x, data.castle.y) : null;
  const shown = visibleOf(data.dots, f).filter((i) =>
    passes(data.dots[i] as SceneDot, state.filters),
  );
  const points = shown.map((i) => at((data.dots[i] as SceneDot).x, (data.dots[i] as SceneDot).y));
  const labels = labelsOf(
    shown.map((i) => data.dots[i] as { name: string }),
    points,
    castle,
  );
  const { layers } = state;
  return (
    <>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        {data.clusters.map((c, i) => (
          <circle
            key={i}
            {...at(c.x, c.y)}
            r={3.2}
            className="fill-ink/15 stroke-ink/40"
            strokeWidth={0.4}
          />
        ))}
        {shown.map((i, n) => {
          const d = data.dots[i] as SceneDot;
          const p = points[n] as Point;
          return (
            <g key={i} data-at={i} data-glyph={d.shield} className="group/dot cursor-pointer">
              <Member shield={layers.shields ? d.shield : "not_seen"} {...p} />
              {layers.bands && <BandMark band={d.band} {...p} />}
              {state.selected === i && (
                <circle
                  {...p}
                  r={RING / 2 + 0.6}
                  className="fill-none stroke-seal"
                  strokeWidth={0.6}
                />
              )}
              {/* A transparent target of at least 44 px round the house, so a finger finds it. */}
              <circle {...p} r={HIT / 2} className="fill-transparent" />
            </g>
          );
        })}
        {/* The castle above the rings, so a member's ring never hides it; taps go through to the houses. */}
        {castle && (
          <CastleGlyph {...castle} size={CASTLE} className="pointer-events-none text-ink" />
        )}
      </svg>
      {layers.names &&
        shown.map((i, n) => {
          const box = labels[n] as Box;
          return (
            <span
              key={i}
              data-at={i}
              className={`absolute cursor-pointer px-0.5 text-center ${HALO} text-xs leading-tight before:absolute before:top-1/2 before:left-1/2 before:size-full before:min-h-11 before:min-w-11 before:-translate-1/2 before:content-[''] aria-[current=true]:font-semibold`}
              style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%` }}
            >
              <bdi translate="no" className="block truncate">
                {(data.dots[i] as SceneDot).name}
              </bdi>
            </span>
          );
        })}
    </>
  );
}

/** A drag over the plot: the pointers down, the axis once past the slop (undefined before), and whether
 * it panned (then its click is not a tap). */
type Drag = { at: Map<number, { x: number; y: number }>; axis: Axis | undefined; moved: boolean };

/** The city level's drag (axisOf's rules); a pointer the browser takes for scrolling is cancelled. */
function useDrag(city: boolean, dispatch: Props["dispatch"]) {
  const drag = useRef<Drag | null>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const last = d?.at.get(e.pointerId);
    if (!d || !last || d.axis === null) return;
    const [dx, dy] = [e.clientX - last.x, e.clientY - last.y];
    if (d.axis === undefined) {
      if (Math.hypot(dx, dy) < SLOP) return;
      d.axis = axisOf(e.pointerType, d.at.size, dx, dy);
      if (d.axis === null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    d.moved = true;
    d.at.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Two fingers move the box by their mean: each finger's move counts for half.
    const k = 100 / ((e.currentTarget.clientWidth || 1) * d.at.size);
    dispatch({ type: "pan", ...alongAxis(d.axis, dx * k, dy * k) });
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!city) return;
    // A new gesture, or a second finger joining one before it panned: the axis is decided again.
    if (!drag.current || drag.current.at.size === 0)
      drag.current = { at: new Map(), axis: undefined, moved: false };
    else if (!drag.current.moved) drag.current.axis = undefined;
    drag.current.at.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    drag.current?.at.delete(e.pointerId);
    if (drag.current && !drag.current.moved && drag.current.at.size === 0) drag.current = null;
  };
  return { drag, move, down, up };
}

/** The plot: a drag pans the city level (and is not a tap); a tap on a house or a name opens its sheet.
 * touch-action: pan-y leaves a vertical swipe to the page, so a phone never gets stuck on the map. */
function Plot({ data, state, dispatch }: Omit<Props, "words">) {
  const city = state.view.level === "city";
  const { drag, move, down, up } = useDrag(city, dispatch);
  return (
    <div
      aria-hidden="true"
      data-level={state.view.level}
      className={`relative mt-2 aspect-square w-full max-w-md touch-pan-y overflow-hidden border border-rule select-none ${city ? "cursor-grab" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        // The click that ends a drag is not a tap: neither the sheet nor the readout picks it up.
        if (drag.current?.moved) e.stopPropagation();
        drag.current = null;
      }}
      onClick={(e) => {
        const at = (e.target as Element).closest<HTMLElement | SVGElement>("[data-at]");
        if (at) dispatch({ type: "pick", i: Number(at.dataset.at) });
      }}
    >
      {city ? <CityLevel data={data} state={state} /> : <FitLevel data={data} state={state} />}
    </div>
  );
}

/** The scene for a given state: what the client component draws, and what tests render. */
export function SceneView(props: Props) {
  const f = frameIn(props.state.view, props.data);
  return (
    <>
      <Controls {...props} />
      <Chips {...props} />
      <Plot data={props.data} state={props.state} dispatch={props.dispatch} />
      <p className="mt-1 text-body-sm text-ink/80 tabular-nums">
        {fill(props.words.axes, edgesOf(f))}
      </p>
      <MemberSheet {...props} />
    </>
  );
}

export function KvkMapScene({ data, words }: { data: SceneData; words: SceneWords }) {
  const [state, dispatch] = useReducer(
    (s: SceneState, a: SceneAction) => sceneStep(data, s, a),
    START,
  );
  return <SceneView data={data} words={words} state={state} dispatch={dispatch} />;
}
