// The KvK debrief's card for the leaders' channel (issue 872): one picture in the officer's language, drawn by
// next/og with the event picture's fonts, scale and `drawable` (lib/event-image-parts.tsx) and the brand's
// band and mark; no game art, no URL. It is made from the debrief only: the names of members who gained kills
// with their gain, then counts and sums (roll call ✓ counts, members and kills per distance band, the
// recovery headline, the opponent's sums). No place, last seen or online state is ever an input.
import { ImageResponse } from "next/og";

import { MarkLine } from "../brand/components/Logo";
import { tokenColor } from "../brand/palette";
import { copy } from "../copy";
import { drawable, loadFonts, ROW, u } from "../event-image-parts";
import { fill } from "../words";
import { calendarDates } from "./calendar-words";
import { compact, whole, type Formats } from "./insights-format";
import { kvkWords } from "./insights-more-words";
import type { KvkDebrief } from "./kvk-debrief";

export interface DebriefCard {
  title: string;
  subtitle: string;
  sections: { head: string; lines: string[]; rows: { label: string; value: string }[] }[];
}

export const signed = (n: number, language: string) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${compact(Math.abs(n), language)}`;

type CardSection = DebriefCard["sections"][number];

/** "Members with kills gained: n of m. Kills gained together: …", or none known. */
export function thanksLine(d: KvkDebrief, { t, language }: Formats): string {
  return d.thanks.length > 0
    ? fill(t["debrief.thanks.lead"], {
        n: d.thanks.length,
        m: d.counted,
        kills: compact(d.gained, language),
      })
    : t["debrief.thanks.none"];
}

type Sums = { kills: number; might: number };

/** Two rows, kills gained and might change, each "us · them". */
function opponentRows(o: { us: Sums; them: Sums }, { t, language }: Formats) {
  return [
    ["debrief.opponent.kills", o.us.kills, o.them.kills] as const,
    ["debrief.opponent.might", o.us.might, o.them.might] as const,
  ].map(([key, us, them]) => ({
    label: t[key],
    value: fill(t["debrief.opponent.sides"], {
      us: signed(us, language),
      them: signed(them, language),
    }),
  }));
}

function rollSection(d: KvkDebrief, { t, language }: Formats): CardSection {
  const head = t["debrief.roll.head"];
  if (!d.rollCall)
    return {
      head,
      lines: [fill(t["debrief.roll.none"], { kind: t["roll.kind.shield"] })],
      rows: [],
    };
  return {
    head,
    lines: [],
    rows: [
      { label: t["roll.yes.shield"], value: whole(d.rollCall.shield.length, language) },
      { label: t["roll.prep.wall"], value: whole(d.rollCall.wall.length, language) },
    ],
  };
}

function mapSection(d: KvkDebrief, { t, language }: Formats): CardSection {
  return {
    head: t["debrief.map.head"],
    lines: d.bands ? [] : [t[d.castle ? "insights.map.bands.few" : "insights.map.bands.empty"]],
    rows: (d.bands ?? []).map((b) => ({
      label: fill(t["debrief.map.row"], { band: t[`insights.map.bands.${b.band}`], n: b.members }),
      value: compact(b.kills, language),
    })),
  };
}

/**
 * The Opponent section's lead and rows: the KvK matchup's Start to End (D152), else the raid opponent's
 * (issue 861, D165); null with neither.
 */
export function opponentWords(d: KvkDebrief, f: Formats) {
  const { t } = f;
  const { opponent: o, raid: r } = d;
  if (o) {
    const lead = fill(t["debrief.opponent.lead"], {
      server: o.server,
      us: o.us.counted,
      them: o.them.counted,
    });
    return { lead, rows: opponentRows(o, f) };
  }
  if (!r) return null;
  const lead = fill(t["debrief.raid.lead"], { tag: r.tag, server: r.server });
  return { lead, rows: opponentRows(r, f) };
}

function opponentSection(d: KvkDebrief, f: Formats): CardSection {
  const { t } = f;
  const o = opponentWords(d, f);
  return {
    head: t["debrief.opponent.head"],
    lines: [o?.lead ?? t["debrief.opponent.none"]],
    rows: o?.rows ?? [],
  };
}

/** A name the card's fonts can draw; with nothing drawable, the member's uid (as `label` does for an alliance). */
const drawnName = (p: { uid: number; name: string }) => drawable(p.name) || `#${p.uid}`;

/** The card's words: each section's heading, its lines, and its label–value rows. */
export function debriefCard(d: KvkDebrief, f: Formats): DebriefCard {
  const { t, language } = f;
  const recovery =
    d.recovery &&
    kvkWords({ events: [d.recovery], waiting: null, readsFrom: null }, d.recovery.nowDay, f, "")
      .based[0];
  return {
    title: t["debrief.head"],
    subtitle: calendarDates(language).short(d.day),
    sections: [
      {
        head: t["debrief.thanks.head"],
        lines: [thanksLine(d, f), t["debrief.thanks.support"]],
        rows: d.thanks.map((p) => ({ label: drawnName(p), value: signed(p.gain, language) })),
      },
      rollSection(d, f),
      mapSection(d, f),
      {
        head: t["debrief.recovery.head"],
        lines: [recovery || t["debrief.recovery.none"]],
        rows: [],
      },
      opponentSection(d, f),
    ],
  };
}

// Layout in CSS px at 1× (the event picture's 360 px, drawn at 2×); every box has a fixed height.
const WIDTH = 360;
const PAD = 14;
const HEADER = 66;
const HEAD = 34;
const LINE = 20;
/** A line wraps after about this many characters at 15 px in the 332 px column. */
const LINE_CHARS = 40;
const FOOT = 34;

const lineHeight = (text: string) => Math.ceil(Math.max(1, text.length) / LINE_CHARS) * LINE;
const cut = { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } as const;

type Colors = Record<"paper" | "ink" | "plum" | "rule", string>;

/** A section's heading, lines and rows, and the height they take (CSS px at 1×). */
function sectionParts(s: CardSection, i: number, c: Colors) {
  const lines = s.lines.map(drawable);
  const height = HEAD + lines.reduce((a, l) => a + lineHeight(l), 0) + s.rows.length * ROW;
  const head = {
    display: "flex",
    alignItems: "flex-end",
    height: u(HEAD),
    fontFamily: "Alegreya Sans",
    fontWeight: 700,
    fontSize: u(20),
    color: c.plum,
  } as const;
  const row = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: u(8),
    height: u(ROW),
    fontFamily: "Source Sans 3",
    fontSize: u(17),
    borderBottom: `${u(1)}px solid ${c.rule}`,
  } as const;
  const parts = [
    <div key={`h${i}`} style={head}>
      {drawable(s.head)}
    </div>,
    ...lines.map((l, j) => (
      <div
        key={`l${i}-${j}`}
        style={{
          display: "flex",
          height: u(lineHeight(l)),
          fontFamily: "Source Sans 3",
          fontSize: u(15),
          lineHeight: `${u(LINE)}px`,
        }}
      >
        {l}
      </div>
    )),
    ...s.rows.map((r, j) => (
      <div key={`r${i}-${j}`} style={row}>
        <span style={{ ...cut, minWidth: 0, fontWeight: 600 }}>{drawable(r.label)}</span>
        <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{drawable(r.value)}</span>
      </div>
    )),
  ];
  return { parts, height };
}

function Header({ card, c }: { card: DebriefCard; c: Colors }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: u(10),
        height: u(HEADER),
        padding: `0 ${u(PAD)}px`,
        background: c.plum,
        color: c.paper,
      }}
    >
      <MarkLine size={u(40)} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ ...cut, fontFamily: "Alegreya", fontSize: u(24), lineHeight: 1.1 }}>
          {drawable(card.title)}
        </div>
        <div style={{ ...cut, fontFamily: "Source Sans 3", fontSize: u(15) }}>
          {drawable(card.subtitle)}
        </div>
      </div>
    </div>
  );
}

/** The card as PNG bytes. */
export async function renderDebriefCard(card: DebriefCard): Promise<Uint8Array<ArrayBuffer>> {
  const c = {
    paper: tokenColor("paper"),
    ink: tokenColor("ink"),
    plum: tokenColor("plum"),
    rule: tokenColor("rule"),
  };
  const sections = card.sections.map((s, i) => sectionParts(s, i, c));
  const height = HEADER + FOOT + PAD + sections.reduce((a, s) => a + s.height, 0);
  const picture = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: c.paper,
        color: c.ink,
      }}
    >
      <Header card={card} c={c} />
      <div style={{ display: "flex", flexDirection: "column", padding: `0 ${u(PAD)}px` }}>
        {sections.flatMap((s) => s.parts)}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: u(FOOT),
          padding: `0 ${u(PAD)}px`,
          borderTop: `${u(1)}px solid ${c.rule}`,
          fontFamily: "Source Sans 3",
          fontSize: u(14),
        }}
      >
        {copy.site.name}
      </div>
    </div>
  );
  const size = { width: u(WIDTH), height: u(height), fonts: loadFonts() };
  return new Uint8Array(await new ImageResponse(picture, size).arrayBuffer());
}
