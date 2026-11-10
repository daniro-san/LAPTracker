// The event picture under the public Discord message (D58): the event's header, then the ledger by Might
// (the Before) or the ledger with its change and the top gains (the After). Drawn by next/og (Satori)
// with the brand's three fonts, committed as TTF in lib/brand/fonts/ because next/font ships WOFF2,
// which Satori cannot read. Laid out at 360 px and drawn at 2×, so it reads at a phone's width.
// Alliance tags and names and numbers only: no member names, no URL (plan §12.3).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { cloneElement, type ReactElement } from "react";

import { SERVER } from "../config/alliances";
import { MarkLine } from "./brand/components/Logo";
import { KillsMark, MightMark } from "./brand/components/MoverMarks";
import { tokenColor, TOKENS, type Token } from "./brand/palette";
import { delta } from "./compute";
import { copy, fill } from "./copy";
import { compact, signedCompact, type DiscordClock } from "./discord-format";
import { topGains, usable, type PublicAlliance } from "./notify";
import type { Phase } from "./repo";
import { isGeneratedName } from "./schedule";

export interface ImageAlliance extends PublicAlliance {
  memberCount: number | null;
}

export interface EventImageInput {
  eventId: number;
  name: string;
  manual: boolean;
  phase: Phase;
  clock: DiscordClock;
  /** When this phase's run finished. */
  at: Date;
  /** The Before's finish, on the After's picture; the After's due time, on a scheduled Before's. */
  beforeAt: Date | null;
  nextAt: Date | null;
  /** This phase's rows, and the Before's on the After's picture. */
  alliances: ImageAlliance[];
  before: PublicAlliance[];
}

// Layout in CSS px at 1×; every box has a fixed height, so the picture's height is their sum.
const U = 2;
const u = (n: number) => n * U;
const WIDTH = 360;
const PAD = 14;
const HEADER = 66;
const SECTION = 36;
const ROW = 35;
const FOOT = 34;
const END = 10;
const LEDGER: Record<Phase, number> = { before: 10, after: 5 };
/** A picture that is not drawn by then is dropped and the message goes as text (D58). */
const RENDER_LIMIT_MS = 3_000;

type Colors = Record<Token, string>;
const column = { display: "flex", flexDirection: "column" } as const;
const colors = () => Object.fromEntries(TOKENS.map((t) => [t, tokenColor(t)])) as Colors;

const FONT_FILES = [
  ["Young Serif", "YoungSerif-Regular.ttf", 400],
  ["Alegreya Sans", "AlegreyaSans-Bold.ttf", 700],
  ["Source Sans 3", "SourceSans3-Regular.ttf", 400],
  ["Source Sans 3", "SourceSans3-Semibold.ttf", 600],
] as const;
let fonts: { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[] | undefined;
const loadFonts = () =>
  (fonts ??= FONT_FILES.map(([name, file, weight]) => ({
    name,
    weight,
    style: "normal" as const,
    data: readFileSync(join(process.cwd(), "lib/brand/fonts", file)),
  })));

/**
 * Only what the loaded fonts draw (owner, 2026-11-09): other scripts (꧁ ꧂, CJK, Thai), emoji and their
 * joiners are left out, so the renderer never fetches a font or an emoji. The text keeps the full name.
 */
const UNDRAWN =
  /[^\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f|\u20e3/gu;
export const drawable = (text: string) => text.replace(UNDRAWN, "").replace(/\s+/g, " ").trim();

/** The tag and the name as drawn; the union id when nothing of either can be drawn. */
function label(a: PublicAlliance) {
  const tag = drawable(a.tag ?? "");
  const name = drawable(a.name ?? "");
  return { tag, name: tag || name ? name : String(a.unionId) };
}

/** A scheduled event's generated name without its date (the date is under it); any other as typed. */
function title(e: Pick<EventImageInput, "name" | "manual">) {
  const named =
    e.manual || !isGeneratedName(e.name) ? e.name : e.name.replace(/ \d{4}-\d{2}-\d{2}$/, "");
  return drawable(named) || copy.site.shortName;
}

function subtitle(e: EventImageInput) {
  const t = copy.discord.image;
  const time = (d: Date) => e.clock.time(d);
  const parts =
    e.phase === "before"
      ? [
          fill(t.before, { time: time(e.at) }),
          e.nextAt && fill(t.afterDue, { time: time(e.nextAt) }),
        ]
      : [
          e.beforeAt && fill(t.before, { time: time(e.beforeAt) }),
          fill(t.after, { time: time(e.at) }),
        ];
  return [e.clock.day(e.at), ...parts].filter(Boolean).join(" · ");
}

const mark = (el: ReactElement, color: string) =>
  cloneElement(el as ReactElement<Record<string, unknown>>, {
    width: u(18),
    height: u(18),
    style: { color },
  });

function Header({ c, e }: { c: Colors; e: EventImageInput }) {
  const line = { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } as const;
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
      <div style={{ ...column, maxWidth: u(WIDTH - 2 * PAD - 50) }}>
        <div style={{ ...line, fontFamily: "Young Serif", fontSize: u(24), lineHeight: 1.1 }}>
          {title(e)}
        </div>
        <div style={{ ...line, fontFamily: "Source Sans 3", fontSize: u(15) }}>{subtitle(e)}</div>
      </div>
    </div>
  );
}

function Section({
  c,
  icon,
  color,
  text,
}: {
  c: Colors;
  icon: ReactElement;
  color: string;
  text: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: u(6),
        height: u(SECTION),
        fontFamily: "Alegreya Sans",
        fontWeight: 700,
        fontSize: u(21),
        color: c.ink,
      }}
    >
      {mark(icon, color)}
      <span>{text}</span>
    </div>
  );
}

interface Cell {
  text: string;
  width: number;
  color?: string;
  bold?: boolean;
}

/** One row: the rank, the tag in bold, the name cut to fit, then the numbers right-aligned. */
function Row({ c, rank, a, cells }: { c: Colors; rank: number; a: PublicAlliance; cells: Cell[] }) {
  const { tag, name } = label(a);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: u(ROW),
        fontFamily: "Source Sans 3",
        fontSize: u(19),
        color: c.ink,
        borderBottom: `${u(1)}px solid ${c.rule}`,
      }}
    >
      <span style={{ width: u(26), fontWeight: 600 }}>{rank}</span>
      <span style={{ display: "flex", flex: 1, gap: u(5), overflow: "hidden" }}>
        <span style={{ fontWeight: 600, flexShrink: 0 }}>{tag}</span>
        <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {name}
        </span>
      </span>
      {cells.map((cell, i) => (
        <span
          key={i}
          style={{
            width: u(cell.width),
            justifyContent: "flex-end",
            flexShrink: 0,
            color: cell.color ?? c.ink,
            fontWeight: cell.bold ? 600 : 400,
          }}
        >
          {cell.text}
        </span>
      ))}
    </div>
  );
}

const STALE_CELL = (c: Colors, width: number): Cell => ({
  text: copy.discord.image.stale,
  width,
  color: c.sage,
  bold: true,
});

/** The Before's numbers: Might and Members; a stale or failed row says so instead of its Might. */
function beforeCells(c: Colors, a: ImageAlliance): Cell[] {
  const might = usable(a) && a.totalPower !== null;
  return [
    might ? { text: compact(a.totalPower ?? 0), width: 64, bold: true } : STALE_CELL(c, 64),
    { text: a.memberCount === null ? "—" : String(a.memberCount), width: 42 },
  ];
}

/** The After's numbers: Might and its change; no change when either side is stale (D53). */
function afterCells(c: Colors, a: ImageAlliance, b: PublicAlliance | undefined): Cell[] {
  const side = (x: PublicAlliance) => ({ ...x, isFresh: usable(x) });
  const change = b ? delta(side(b), side(a))?.power : undefined;
  const tone = change === undefined || change === 0 ? c.ink : change > 0 ? c.yarn : c.seal;
  return [
    { text: a.totalPower === null ? "—" : compact(a.totalPower), width: 58 },
    change === undefined
      ? STALE_CELL(c, 76)
      : { text: signedCompact(change), width: 76, bold: true, color: tone },
  ];
}

/** The sections under the header and the height they take. */
function body(e: EventImageInput, c: Colors) {
  const t = copy.discord.image;
  const was = new Map(e.before.map((b) => [b.unionId, b]));
  const ledger = [...e.alliances]
    .sort((x, y) => (y.totalPower ?? -1) - (x.totalPower ?? -1))
    .slice(0, LEDGER[e.phase])
    .map((a, i) => (
      <Row
        key={`l${a.unionId}`}
        c={c}
        rank={i + 1}
        a={a}
        cells={e.phase === "before" ? beforeCells(c, a) : afterCells(c, a, was.get(a.unionId))}
      />
    ));
  const parts = [
    <Section key="l" c={c} icon={MightMark({})} color={c.plum} text={t.ledger} />,
    ...ledger,
  ];
  let height = SECTION + ledger.length * ROW;
  if (e.phase === "after") {
    for (const [metric, icon, text] of [
      ["power", MightMark({}), t.mightUp],
      ["kills", KillsMark({}), t.killsUp],
    ] as const) {
      const gains = topGains(e.alliances, e.before, metric);
      if (gains.length === 0) continue;
      parts.push(<Section key={metric} c={c} icon={icon} color={c.yarn} text={text} />);
      for (const g of gains) {
        const cells = [{ text: signedCompact(g.delta), width: 80, bold: true, color: c.yarn }];
        parts.push(
          <Row key={`${metric}${g.row.a.unionId}`} c={c} rank={g.rank} a={g.row.a} cells={cells} />,
        );
      }
      height += SECTION + gains.length * ROW;
    }
  }
  return { parts, height };
}

/** The picture as PNG bytes. */
export async function renderEventImage(e: EventImageInput): Promise<Uint8Array<ArrayBuffer>> {
  const c = colors();
  const { parts, height } = body(e, c);
  const footer = fill(copy.discord.image.footer, { site: copy.site.name, server: SERVER });
  const picture = (
    <div style={{ ...column, width: "100%", height: "100%", background: c.paper }}>
      <Header c={c} e={e} />
      <div style={{ ...column, padding: `0 ${u(PAD)}px` }}>{parts}</div>
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
          color: c.ink,
        }}
      >
        {footer}
      </div>
    </div>
  );
  const size = { width: u(WIDTH), height: u(HEADER + height + END + FOOT), fonts: loadFonts() };
  return new Uint8Array(await new ImageResponse(picture, size).arrayBuffer());
}

/** The picture, or null when it failed or took longer than RENDER_LIMIT_MS: the message then goes as text. */
export async function eventImage(e: EventImageInput): Promise<Uint8Array<ArrayBuffer> | null> {
  const failed = (reason: string) => {
    console.error("notify.image_failed", { event_id: e.eventId, reason });
    return null;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<"late">(
    (resolve) => (timer = setTimeout(resolve, RENDER_LIMIT_MS, "late")),
  );
  const drawn = renderEventImage(e).catch((err: unknown) =>
    failed(err instanceof Error ? err.name : "unknown"),
  );
  try {
    const png = await Promise.race([drawn, late]);
    return png === "late" ? failed("timeout") : png;
  } finally {
    clearTimeout(timer);
  }
}
