// What a public page's link preview says (issue 830, D164): the card's figures and their og:description
// text, built from the facts the page itself shows: an alliance's Might, Kills and Members with their change
// and its ledger rank, a player's Might, Kills and Level, an alliance's ranks board line, an event's top
// ledger rows. The pictures are drawn in English ("en", the copy any viewer without a choice gets), since one
// picture serves every viewer; the text follows the page's language.
import type { Dictionary } from "@/lib/copy";
import type { CardFigure, CardNote, CardRow, LinkCard } from "@/lib/link-card";
import type { PlayerHistory } from "@/lib/queries";
import type { BoardAlliance } from "@/lib/queries/alliance-list";

import type { ComparisonRow } from "./event-rows";
import { allianceLabel, compact, signOf } from "./format";
import type { StatMetric } from "./StatTable";

export const CARD_LOCALE = "en";
/** An event card's ledger rows; its text names the first three. */
const CARD_ROWS = 5;
const TEXT_ROWS = 3;

const valueText = (n: number | null, locale: string) => (n === null ? "—" : compact(n, locale));
const rankText = (n: number | null) => (n === null ? "#—" : `#${n}`);

/** A change as the page writes it: signed, compact; null when the page shows none. */
const changeNote = (delta: number | null, locale: string): CardNote | null =>
  delta === null
    ? null
    : { text: `${signOf(delta)}${compact(delta, locale)}`, sign: Math.sign(delta) };

const figuresOf = (metrics: StatMetric[], locale: string): CardFigure[] =>
  metrics.map((m) => ({
    label: m.label,
    value: valueText(m.value, locale),
    note: changeNote(m.delta, locale),
  }));

/** One alliance in one event: its three totals with their change, then its rank by might. */
export function allianceCard(
  a: { tag: string; name: string; metrics: StatMetric[]; rank: number | null },
  subtitle: string | null,
  copy: Dictionary,
  locale: string,
): LinkCard {
  return {
    title: allianceLabel(a.tag, a.name),
    subtitle,
    figures: [
      ...figuresOf(a.metrics, locale),
      { label: copy.ledger.rank, value: rankText(a.rank) },
    ],
  };
}

/** An event: its ledger's first rows, each with its Might and the Might's change. */
export function eventCard(
  title: string,
  subtitle: string | null,
  rows: ComparisonRow[],
  locale: string,
): LinkCard {
  const top: CardRow[] = rows.slice(0, CARD_ROWS).map((r) => {
    const might = r.metrics[0];
    return {
      rank: rankText(r.rank),
      tag: r.tag,
      name: r.name,
      value: valueText(might?.value ?? null, locale),
      note: changeNote(might?.delta ?? null, locale),
    };
  });
  return { title, subtitle, figures: [], rows: top };
}

/** A player: the name, the alliance, and the newest Might, Kills and Level (the page's summary band). */
export function playerCard(history: PlayerHistory, copy: Dictionary, locale: string): LinkCard {
  const { current } = history;
  const l = copy.ledger;
  return {
    title: current.name,
    subtitle: allianceLabel(current.tag, history.alliances.at(-1)?.name ?? null) || null,
    figures: [
      { label: l.might, value: valueText(current.power, locale) },
      { label: l.kills, value: valueText(current.kills, locale) },
      { label: l.level, value: valueText(current.lv, locale) },
    ],
  };
}

/** An alliance's own page: its ranks board line, Might and Kills with their board rank; none off the board. */
export function boardCard(
  label: string,
  board: BoardAlliance | null,
  copy: Dictionary,
  locale: string,
): LinkCard {
  const l = copy.ledger;
  const figure = (name: string, value: number | null, rank: number | null): CardFigure[] =>
    value === null || rank === null
      ? []
      : [{ label: name, value: valueText(value, locale), note: { text: rankText(rank), sign: 0 } }];
  return {
    title: label,
    subtitle: null,
    figures: board
      ? [
          ...figure(l.might, board.power, board.powerRank),
          ...figure(l.kills, board.kills, board.killsRank),
        ]
      : [],
  };
}

/** The card's facts as one line, for og:description: `Might 1.2B +30M · Kills 4.5M · Rank #3`, or an
 * event's `#1 OGs 1.2B +30M · #2 …`. */
export function cardText(card: LinkCard): string {
  const parts = card.rows
    ? card.rows.slice(0, TEXT_ROWS).map((r) => [r.rank, r.tag || r.name, r.value, r.note?.text])
    : card.figures.map((f) => [f.label, f.value, f.note?.text]);
  return parts.map((p) => p.filter(Boolean).join(" ")).join(" · ");
}
