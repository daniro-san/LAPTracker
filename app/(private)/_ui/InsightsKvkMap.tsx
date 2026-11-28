// Insights → KvK's map (issues 791, 817), server-rendered: the own alliance's members where the newest KvK's
// End reading saw them, as a hand-built inline SVG scene (D68, D158): one drawn house a member with its name
// in HTML under it, the castle drawn at the officers' castle point, a light ring round a member whose newest
// shield reading before that KvK saw a shield and a dashed ring when there is none (D75); the legend and the
// readout say "no reading", and each name on the map is the name only, on a paper-coloured halo.
// A tap on a house or a name, or the 44 px ‹ › steps in name order, names its member in the readout under the
// plot, with its kills band and shield (D158 rule 7 (a), D163). The plot and its names are aria-hidden (the
// readout and the "Who" lists say the same); the plot, the readout and the names are ph-no-capture. Both
// axes use one scale, so distances look as they are; the plot spans the members (and the castle point) with
// the squares written under it. The near/mid/far table shows only once officers typed a castle point, each
// row with its members' names behind a tap. Nothing here says why a member gained kills.
import type { ReactNode } from "react";

import { Readout } from "@/app/_ui/charts/Readout";
import {
  CastleGlyph,
  HouseGlyph,
  NoReadingRing,
  ShieldBubble,
} from "@/lib/brand/components/MapGlyphs";
import { getEnv } from "@/lib/env";
import { clockIn, dayIn } from "@/lib/private/calendar-time";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { compact, whole } from "@/lib/private/insights-format";
import type { KillBand, KvkMap, KvkMapDot } from "@/lib/private/kvk-map";
import { fill, plural } from "@/lib/words";

import { Card } from "./InsightsBars";
import { Caret } from "./InsightsSets";
import { KvkCastleForm } from "./KvkCastleForm";

const MAP_CARD = "insights-kvk-map";
/** The plot's inner margin, in viewBox units of 100: room for a name beside a house at the edge. */
const PAD = 12;
/** The smallest span drawn, in map squares, so a tight cluster is not blown up past what it is. */
const MIN_SPAN = 20;
/** Glyph sizes in plot units (of 100): a house, its shield ring, the castle. */
const HOUSE = 5.6;
const RING = 11.2;
const CASTLE = 17.5;
/** A name label's room in plot units at 360 px (12 px text): one line's height, one letter's width, the cap. */
const LINE = 5.2;
const LETTER = 2.6;
const NAME_MAX = 30;
/** A house's tap target, in plot units: 15.5 of 100 is 45 px on the 293 px plot at 360 px, more when wider. */
const HIT = 15.5;

export type Point = { cx: number; cy: number };
export type Box = { x: number; y: number; w: number; h: number };

const dist = (a: Point, b: Point) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The box no name may cover around the castle: the drawing and 1 plot unit round it. */
export function keepOutOf(castle: Point): Box {
  const clear = CASTLE / 2 + 1;
  return { x: castle.cx - clear, y: castle.cy - clear, w: 2 * clear, h: 2 * clear };
}

/**
 * Where each member's name goes, in plot units, nearest the castle first: of under, above, right, left and
 * the four corners of its house, the first spot inside the plot that covers neither the castle nor another
 * name nor another house's ring. When none is free, the spot that covers the fewest names, then rings; never
 * the castle when any spot avoids it.
 */
export function labelsOf(dots: KvkMapDot[], points: Point[], castle: Point | null): Box[] {
  const r = RING / 2;
  const keep = castle ? [keepOutOf(castle)] : [];
  const rings = points.map((p) => ({ x: p.cx - r, y: p.cy - r, w: RING, h: RING }));
  const names: Box[] = [];
  const count = (b: Box, of: Box[]) => of.filter((o) => overlaps(b, o)).length;
  // Nearest the castle first: those names have the fewest free spots.
  const from = castle ?? { cx: 50, cy: 50 };
  const order = dots
    .map((_, i) => i)
    .sort((a, b) => dist(points[a] as Point, from) - dist(points[b] as Point, from));
  const placed: Box[] = [];
  for (const i of order) {
    const d = dots[i] as KvkMapDot;
    const { cx, cy } = points[i] as Point;
    const h = LINE;
    const w = Math.min(NAME_MAX, d.name.length * LETTER + 2);
    const tries: Box[] = [
      { x: cx - w / 2, y: cy + r, w, h },
      { x: cx - w / 2, y: cy - r - h, w, h },
      { x: cx + r, y: cy - h / 2, w, h },
      { x: cx - r - w, y: cy - h / 2, w, h },
      { x: cx + r * 0.7, y: cy + r * 0.7, w, h },
      { x: cx - r * 0.7 - w, y: cy + r * 0.7, w, h },
      { x: cx + r * 0.7, y: cy - r * 0.7 - h, w, h },
      { x: cx - r * 0.7 - w, y: cy - r * 0.7 - h, w, h },
    ];
    const outside = (b: Box) => b.x < 0 || b.y < 0 || b.x + b.w > 100 || b.y + b.h > 100;
    const cost = (b: Box) =>
      (outside(b) ? 1000 : 0) + 100 * count(b, keep) + 10 * count(b, names) + count(b, rings);
    const box = tries.reduce((best, b) => (cost(b) < cost(best) ? b : best));
    names.push(box);
    placed[i] = box;
  }
  return placed;
}

type Mark = KillBand | "unknown";
type Shield = KvkMapDot["shield"];

/** A member's house at (cx, cy) with its shield ring: drawn when seen, dashed with no reading (D75). */
function Member({ shield, cx, cy }: { shield: Shield; cx: number; cy: number }) {
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

/** A legend swatch: the mark drawn on its own, 16 px. */
function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="-6 -6 12 12" aria-hidden="true" className="size-4 shrink-0">
      {children}
    </svg>
  );
}

/** The square box every dot and the castle point fit in, on one scale for both axes. */
function frameOf(map: KvkMap) {
  const xs = [...map.dots.map((d) => d.x), ...(map.castle ? [map.castle.x] : [])];
  const ys = [...map.dots.map((d) => d.y), ...(map.castle ? [map.castle.y] : [])];
  const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(x2 - x1, y2 - y1, MIN_SPAN);
  const [cx, cy] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const k = (100 - 2 * PAD) / span;
  // Y grows upward, as on the game's map.
  const at = (x: number, y: number) => ({
    cx: PAD + (x - cx + span / 2) * k,
    cy: 100 - PAD - (y - cy + span / 2) * k,
  });
  // The plot's edges in map squares, as the words under it name them.
  const edge = (c: number, side: number) => Math.round(c + side * (span / 2 + PAD / k));
  return { at, x1: edge(cx, -1), x2: edge(cx, 1), y1: edge(cy, -1), y2: edge(cy, 1) };
}

/** Each mark's words, as the legend and the readout write them. */
function markWords(map: KvkMap, t: WorkspaceDictionary, language: string): Record<Mark, string> {
  const median = compact(map.median ?? 0, language);
  return {
    more: fill(t["insights.map.legend.more"], { median }),
    fewer: fill(t["insights.map.legend.fewer"], { median }),
    none: t["insights.map.legend.none"],
    unknown: t["insights.map.legend.unknown"],
  };
}

/**
 * The scene: houses, rings and the castle in the SVG, each member's name in HTML under its house (D68). A
 * house and its name carry `data-at` (its index in name order), the tap target the readout picks up.
 */
function Plot({ map }: { map: KvkMap }) {
  const { at } = frameOf(map);
  const castle = map.castle ? at(map.castle.x, map.castle.y) : null;
  const points = map.dots.map((d) => at(d.x, d.y));
  const labels = labelsOf(map.dots, points, castle);
  return (
    <div
      aria-hidden="true"
      className="relative mt-2 aspect-square w-full max-w-md overflow-hidden border border-rule"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        {map.dots.map((d, i) => {
          const p = at(d.x, d.y);
          return (
            <g key={i} data-at={i} data-glyph={d.shield} className="group/dot cursor-pointer">
              <Member shield={d.shield} {...p} />
              <circle
                {...p}
                r={RING / 2 + 0.6}
                className="fill-none stroke-seal opacity-0 group-aria-[current=true]/dot:opacity-100"
                strokeWidth={0.6}
              />
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
      {map.dots.map((d, i) => {
        const box = labels[i] as Box;
        return (
          <span
            key={i}
            data-at={i}
            className="absolute cursor-pointer px-0.5 text-center [text-shadow:0_0_2px_var(--color-paper),0_0_2px_var(--color-paper),0_0_3px_var(--color-paper)] text-xs leading-tight before:absolute before:top-1/2 before:left-1/2 before:size-full before:min-h-11 before:min-w-11 before:-translate-1/2 before:content-[''] aria-[current=true]:font-semibold"
            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%` }}
          >
            {/* The name truncates inside; the label itself does not clip, so its 44 px target (::before) stays. */}
            <bdi translate="no" className="block truncate">
              {d.name}
            </bdi>
          </span>
        );
      })}
    </div>
  );
}

function Legend({ map, t, language }: { map: KvkMap; t: WorkspaceDictionary; language: string }) {
  const count = (mark: Mark) => map.dots.filter((d) => (d.band ?? "unknown") === mark).length;
  const shields = (s: Shield) => map.dots.filter((d) => d.shield === s).length;
  const words = markWords(map, t, language);
  const scene = [
    ["on", t["insights.map.legend.shield"]],
    ["not_seen", t["insights.map.legend.notSeen"]],
    ["unknown", t["insights.map.legend.noReading"]],
  ] as const;
  const bands = (["more", "fewer", "none", "unknown"] as const).map((m) => [m, words[m]] as const);
  const row = "flex min-h-6 items-center gap-2 border-t border-rule py-1";
  return (
    <ul className="mt-2 text-body-sm">
      {scene.map(
        ([shield, label]) =>
          shields(shield) > 0 && (
            <li key={shield} className={row}>
              <Swatch>
                <Member shield={shield} cx={0} cy={0} />
              </Swatch>
              <span className="min-w-0 flex-1">{label}</span>
              <span className="font-semibold tabular-nums">{whole(shields(shield), language)}</span>
            </li>
          ),
      )}
      {bands.map(
        ([mark, label]) =>
          count(mark) > 0 && (
            <li key={mark} className={row}>
              <span className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">{label}</span>
              <span className="font-semibold tabular-nums">{whole(count(mark), language)}</span>
            </li>
          ),
      )}
      {map.castle && (
        <li className={row}>
          <Swatch>
            <CastleGlyph cx={0} cy={0} size={11} className="text-ink" />
          </Swatch>
          <span>{fill(t["insights.map.legend.castle"], { ...map.castle })}</span>
        </li>
      )}
    </ul>
  );
}

function Bands({ map, t, language }: { map: KvkMap; t: WorkspaceDictionary; language: string }) {
  if (!map.castle) return <p className="mt-2 text-body-sm">{t["insights.map.bands.empty"]}</p>;
  if (!map.bands) return <p className="mt-2 text-body-sm">{t["insights.map.bands.few"]}</p>;
  return (
    <div className="mt-3">
      <h3 className="font-semibold">{t["insights.map.bands.head"]}</h3>
      <table className="ph-no-capture mt-1 w-full text-body-sm">
        <thead>
          <tr className="text-left">
            <th scope="col" className="py-1 font-medium">
              {t["insights.map.bands.distance"]}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {t["insights.map.bands.members"]}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {t["insights.map.bands.kills"]}
            </th>
          </tr>
        </thead>
        {map.bands.map((b) => (
          <tbody key={b.band}>
            <tr className="border-t border-rule">
              <th scope="row" className="py-1.5 text-left font-normal">
                <span className="block font-semibold">{t[`insights.map.bands.${b.band}`]}</span>
                <span className="tabular-nums">
                  {fill(t["insights.map.bands.range"], {
                    from: whole(b.from, language),
                    to: whole(b.to, language),
                  })}
                </span>
              </th>
              <td className="py-1.5 text-right tabular-nums">{whole(b.members, language)}</td>
              <td className="py-1.5 text-right tabular-nums">{compact(b.kills, language)}</td>
            </tr>
            {b.names.length > 0 && (
              <tr>
                <td colSpan={3} className="pb-1">
                  <details className="group/set">
                    <summary className="tint-button flex min-h-11 cursor-pointer list-none items-center font-semibold text-plum [&::-webkit-details-marker]:hidden">
                      {fill(t["insights.map.bands.who"], { n: whole(b.names.length, language) })}
                      <Caret />
                    </summary>
                    <ul className="ms-1 mb-2 grid grid-cols-2 gap-x-4 border-s-2 border-plum/30 ps-3 sm:grid-cols-3">
                      {b.names.map((name, i) => (
                        <li key={i} className="flex min-h-11 min-w-0 items-center">
                          <bdi translate="no" className="name-fit min-w-0">
                            {name}
                          </bdi>
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
              </tr>
            )}
          </tbody>
        ))}
      </table>
      <p className="mt-1 text-body-sm text-ink/80">{t["insights.map.bands.note"]}</p>
    </div>
  );
}

/** The readout's line per member, in name order: place, kills band and shield. */
function itemsOf(map: KvkMap, t: WorkspaceDictionary, language: string) {
  const words = markWords(map, t, language);
  const shieldWords: Record<Shield, string> = {
    on: t["insights.map.shield.on"],
    not_seen: t["insights.map.shield.notSeen"],
    unknown: t["insights.map.shield.none"],
  };
  return map.dots.map((d) => ({
    label: d.name,
    line: [
      fill(t["insights.map.place"], { x: d.x, y: d.y }),
      words[d.band ?? "unknown"],
      shieldWords[d.shield],
    ].join(" · "),
  }));
}

/** The two "as of" lines: places at the End reading, shields at the newest map scan (or none). */
function AsOf(props: {
  map: KvkMap;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  zone: string;
}) {
  const { map, t, language, zone } = props;
  const when = (at: Date) => {
    const on = dayIn(zone, at.getTime());
    return { date: calendarDates(language).short(on), time: clockIn(at.getTime(), zone, on).time };
  };
  return (
    <>
      <p className="text-body-sm tabular-nums">
        {fill(t["insights.map.asof.places"], when(map.endAt))}
      </p>
      <p className="text-body-sm tabular-nums">
        {map.shieldAt
          ? fill(t["insights.map.asof.shields"], when(map.shieldAt))
          : t["insights.map.asof.noShields"]}
      </p>
    </>
  );
}

export function KvkMapCard(props: {
  map: KvkMap | null;
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { map, slug, t, language } = props;
  const zone = getEnv().SERVER_TZ;
  if (!map || map.dots.length === 0)
    return <Card id={MAP_CARD} title={t["insights.map.head"]} based={[t["insights.map.none"]]} />;
  const day = dayIn(zone, map.at.getTime());
  const n = map.dots.length;
  const based = [
    fill(
      plural(
        n,
        { one: t["insights.map.based.one"], other: t["insights.map.based.other"] },
        language,
      ),
      {
        date: calendarDates(language).short(day),
        n: whole(n, language),
      },
    ),
    ...(map.unplaced > 0
      ? [
          fill(
            plural(
              map.unplaced,
              { one: t["insights.map.unplaced.one"], other: t["insights.map.unplaced.other"] },
              language,
            ),
            { n: whole(map.unplaced, language) },
          ),
        ]
      : []),
  ];
  const frame = frameOf(map);
  const time = clockIn(map.endAt.getTime(), zone, day).time;
  return (
    <Card id={MAP_CARD} title={t["insights.map.head"]} based={based}>
      <p className="mt-1 text-body-sm text-ink/80">{t["insights.map.tap"]}</p>
      <figure className="ph-no-capture mt-1">
        <Readout
          id="kvk-map"
          items={itemsOf(map, t, language)}
          initial={0}
          words={{ earlier: t["insights.map.prev"], later: t["insights.map.next"] }}
        >
          <Plot map={map} />
        </Readout>
        <figcaption className="mt-1 text-body-sm font-medium">
          {fill(t["insights.map.caption"], { time })}
        </figcaption>
      </figure>
      <AsOf map={map} t={t} language={language} zone={zone} />
      <p className="text-body-sm text-ink/80 tabular-nums">
        {fill(t["insights.map.axes"], {
          x1: frame.x1,
          x2: frame.x2,
          y1: frame.y1,
          y2: frame.y2,
        })}
      </p>
      <Legend map={map} t={t} language={language} />
      <Bands map={map} t={t} language={language} />
      <KvkCastleForm slug={slug} castle={map.castle} t={t} />
    </Card>
  );
}
