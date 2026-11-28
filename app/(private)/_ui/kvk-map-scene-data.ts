// The KvK map's scene in words (issue 817 part 2), made on the server so the client scene formats nothing:
// each own member's marks and sheet facts (might, KvK kills gained, shield and its "as of", distance to the
// castle point, last seen in game) and card link, the near/mid/far counts, the other alliances' "TAG · n"
// labels, and the scene's own words. Other alliances carry their tag, member count and centre only.
import { clockIn, dayIn } from "@/lib/private/calendar-time";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { compact, whole } from "@/lib/private/insights-format";
import type { KvkMap, KvkMapDot } from "@/lib/private/kvk-map";
import { fill, plural } from "@/lib/words";

import type { Mark, SceneData, Shield } from "./kvk-map-view";
import type { SceneWords } from "./KvkMapScene";
import { sheetWords } from "./sheet-words";

/** "Sat, Nov 21" and "14:00" of `at` in ST. */
export function whenIn(zone: string, language: WorkspaceLanguage, at: Date) {
  const on = dayIn(zone, at.getTime());
  return { date: calendarDates(language).short(on), time: clockIn(at.getTime(), zone, on).time };
}

/** Each kills band's words, as the legend, the readout and the filters write them. */
export function markWords(
  map: KvkMap,
  t: WorkspaceDictionary,
  language: string,
): Record<Mark, string> {
  const median = compact(map.median ?? 0, language);
  return {
    more: fill(t["insights.map.legend.more"], { median }),
    fewer: fill(t["insights.map.legend.fewer"], { median }),
    none: t["insights.map.legend.none"],
    unknown: t["insights.map.legend.unknown"],
  };
}

export const shieldWordsOf = (t: WorkspaceDictionary): Record<Shield, string> => ({
  on: t["insights.map.shield.on"],
  not_seen: t["insights.map.shield.notSeen"],
  unknown: t["insights.map.shield.none"],
});

type Ctx = { map: KvkMap; t: WorkspaceDictionary; language: WorkspaceLanguage; zone: string };

/** A member's sheet rows: place, might, KvK kills gained, shield, distance to the castle, last seen. */
function factsOf(d: KvkMapDot, { map, t, language, zone }: Ctx): [string, string][] {
  const shield = shieldWordsOf(t)[d.shield];
  const none = t["members.don.none"];
  const far = map.castle && Math.round(Math.hypot(d.x - map.castle.x, d.y - map.castle.y));
  return [
    [t["insights.map.sheet.place"], fill(t["insights.map.place"], { x: d.x, y: d.y })],
    [t["insights.map.sheet.might"], d.might === null ? none : compact(d.might, language)],
    [
      t["insights.map.sheet.gained"],
      d.gain === null ? t["insights.map.sheet.notKnown"] : whole(d.gain, language),
    ],
    [
      t["insights.map.sheet.shield"],
      d.shieldAt
        ? fill(t["insights.map.sheet.shieldAt"], { shield, ...whenIn(zone, language, d.shieldAt) })
        : shield,
    ],
    [
      t["insights.map.sheet.distance"],
      far === null
        ? t["insights.map.sheet.noCastle"]
        : fill(t["insights.map.sheet.squares"], { n: whole(far, language) }),
    ],
    [
      t["insights.map.sheet.seen"],
      d.lastSeen ? fill(t["insights.map.sheet.seenAt"], whenIn(zone, language, d.lastSeen)) : none,
    ],
  ];
}

/** The scene's data: every own member with its marks and facts, the rings' counts, the other alliances. */
export function sceneOf(ctx: Ctx, slug: string): SceneData {
  const { map, t, language } = ctx;
  const n = map.dots.length;
  return {
    dots: map.dots.map((d) => ({
      name: d.name,
      x: d.x,
      y: d.y,
      band: d.band ?? "unknown",
      shield: d.shield,
      ring: d.ring,
      facts: factsOf(d, ctx),
      href: `/w/${slug}/members?m=${d.uid}`,
    })),
    castle: map.castle,
    rings: (map.bands ?? []).map((b) => ({
      ring: b.band,
      radius: b.to,
      label: fill(t["insights.map.ring.count"], {
        ring: t[`insights.map.bands.${b.band}`],
        n: whole(b.members, language),
      }),
    })),
    ownLabel: fill(
      plural(n, { one: t["insights.map.own.one"], other: t["insights.map.own.other"] }, language),
      { n: whole(n, language) },
    ),
    clusters: map.clusters.map((c) => ({
      label: fill(t["insights.map.cluster"], { tag: c.tag, n: whole(c.members, language) }),
      x: c.x,
      y: c.y,
    })),
  };
}

/** The scene's own words: controls, chips, filters and the sheet's frame. */
export function sceneWordsOf(map: KvkMap, t: WorkspaceDictionary, language: string): SceneWords {
  return {
    fit: t["insights.map.fit"],
    zoomIn: t["insights.map.zoomIn"],
    zoomOut: t["insights.map.zoomOut"],
    find: t["insights.map.find"],
    findLabel: t["insights.map.findLabel"],
    findNone: t["insights.map.findNone"],
    axes: t["insights.map.axes"],
    layers: {
      shields: t["insights.map.layer.shields"],
      bands: t["insights.map.layer.bands"],
      names: t["insights.map.layer.names"],
    },
    filters: t["insights.map.filters"],
    bandHead: t["insights.map.filter.band"],
    shieldHead: t["insights.map.filter.shield"],
    ringHead: t["insights.map.filter.ring"],
    bands: markWords(map, t, language),
    shields: shieldWordsOf(t),
    rings: {
      near: t["insights.map.bands.near"],
      mid: t["insights.map.bands.mid"],
      far: t["insights.map.bands.far"],
    },
    card: t["insights.map.sheet.card"],
    sheet: sheetWords(t),
  };
}
