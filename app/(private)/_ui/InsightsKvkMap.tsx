// Insights → KvK's map (issue 791), server-rendered: the own alliance's members where the newest KvK's End
// reading saw them, as a hand-built inline SVG scatter (D68, D158): one dot a member, no name, in 3 bands of
// kills gained told apart by shape and fill, not colour alone. Labels and numbers are HTML beside the plot,
// which is aria-hidden and ph-no-capture. Both axes use one scale, so distances look as they are; the plot
// spans the members (and the castle point) with the squares written under it. The near/mid/far table shows
// only once officers typed a castle point. Nothing here says why a member gained kills.
import type { ReactNode } from "react";

import { getEnv } from "@/lib/env";
import { clockIn, dayIn } from "@/lib/private/calendar-time";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { compact, whole } from "@/lib/private/insights-format";
import type { KillBand, KvkMap } from "@/lib/private/kvk-map";
import { fill, plural } from "@/lib/words";

import { Card } from "./InsightsBars";
import { KvkCastleForm } from "./KvkCastleForm";

const MAP_CARD = "insights-kvk-map";
/** The plot's inner margin, in viewBox units of 100. */
const PAD = 5;
/** The smallest span drawn, in map squares, so a tight cluster is not blown up past what it is. */
const MIN_SPAN = 20;

type Mark = KillBand | "unknown";

/** One band's mark at (cx, cy): hollow ring, small grey dot, larger plum dot, faint dot when not known. */
function Dot({ mark, cx, cy }: { mark: Mark; cx: number; cy: number }) {
  if (mark === "none")
    return <circle cx={cx} cy={cy} r={1.3} className="fill-none stroke-ink" strokeWidth={0.5} />;
  if (mark === "fewer") return <circle cx={cx} cy={cy} r={1.2} className="fill-ink/60" />;
  if (mark === "more") return <circle cx={cx} cy={cy} r={1.8} className="fill-plum" />;
  return <circle cx={cx} cy={cy} r={0.8} className="fill-ink/30" />;
}

/** The castle point's mark: a plus in seal. */
function Castle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="stroke-seal" strokeWidth={1} strokeLinecap="round">
      <line x1={cx - 2.5} y1={cy} x2={cx + 2.5} y2={cy} />
      <line x1={cx} y1={cy - 2.5} x2={cx} y2={cy + 2.5} />
    </g>
  );
}

/** A legend swatch: the mark drawn on its own, 16 px. */
function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="-3 -3 6 6" aria-hidden="true" className="size-4 shrink-0">
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

function Plot({ map }: { map: KvkMap }) {
  const { at } = frameOf(map);
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="ph-no-capture mt-2 aspect-square w-full max-w-md border border-rule"
    >
      {map.dots.map((d, i) => (
        <Dot key={i} mark={d.band ?? "unknown"} {...at(d.x, d.y)} />
      ))}
      {map.castle && <Castle {...at(map.castle.x, map.castle.y)} />}
    </svg>
  );
}

function Legend({ map, t, language }: { map: KvkMap; t: WorkspaceDictionary; language: string }) {
  const count = (mark: Mark) => map.dots.filter((d) => (d.band ?? "unknown") === mark).length;
  const median = compact(map.median ?? 0, language);
  const rows: [Mark, string][] = [
    ["more", fill(t["insights.map.legend.more"], { median })],
    ["fewer", fill(t["insights.map.legend.fewer"], { median })],
    ["none", t["insights.map.legend.none"]],
    ["unknown", t["insights.map.legend.unknown"]],
  ];
  return (
    <ul className="mt-2 text-body-sm">
      {rows.map(
        ([mark, label]) =>
          count(mark) > 0 && (
            <li key={mark} className="flex items-center gap-2 border-t border-rule py-1">
              <Swatch>
                <Dot mark={mark} cx={0} cy={0} />
              </Swatch>
              <span className="min-w-0 flex-1">{label}</span>
              <span className="font-semibold tabular-nums">{whole(count(mark), language)}</span>
            </li>
          ),
      )}
      {map.castle && (
        <li className="flex items-center gap-2 border-t border-rule py-1">
          <Swatch>
            <Castle cx={0} cy={0} />
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
        <tbody>
          {map.bands.map((b) => (
            <tr key={b.band} className="border-t border-rule">
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
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-body-sm text-ink/80">{t["insights.map.bands.note"]}</p>
    </div>
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
      <figure className="mt-1">
        <Plot map={map} />
        <figcaption className="mt-1 text-body-sm font-medium">
          {fill(t["insights.map.caption"], { time })}
        </figcaption>
      </figure>
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
