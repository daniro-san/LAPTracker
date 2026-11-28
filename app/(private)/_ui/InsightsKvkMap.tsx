// Insights → KvK's map (issues 791, 817), server-rendered around a small client scene (KvkMapScene, D68):
// the own alliance's members where the newest KvK's End reading saw them. Every word and number is made
// here; the scene only zooms, pans, filters and opens a member's sheet. Two zoom levels: the fit level
// shows the own members as dots with near/mid/far counts round the castle point, and each other tracked
// alliance as a muted "TAG · n" at its members' centre (no name of theirs); the city level shows each own
// member's drawn house with its name, its shield ring (a light ring when its newest reading before that KvK
// saw a shield, a dashed one with no reading, D75) and, as a layer, its kills band. A tap on a house opens
// the member's sheet: might, KvK kills gained, shield with its "as of", distance to the castle point, last
// seen in game (the newest daily update, D163) and the link to the member card. The readout under the plot
// names the tapped member, with 44 px ‹ › steps in name order (D158 rule 7 (a)); the plot is aria-hidden (the
// readout, the "Who" lists and the sheet say the same) and the figure is ph-no-capture. The near/mid/far
// table shows only once officers typed a castle point, each row with its members' names behind a tap.
// Nothing here says why a member gained kills.
import type { ReactNode } from "react";

import { Readout } from "@/app/_ui/charts/Readout";
import { CastleGlyph } from "@/lib/brand/components/MapGlyphs";
import { getEnv } from "@/lib/env";
import { clockIn, dayIn } from "@/lib/private/calendar-time";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { compact, whole } from "@/lib/private/insights-format";
import type { KvkMap } from "@/lib/private/kvk-map";
import { fill, plural } from "@/lib/words";

import { Card } from "./InsightsBars";
import { Caret } from "./InsightsSets";
import { markWords, sceneOf, sceneWordsOf, shieldWordsOf, whenIn } from "./kvk-map-scene-data";
import type { Mark, Shield } from "./kvk-map-view";
import { KvkCastleForm } from "./KvkCastleForm";
import { KvkMapScene, Member } from "./KvkMapScene";

const MAP_CARD = "insights-kvk-map";

/** A legend swatch: the mark drawn on its own, 16 px. */
function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="-6 -6 12 12" aria-hidden="true" className="size-4 shrink-0">
      {children}
    </svg>
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
  const shieldWords = shieldWordsOf(t);
  return map.dots.map((d) => ({
    label: d.name,
    line: [
      fill(t["insights.map.place"], { x: d.x, y: d.y }),
      words[d.band ?? "unknown"],
      shieldWords[d.shield],
    ].join(" · "),
  }));
}

/** The "as of" lines: places at the End reading, shields at the newest map scan (or none), and the other
 * alliances at their daily update when the map shows any. */
function AsOf(props: {
  map: KvkMap;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  zone: string;
}) {
  const { map, t, language, zone } = props;
  const when = (at: Date) => whenIn(zone, language, at);
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
      {map.clusters.length > 0 && map.clustersAt && (
        <p className="text-body-sm tabular-nums">
          {fill(t["insights.map.asof.others"], when(map.clustersAt))}
        </p>
      )}
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
          <KvkMapScene
            data={sceneOf({ map, t, language, zone }, slug)}
            words={sceneWordsOf(map, t, language)}
          />
        </Readout>
        <figcaption className="mt-1 text-body-sm font-medium">
          {fill(t["insights.map.caption"], { time })}
        </figcaption>
      </figure>
      <AsOf map={map} t={t} language={language} zone={zone} />
      <Legend map={map} t={t} language={language} />
      <Bands map={map} t={t} language={language} />
      <KvkCastleForm slug={slug} castle={map.castle} t={t} />
    </Card>
  );
}
