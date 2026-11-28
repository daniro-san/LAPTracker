// The officers' KvK map's view (issue 817 part 2), with no React: what the server hands the client scene
// (each member's place, marks and sheet facts already in words; the other alliances' clusters; the rings'
// counts), the two zoom levels and their steps, the visible box the scene draws, Find, the layer chips and
// the filters, and where each name label goes. Places are in map squares (Y grows upward, as in the game);
// the plot is 100 units square.
import type { KillBand, Ring } from "@/lib/private/kvk-map";
import type { ShieldSuggestion } from "@/lib/shield-check";

/** The plot's inner margin at the home and fit views, in plot units: room for a name beside an edge house. */
const PAD = 12;
/** The smallest span the home and fit views frame, in map squares, so a tight cluster is not blown up. */
const MIN_SPAN = 20;
/** The closest zoom: this many map squares across the plot. */
export const CLOSEST = 20;
/** Find frames its member in at most this many map squares across. */
const FIND_SPAN = 40;
/** Glyph sizes in plot units (of 100): a house, its shield ring, the castle. */
export const HOUSE = 5.6;
export const RING = 11.2;
export const CASTLE = 17.5;
/** A name label's room in plot units at 360 px (12 px text): one line's height, one letter's width, the cap. */
const LINE = 5.2;
const LETTER = 2.6;
const NAME_MAX = 30;

export type Mark = KillBand | "unknown";
export type Shield = ShieldSuggestion;

export interface SceneDot {
  name: string;
  x: number;
  y: number;
  band: Mark;
  shield: Shield;
  ring: Ring | null;
  /** The detail sheet's rows, label then value, in words. */
  facts: [string, string][];
  /** The member card. */
  href: string;
}

export interface SceneData {
  /** In name order: the readout's order, so `data-at` matches it. */
  dots: SceneDot[];
  castle: { x: number; y: number } | null;
  /** Near, mid and far round the castle point, each with its outer distance and its count in words. */
  rings: { ring: Ring; radius: number; label: string }[];
  /** At the fit level without a castle point: the own members' count, at their centre. */
  ownLabel: string;
  /** The other tracked alliances: "TAG · n" at their members' centre. */
  clusters: { label: string; x: number; y: number }[];
}

/** The fit level frames everything; the city level is a box of `span` map squares round (cx, cy). */
export type View = { level: "fit" } | { level: "city"; cx: number; cy: number; span: number };
export interface Frame {
  cx: number;
  cy: number;
  span: number;
}
export interface Layers {
  shields: boolean;
  bands: boolean;
  names: boolean;
}
export interface Filters {
  band: Mark[];
  shield: Shield[];
  ring: Ring[];
}
export interface SceneState {
  view: View;
  layers: Layers;
  filters: Filters;
  /** The member whose sheet is open, by index in `dots`. */
  selected: number | null;
}

export const START: SceneState = {
  view: { level: "fit" },
  layers: { shields: true, bands: false, names: true },
  filters: { band: [], shield: [], ring: [] },
  selected: null,
};

export type Point = { cx: number; cy: number };
export type Box = { x: number; y: number; w: number; h: number };

/** The square that holds `points` with the plot's margin round it. */
function frameOf(points: { x: number; y: number }[]): Frame {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const range = Math.max(x2 - x1, y2 - y1, MIN_SPAN);
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, span: (range * 100) / (100 - 2 * PAD) };
}

/** The city level's first view: the own members and the castle point, as part 1 framed them. */
export const homeOf = (data: SceneData) =>
  frameOf([...data.dots, ...(data.castle ? [data.castle] : [])]);

/** The fit level: the own members, the castle point and every other alliance's centre. */
export const fitOf = (data: SceneData) =>
  frameOf([...data.dots, ...(data.castle ? [data.castle] : []), ...data.clusters]);

export const frameIn = (view: View, data: SceneData): Frame =>
  view.level === "fit" ? fitOf(data) : view;

/** Map squares to plot units in `frame`. */
export const project =
  (f: Frame) =>
  (x: number, y: number): Point => ({
    cx: 50 + ((x - f.cx) * 100) / f.span,
    cy: 50 - ((y - f.cy) * 100) / f.span,
  });

/** The plot's edges in map squares, as the words under it name them. */
export const edgesOf = (f: Frame) => ({
  x1: Math.round(f.cx - f.span / 2),
  x2: Math.round(f.cx + f.span / 2),
  y1: Math.round(f.cy - f.span / 2),
  y2: Math.round(f.cy + f.span / 2),
});

/** The members whose house falls in the visible box (with a ring's room round it): the only ones drawn. */
export function visibleOf(dots: { x: number; y: number }[], f: Frame): number[] {
  const at = project(f);
  const m = RING / 2;
  return dots.flatMap((d, i) => {
    const p = at(d.x, d.y);
    return p.cx >= -m && p.cx <= 100 + m && p.cy >= -m && p.cy <= 100 + m ? [i] : [];
  });
}

export const canZoomIn = (view: View) => view.level === "fit" || view.span > CLOSEST;

/** + : the fit level opens the home view; the city level halves its span, down to CLOSEST. */
export function zoomIn(view: View, data: SceneData): View {
  if (view.level === "fit") return { level: "city", ...homeOf(data) };
  return { ...view, span: Math.max(CLOSEST, view.span / 2) };
}

/** − : the city level doubles its span up to the home view's, then goes back to the fit level. */
export function zoomOut(view: View, data: SceneData): View {
  if (view.level === "fit") return view;
  const home = homeOf(data).span;
  return view.span >= home ? { level: "fit" } : { ...view, span: Math.min(home, view.span * 2) };
}

/** A drag of (dx, dy) plot units moves the city level's box the other way; the fit level stays. */
export function panned(view: View, dx: number, dy: number): View {
  if (view.level === "fit") return view;
  return { ...view, cx: view.cx - (dx * view.span) / 100, cy: view.cy + (dy * view.span) / 100 };
}

/** Find: the members whose name holds `query`, any case, in name order; none for an empty query. */
export function findOf(dots: { name: string }[], query: string, limit = 8): number[] {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return [];
  return dots
    .flatMap((d, i) => (d.name.toLocaleLowerCase().includes(q) ? [i] : []))
    .slice(0, limit);
}

/** A member passes when each filter group is empty or holds its value. */
export const passes = (d: Pick<SceneDot, "band" | "shield" | "ring">, f: Filters) =>
  (f.band.length === 0 || f.band.includes(d.band)) &&
  (f.shield.length === 0 || f.shield.includes(d.shield)) &&
  (f.ring.length === 0 || (d.ring !== null && f.ring.includes(d.ring)));

const toggled = <T>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export type SceneAction =
  | { type: "fit" | "in" | "out" | "close" }
  | { type: "pan"; dx: number; dy: number }
  | { type: "pick" | "find"; i: number }
  | { type: "layer"; key: keyof Layers }
  | { type: "band"; value: Mark }
  | { type: "shield"; value: Shield }
  | { type: "ring"; value: Ring };

/** The scene's one state step. Find opens its member's sheet and frames it at the city level. */
export function sceneStep(data: SceneData, s: SceneState, a: SceneAction): SceneState {
  switch (a.type) {
    case "fit":
      return { ...s, view: { level: "fit" } };
    case "in":
      return { ...s, view: zoomIn(s.view, data) };
    case "out":
      return { ...s, view: zoomOut(s.view, data) };
    case "pan":
      return { ...s, view: panned(s.view, a.dx, a.dy) };
    case "pick":
      return { ...s, selected: a.i };
    case "find": {
      const d = data.dots[a.i] as SceneDot;
      const span = Math.max(CLOSEST, Math.min(homeOf(data).span, FIND_SPAN));
      return { ...s, selected: a.i, view: { level: "city", cx: d.x, cy: d.y, span } };
    }
    case "close":
      return { ...s, selected: null };
    case "layer":
      return { ...s, layers: { ...s.layers, [a.key]: !s.layers[a.key] } };
    default:
      return {
        ...s,
        filters: { ...s.filters, [a.type]: toggled<string>(s.filters[a.type], a.value) },
      };
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The box no name may cover around the castle: the drawing and 1 plot unit round it. */
export function keepOutOf(castle: Point): Box {
  const clear = CASTLE / 2 + 1;
  return { x: castle.cx - clear, y: castle.cy - clear, w: 2 * clear, h: 2 * clear };
}

/** The 8 spots a name may take round its house at (cx, cy): under, above, right, left, then the corners. */
function spotsOf({ cx, cy }: Point, w: number): Box[] {
  const [r, h] = [RING / 2, LINE];
  return [
    { x: cx - w / 2, y: cy + r, w, h },
    { x: cx - w / 2, y: cy - r - h, w, h },
    { x: cx + r, y: cy - h / 2, w, h },
    { x: cx - r - w, y: cy - h / 2, w, h },
    { x: cx + r * 0.7, y: cy + r * 0.7, w, h },
    { x: cx - r * 0.7 - w, y: cy + r * 0.7, w, h },
    { x: cx + r * 0.7, y: cy - r * 0.7 - h, w, h },
    { x: cx - r * 0.7 - w, y: cy - r * 0.7 - h, w, h },
  ];
}

/**
 * Where each member's name goes, in plot units, nearest the castle first: of under, above, right, left and
 * the four corners of its house, the first spot inside the plot that covers neither the castle nor another
 * name nor another house's ring. When none is free, the spot that covers the fewest names, then rings; never
 * the castle when any spot avoids it.
 */
export function labelsOf(dots: { name: string }[], points: Point[], castle: Point | null): Box[] {
  const r = RING / 2;
  const keep = castle ? [keepOutOf(castle)] : [];
  const rings = points.map((p) => ({ x: p.cx - r, y: p.cy - r, w: RING, h: RING }));
  const names: Box[] = [];
  const count = (b: Box, of: Box[]) => of.filter((o) => overlaps(b, o)).length;
  const outside = (b: Box) => b.x < 0 || b.y < 0 || b.x + b.w > 100 || b.y + b.h > 100;
  const cost = (b: Box) =>
    (outside(b) ? 1000 : 0) + 100 * count(b, keep) + 10 * count(b, names) + count(b, rings);
  // Nearest the castle first: those names have the fewest free spots.
  const from = castle ?? { cx: 50, cy: 50 };
  const order = dots
    .map((_, i) => i)
    .sort((a, b) => dist(points[a] as Point, from) - dist(points[b] as Point, from));
  const placed: Box[] = [];
  for (const i of order) {
    const w = Math.min(NAME_MAX, (dots[i] as { name: string }).name.length * LETTER + 2);
    const box = spotsOf(points[i] as Point, w).reduce((best, b) =>
      cost(b) < cost(best) ? b : best,
    );
    names.push(box);
    placed[i] = box;
  }
  return placed;
}
